/**
 * Persistenter Abo-Store.
 *
 * Die Abo-Liste wird als JSON unter dem Schlüssel `kuendigo_subs_v1` gespeichert:
 *  - Web:    window.localStorage
 *  - Native: @react-native-async-storage/async-storage
 *
 * Zusätzlich hält der Store einen In-Memory-Cache, damit jede Mutation die
 * fertige neue Liste zurückgeben kann und die Screens sie direkt anzeigen.
 */
import { readValue, writeValue } from './kvStorage';
import type { Subscription } from './analyzeSubscriptions';

const COMBINING_MARKS = /[\u0300-\u036f]/g;

export const SUBS_STORAGE_KEY = 'kuendigo_subs_v1';

let cache: Subscription[] = [];
let hydrated = false;
let persistFailed = false;

// ─── Storage-Adapter ─────────────────────────────────────────────────────────

const readRaw = () => readValue(SUBS_STORAGE_KEY);

/** Gibt false zurück, wenn nicht geschrieben werden konnte (Privatmodus, Quota). */
const writeRaw = (json: string) => writeValue(SUBS_STORAGE_KEY, json);

// ─── Normalisierung & Duplikate ──────────────────────────────────────────────

/** "Netflix Intl. B.V." und "netflix intl bv" ergeben denselben Schlüssel. */
export function normalizeName(name: string): string {
  const base = (name ?? '').trim().toLowerCase();
  const stripped = base
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .replace(/[^a-z0-9]/g, '');
  // Nicht lateinische Namen (kyrillisch, griechisch, chinesisch) blieben sonst
  // leer und würden bei gleichem Betrag fälschlich zusammengeführt.
  return stripped || base.replace(/\s+/g, '');
}

/** Duplikat-Schlüssel: normalisierter Name + Betrag. */
function dedupeKey(sub: Subscription): string {
  const amount = Number.isFinite(sub.amount) ? sub.amount : 0;
  return `${normalizeName(sub.name)}|${amount.toFixed(2)}`;
}

/**
 * Stabile ID aus dem Duplikat-Schlüssel. Analysen liefern nur "1", "2", "3",
 * das würde über mehrere Läufe hinweg kollidieren.
 */
function stableId(sub: Subscription): string {
  return `sub_${dedupeKey(sub).replace('|', '_')}`;
}

function sanitize(raw: any): Subscription | null {
  if (!raw || typeof raw !== 'object') return null;
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  const amount = typeof raw.amount === 'number' ? raw.amount : Number(raw.amount);
  if (!name || !Number.isFinite(amount)) return null;

  const freq = ['weekly', 'monthly', 'quarterly', 'annual'].includes(raw.frequency)
    ? raw.frequency
    : 'monthly';
  const today = new Date().toISOString().slice(0, 10);

  const sub: Subscription = {
    // ID wird immer neu abgeleitet: Analysen liefern nur "1", "2", "3" und
    // würden sich über mehrere Läufe hinweg gegenseitig überschreiben.
    id: '',
    name,
    amount,
    frequency: freq,
    category: typeof raw.category === 'string' && raw.category ? raw.category : 'other',
    lastCharged: typeof raw.lastCharged === 'string' ? raw.lastCharged : today,
    nextCharge: typeof raw.nextCharge === 'string' ? raw.nextCharge : today,
    cancelled: raw.cancelled === true,
  };
  // cancelledAt gilt nur zusammen mit cancelled, sonst bliebe ein altes
  // Datum stehen, wenn eine Kündigung zurückgenommen wird.
  if (sub.cancelled && typeof raw.cancelledAt === 'string' && raw.cancelledAt) {
    sub.cancelledAt = raw.cancelledAt;
  }
  sub.id = stableId(sub);
  return sub;
}

/**
 * Führt zwei Listen additiv zusammen. Bei gleichem Duplikat-Schlüssel
 * (normalisierter Name + Betrag) gewinnen die neueren Datumsangaben, während
 * der bereits gespeicherte Anzeigename, die ID und ein gesetztes `cancelled`
 * erhalten bleiben.
 */
function mergeLists(existing: Subscription[], incoming: Subscription[]): Subscription[] {
  const byKey = new Map<string, Subscription>();

  for (const sub of existing) {
    byKey.set(dedupeKey(sub), sub);
  }

  for (const sub of incoming) {
    const key = dedupeKey(sub);
    const old = byKey.get(key);
    byKey.set(key, old
      ? sanitize({
          ...old, ...sub, id: old.id, name: old.name,
          cancelled: sub.cancelled || old.cancelled,
          cancelledAt: sub.cancelledAt ?? old.cancelledAt,
        })!
      : sub);
  }

  return [...byKey.values()];
}

async function persist(subs: Subscription[]): Promise<Subscription[]> {
  cache = subs;
  hydrated = true;
  persistFailed = !(await writeRaw(JSON.stringify(subs)));
  return [...cache];
}

// ─── Öffentliche API ─────────────────────────────────────────────────────────

/** Lädt die gespeicherte Liste (und füllt den Cache). */
export async function loadResults(): Promise<Subscription[]> {
  const raw = await readRaw();
  let parsed: unknown = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }

  const subs = Array.isArray(parsed)
    ? (parsed.map(sanitize).filter(Boolean) as Subscription[])
    : [];

  cache = subs;
  hydrated = true;
  return [...cache];
}

/**
 * Wurde schon einmal etwas gespeichert (auch eine bewusst geleerte Liste)?
 * Damit lässt sich "noch nie benutzt" von "alles gelöscht" unterscheiden.
 */
export async function hasStoredResults(): Promise<boolean> {
  return (await readRaw()) !== null;
}

/**
 * True, wenn die letzte Mutation nicht auf die Platte kam (Safari Privatmodus,
 * voller Speicher). Die Oberfläche kann dann warnen, dass nichts überlebt.
 */
export function lastPersistFailed(): boolean {
  return persistFailed;
}

/**
 * Bereinigt eine Liste ohne sie zu speichern: Duplikate zusammengeführt,
 * stabile IDs vergeben. Für Vorschauen wie die Demo-Liste.
 */
export function normalizeList(subs: Subscription[]): Subscription[] {
  const clean = (subs ?? []).map(sanitize).filter(Boolean) as Subscription[];
  return mergeLists([], clean);
}

/** Ersetzt die gespeicherte Liste vollständig. */
export async function setResults(subs: Subscription[]): Promise<Subscription[]> {
  // Auch innerhalb einer einzelnen Analyse Duplikate zusammenführen
  return persist(normalizeList(subs));
}

/**
 * Fügt eine neue Analyse additiv zur gespeicherten Liste hinzu.
 * Duplikate (normalisierter Name + Betrag) werden zusammengeführt.
 */
export async function mergeResults(subs: Subscription[]): Promise<Subscription[]> {
  if (!hydrated) await loadResults();
  const clean = (subs ?? []).map(sanitize).filter(Boolean) as Subscription[];
  return persist(mergeLists(cache, clean));
}

/** Legt ein Abo an oder aktualisiert ein bestehendes (ID, sonst Duplikat-Schlüssel). */
export async function upsertSubscription(sub: Subscription): Promise<Subscription[]> {
  if (!hydrated) await loadResults();
  const clean = sanitize(sub);
  if (!clean) return [...cache];

  const idx = cache.findIndex(s => s.id === clean.id || dedupeKey(s) === dedupeKey(clean));
  if (idx === -1) return persist([...cache, clean]);

  const next = [...cache];
  // Nochmals durch sanitize, damit etwa cancelledAt verschwindet,
  // wenn eine Kündigung zurückgenommen wird.
  next[idx] = sanitize({ ...next[idx], ...clean, id: next[idx].id })!;
  return persist(next);
}

/** Löscht ein Abo dauerhaft. */
export async function removeSubscription(id: string): Promise<Subscription[]> {
  if (!hydrated) await loadResults();
  return persist(cache.filter(s => s.id !== id));
}

/** Löscht alle gespeicherten Abos. */
export async function clearResults(): Promise<Subscription[]> {
  return persist([]);
}

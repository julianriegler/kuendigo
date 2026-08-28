/**
 * Eigener Anthropic API Key (optional) und anonymer Geräte-Token.
 *
 * Der Key ist seit dem serverseitigen Schlüssel nur noch ein Eigenschlüssel:
 * ohne ihn läuft die Analyse über das Freikontingent auf dem Server.
 * Der Geräte-Token ist eine zufällige ID ohne Personenbezug und dient
 * ausschließlich dazu, das Freikontingent pro Gerät zu zählen.
 */
import { readValue, writeValue, deleteValue, readValueSync } from './kvStorage';

const API_KEY_STORAGE_KEY = 'kuendigo_api_key';
const DEVICE_TOKEN_STORAGE_KEY = 'kuendigo_device_v1';
const SENDER_INFO_STORAGE_KEY = 'kuendigo_sender_info_v1';

let cachedKey = '';
let cachedDeviceToken = '';
let cachedSenderInfo: SenderInfo | null = null;

// ─── API Key ─────────────────────────────────────────────────────────────────

/** Lädt den Key aus dem Speicher und füllt den Cache. Beim App-Start aufrufen. */
export async function loadApiKey(): Promise<string> {
  cachedKey = (await readValue(API_KEY_STORAGE_KEY)) ?? '';
  return cachedKey;
}

/** Synchroner Zugriff. Auf Web direkt aus localStorage, auf Native aus dem Cache. */
export function getApiKey(): string {
  const direct = readValueSync(API_KEY_STORAGE_KEY);
  if (direct !== null) cachedKey = direct;
  return cachedKey;
}

export async function setApiKey(key: string): Promise<void> {
  cachedKey = key;
  if (key) {
    await writeValue(API_KEY_STORAGE_KEY, key);
  } else {
    await deleteValue(API_KEY_STORAGE_KEY);
  }
}

export async function clearApiKey(): Promise<void> {
  await setApiKey('');
}

// ─── Geräte-Token ────────────────────────────────────────────────────────────

function randomToken(): string {
  try {
    const c = (globalThis as any).crypto;
    if (c?.randomUUID) return c.randomUUID();
    if (c?.getRandomValues) {
      const bytes = c.getRandomValues(new Uint8Array(16));
      return Array.from(bytes as Uint8Array, b => b.toString(16).padStart(2, '0')).join('');
    }
  } catch {}
  // Fallback ohne Web Crypto
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Anonymer Geräte-Token für das Freikontingent. Wird beim ersten Aufruf
 * erzeugt und dauerhaft gespeichert.
 */
export async function loadDeviceToken(): Promise<string> {
  if (cachedDeviceToken) return cachedDeviceToken;
  const stored = await readValue(DEVICE_TOKEN_STORAGE_KEY);
  if (stored) {
    cachedDeviceToken = stored;
    return stored;
  }
  const token = randomToken();
  cachedDeviceToken = token;
  await writeValue(DEVICE_TOKEN_STORAGE_KEY, token);
  return token;
}

// ─── Absenderdaten fürs Kündigungsschreiben ─────────────────────────────────

export interface SenderInfo {
  name: string;
  street: string;
  zip: string;
  city: string;
  email?: string;
}

/** Lädt die zuletzt gespeicherten Absenderdaten, null wenn noch keine hinterlegt sind. */
export async function loadSenderInfo(): Promise<SenderInfo | null> {
  if (cachedSenderInfo) return cachedSenderInfo;
  const raw = await readValue(SENDER_INFO_STORAGE_KEY);
  if (!raw) return null;
  try {
    cachedSenderInfo = JSON.parse(raw) as SenderInfo;
    return cachedSenderInfo;
  } catch {
    return null;
  }
}

export async function saveSenderInfo(info: SenderInfo): Promise<void> {
  cachedSenderInfo = info;
  await writeValue(SENDER_INFO_STORAGE_KEY, JSON.stringify(info));
}

export async function clearSenderInfo(): Promise<void> {
  cachedSenderInfo = null;
  await deleteValue(SENDER_INFO_STORAGE_KEY);
}

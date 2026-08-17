// Logiktest für den persistenten Abo-Store.
// "Neuladen" wird simuliert, indem das Modul frisch importiert wird
// (neuer In-Memory-Cache, gleicher localStorage).
import './shim.ts';

let failed = 0;
function check(label: string, ok: boolean, extra?: unknown) {
  console.log(`${ok ? 'OK  ' : 'FEHL'} ${label}${extra !== undefined ? ` -> ${JSON.stringify(extra)}` : ''}`);
  if (!ok) failed++;
}

function sub(name: string, amount: number, extra: Record<string, unknown> = {}) {
  return {
    id: '1', name, amount, frequency: 'monthly', category: 'streaming',
    lastCharged: '2026-07-15', nextCharge: '2026-08-15', ...extra,
  } as any;
}

let round = 0;
async function fresh() {
  round++;
  return await import(`./resultStore.gen.ts?r=${round}`);
}

const s1 = await fresh();

check('leerer Speicher: hasStoredResults false', (await s1.hasStoredResults()) === false);
check('leerer Speicher: loadResults []', (await s1.loadResults()).length === 0);

// Erste Analyse
await s1.setResults([sub('Netflix', 13.99), sub('Spotify', 9.99), sub('Netflix', 13.99)]);
const afterFirst = await s1.loadResults();
check('erste Analyse dedupliziert intern (2 statt 3)', afterFirst.length === 2, afterFirst.map((s: any) => s.name));
check('IDs sind eindeutig', new Set(afterFirst.map((s: any) => s.id)).size === 2);

// Neuladen der Web-App simulieren
const s2 = await fresh();
const afterReload = await s2.loadResults();
check('nach Neuladen noch da', afterReload.length === 2, afterReload.map((s: any) => s.name));

// Zweite Analyse: additiv, Duplikate zusammenführen
await s2.mergeResults([
  sub('  netflix ', 13.99, { category: 'video', nextCharge: '2026-09-15' }), // Duplikat
  sub('NETFLIX', 7.99),                                                      // anderer Betrag = eigenes Abo
  sub('Disney+', 8.99),                                                      // neu
]);
const merged = await (await fresh()).loadResults();
check('additiv gespeichert (4 Abos)', merged.length === 4, merged.map((s: any) => `${s.name}:${s.amount}`));
const netflix = merged.find((s: any) => s.amount === 13.99 && s.name.toLowerCase().includes('netflix'));
check('Duplikat zusammengeführt, Datum neu, Name bleibt', netflix?.category === 'video' && netflix?.nextCharge === '2026-09-15' && netflix?.name === 'Netflix', netflix);
check('gleicher Name, anderer Betrag bleibt eigenes Abo', merged.filter((s: any) => s.name.toLowerCase().includes('netflix')).length === 2);

// Nicht lateinische Namen dürfen nicht kollidieren
const sX = await fresh();
await sX.setResults([sub('Кинопоиск', 4.99), sub('音乐会员', 4.99)]);
check('nicht lateinische Namen bleiben getrennt', (await sX.loadResults()).length === 2);
await sX.clearResults();
await sX.setResults(merged);

// Als gekündigt markieren
const s3 = await fresh();
const list3 = await s3.loadResults();
await s3.upsertSubscription({ ...list3[0], cancelled: true });
const afterCancel = await (await fresh()).loadResults();
check('cancelled überlebt Neuladen', afterCancel.find((s: any) => s.id === list3[0].id)?.cancelled === true);
check('upsert legt kein Duplikat an', afterCancel.length === 4, afterCancel.length);

// Kündigung zurücknehmen
const sU = await fresh();
const listU = await sU.loadResults();
await sU.upsertSubscription({ ...listU[0], cancelled: true, cancelledAt: '2026-08-17' });
const cancelledList = await (await fresh()).loadResults();
check('cancelledAt wird gespeichert',
  cancelledList.find((s: any) => s.id === listU[0].id)?.cancelledAt === '2026-08-17');
const sU2 = await fresh();
const listU2 = await sU2.loadResults();
await sU2.upsertSubscription({ ...listU2.find((s: any) => s.id === listU[0].id), cancelled: false });
const undone = (await (await fresh()).loadResults()).find((s: any) => s.id === listU[0].id);
check('zurückgenommene Kündigung löscht auch das Datum',
  undone?.cancelled === false && undone?.cancelledAt === undefined, undone);

// Löschen
const s4 = await fresh();
const list4 = await s4.loadResults();
const victim = list4[1];
await s4.removeSubscription(victim.id);
const afterDelete = await (await fresh()).loadResults();
check('Löschen persistiert', afterDelete.length === 3 && !afterDelete.some((s: any) => s.id === victim.id),
  afterDelete.map((s: any) => s.name));

// Alles löschen: Speicher existiert weiter, Demo-Daten kommen nicht zurück
const s5 = await fresh();
await s5.clearResults();
const s6 = await fresh();
check('geleerte Liste bleibt leer', (await s6.loadResults()).length === 0);
check('hasStoredResults erkennt geleerte Liste', (await s6.hasStoredResults()) === true);

console.log(failed === 0 ? '\nAlle Prüfungen bestanden.' : `\n${failed} Prüfung(en) fehlgeschlagen.`);
process.exit(failed === 0 ? 0 : 1);

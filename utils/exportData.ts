/**
 * Export der gespeicherten Abo-Liste als CSV oder JSON.
 *
 * CSV nutzt Semikolon als Trennzeichen und das deutsche Dezimalkomma, damit
 * Excel und Numbers die Datei in DACH ohne Umweg richtig einlesen. Auf Web
 * lädt die Datei per Blob herunter, auf Native geht sie über expo-sharing
 * an die Systemfreigabe.
 */
import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { categories } from '../constants/theme';
import type { Subscription } from './analyzeSubscriptions';

function freqLabel(f: Subscription['frequency']): string {
  return f === 'monthly' ? 'monatlich' : f === 'annual' ? 'jährlich'
    : f === 'quarterly' ? 'quartalsweise' : 'wöchentlich';
}

function categoryLabel(cat: string): string {
  return categories[cat]?.label ?? cat;
}

/** Deutsches Dezimalkomma statt Punkt, z. B. 9,99. */
function formatAmountDe(amount: number): string {
  return amount.toFixed(2).replace('.', ',');
}

/** Feld für CSV escapen: Anführungszeichen verdoppeln, bei Bedarf quoten. */
function csvField(value: string): string {
  if (/[;"\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

const CSV_HEADER = ['Name', 'Betrag (EUR)', 'Rhythmus', 'Kategorie', 'Zuletzt abgebucht', 'Nächste Abbuchung', 'Gekündigt'];

export function subscriptionsToCsv(subs: Subscription[]): string {
  const rows = subs.map(s => [
    s.name,
    formatAmountDe(s.amount),
    freqLabel(s.frequency),
    categoryLabel(s.category),
    s.lastCharged,
    s.nextCharge,
    s.cancelled ? 'Ja' : 'Nein',
  ].map(csvField).join(';'));
  // ﻿: BOM, damit Excel unter Windows die Umlaute korrekt erkennt.
  return '﻿' + [CSV_HEADER.join(';'), ...rows].join('\r\n');
}

export function subscriptionsToJson(subs: Subscription[]): string {
  return JSON.stringify(subs, null, 2);
}

function timestampedFilename(ext: 'csv' | 'json'): string {
  const today = new Date().toISOString().slice(0, 10);
  return `kuendigo-abos-${today}.${ext}`;
}

async function shareOnNative(filename: string, content: string, mimeType: string): Promise<void> {
  const file = new File(Paths.cache, filename);
  file.write(content);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: filename });
  }
}

function downloadOnWeb(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Exportiert die Abo-Liste als CSV oder JSON, je nach Plattform per Teilen oder Download. */
export async function exportSubscriptions(subs: Subscription[], format: 'csv' | 'json'): Promise<void> {
  const content = format === 'csv' ? subscriptionsToCsv(subs) : subscriptionsToJson(subs);
  const mimeType = format === 'csv' ? 'text/csv' : 'application/json';
  const filename = timestampedFilename(format);

  if (Platform.OS === 'web') {
    downloadOnWeb(filename, content, mimeType);
  } else {
    await shareOnNative(filename, content, mimeType);
  }
}

/**
 * Plattformübergreifender Schlüssel-Wert-Speicher.
 *  - Web:    window.localStorage
 *  - Native: @react-native-async-storage/async-storage
 *
 * Alle Funktionen sind asynchron und schlucken Fehler nicht still:
 * writeValue meldet per Rückgabewert, ob geschrieben werden konnte
 * (Safari Privatmodus, voller Speicher).
 */
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

function hasLocalStorage(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch {
    return false;
  }
}

export async function readValue(key: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      return hasLocalStorage() ? window.localStorage.getItem(key) : null;
    }
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Gibt false zurück, wenn nicht geschrieben werden konnte. */
export async function writeValue(key: string, value: string): Promise<boolean> {
  try {
    if (Platform.OS === 'web') {
      if (!hasLocalStorage()) return false;
      window.localStorage.setItem(key, value);
      return true;
    }
    await AsyncStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export async function deleteValue(key: string): Promise<boolean> {
  try {
    if (Platform.OS === 'web') {
      if (!hasLocalStorage()) return false;
      window.localStorage.removeItem(key);
      return true;
    }
    await AsyncStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

/** Synchroner Blick in den Web-Speicher, auf Native immer null. */
export function readValueSync(key: string): string | null {
  try {
    if (Platform.OS === 'web' && hasLocalStorage()) return window.localStorage.getItem(key);
  } catch {}
  return null;
}

/**
 * Simple cross-platform key-value storage.
 * Uses localStorage on web, in-memory fallback on native
 * (replace with SecureStore/AsyncStorage for production native).
 */

const STORAGE_KEY = 'kuendigo_api_key';

// In-memory fallback for environments without localStorage
let memoryApiKey = '';

export function getApiKey(): string {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return localStorage.getItem(STORAGE_KEY) ?? '';
    }
  } catch {}
  return memoryApiKey;
}

export function setApiKey(key: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      if (key) {
        localStorage.setItem(STORAGE_KEY, key);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  } catch {}
  memoryApiKey = key;
}

export function clearApiKey(): void {
  setApiKey('');
}

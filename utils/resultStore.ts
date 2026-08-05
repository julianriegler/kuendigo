/**
 * Lightweight in-memory store to pass subscription results
 * between the upload/manual screens and the results screen.
 * Avoids URL-param length limits and encoding issues on web.
 */
import type { Subscription } from './analyzeSubscriptions';

let _results: Subscription[] = [];

export function setResults(subs: Subscription[]): void {
  _results = subs;
}

export function getResults(): Subscription[] {
  return _results;
}

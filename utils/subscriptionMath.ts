/**
 * Reine Rechenlogik rund um Abos, ohne Plattform-Abhängigkeiten,
 * damit sie sich ohne Expo testen lässt.
 */
import type { Subscription } from './analyzeSubscriptions';

/** Wochen pro Monat im Schnitt (365 / 12 / 7). */
const WEEKS_PER_MONTH = 4.345;

/** Betrag eines Abos auf einen Monatswert umgerechnet. */
export function monthlyAmount(s: Pick<Subscription, 'amount' | 'frequency'>): number {
  const amount = Number.isFinite(s.amount) ? s.amount : 0;
  switch (s.frequency) {
    case 'weekly':    return amount * WEEKS_PER_MONTH;
    case 'quarterly': return amount / 3;
    case 'annual':    return amount / 12;
    default:          return amount;
  }
}

/** Betrag eines Abos auf einen Jahreswert umgerechnet. */
export function annualAmount(s: Pick<Subscription, 'amount' | 'frequency'>): number {
  return monthlyAmount(s) * 12;
}

export interface Savings {
  /** Anzahl der als gekündigt markierten Abos. */
  count: number;
  perMonth: number;
  perYear: number;
}

/**
 * Summiert die Ersparnis aus allen als gekündigt markierten Abos.
 * Jährliche und wöchentliche Abos werden dabei auf Monatswerte umgerechnet.
 */
export function cancelledSavings(subs: Subscription[]): Savings {
  const cancelled = (subs ?? []).filter(s => s?.cancelled);
  const perMonth = cancelled.reduce((sum, s) => sum + monthlyAmount(s), 0);
  return { count: cancelled.length, perMonth, perYear: perMonth * 12 };
}

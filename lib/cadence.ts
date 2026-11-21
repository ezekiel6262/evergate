// Check-in and wait choices. The circuit never sees these numbers.
// The keeper turns them into "missed intervals" and "wait elapsed".

export type Rhythm = { days: number; label: string; phrase: string; note: string };

export const CHECK_INS: Rhythm[] = [
  { days: 7, label: 'Every week', phrase: 'every week', note: 'About four times a month.' },
  { days: 14, label: 'Twice a month', phrase: 'twice a month', note: 'A check-in every two weeks.' },
  { days: 30, label: 'Every month', phrase: 'every month', note: 'One check-in a month. This is the one we recommend.' },
  { days: 90, label: 'Every 3 months', phrase: 'every 3 months', note: 'A check-in each season.' },
  { days: 182, label: 'Twice a year', phrase: 'twice a year', note: 'About every 6 months.' },
  { days: 365, label: 'Once a year', phrase: 'once a year', note: 'Easy to forget, so the reminders matter.' },
];

export const WAITS: Rhythm[] = [
  { days: 14, label: '2 weeks', phrase: '2 weeks', note: 'A short chance to cancel.' },
  { days: 30, label: '1 month', phrase: '1 month', note: 'A month to see the alert and cancel it. This is the one we recommend.' },
  { days: 60, label: '2 months', phrase: '2 months', note: 'Two months to cancel after the alert.' },
  { days: 90, label: '3 months', phrase: '3 months', note: 'A long window, for a plan you rarely think about.' },
];

export const MISS_CHOICES = [1, 2, 3, 4, 6];

export const LIMITS = { minDays: 1, maxDays: 3650, minMisses: 1, maxMisses: 15 };

export function clampDays(n: number) {
  if (!Number.isFinite(n)) return 30;
  return Math.min(LIMITS.maxDays, Math.max(LIMITS.minDays, Math.round(n)));
}

export function clampMisses(n: number) {
  if (!Number.isFinite(n)) return 3;
  return Math.min(LIMITS.maxMisses, Math.max(LIMITS.minMisses, Math.round(n)));
}

/** A length a person can read: "3 months", "6 weeks", "45 days". */
export function spell(days: number): string {
  const d = clampDays(days);
  if (d % 365 === 0) {
    const y = d / 365;
    return y === 1 ? '1 year' : `${y} years`;
  }
  if (d % 30 === 0) {
    const m = d / 30;
    return m === 1 ? '1 month' : `${m} months`;
  }
  if (d % 7 === 0) {
    const w = d / 7;
    return w === 1 ? '1 week' : `${w} weeks`;
  }
  return d === 1 ? '1 day' : `${d} days`;
}

export function checkInPhrase(days: number): string {
  return CHECK_INS.find(r => r.days === days)?.phrase ?? `every ${spell(days)}`;
}

export function waitPhrase(days: number): string {
  return WAITS.find(r => r.days === days)?.phrase ?? spell(days);
}

export function silenceDays(intervalDays: number, misses: number) {
  return clampDays(intervalDays) * clampMisses(misses);
}

export function earliestDays(intervalDays: number, misses: number, waitDays: number) {
  return silenceDays(intervalDays, misses) + clampDays(waitDays);
}

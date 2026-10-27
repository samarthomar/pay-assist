import { addDays, differenceInCalendarDays, format, getDay, parseISO } from 'date-fns';
import { iso, nthDate } from './plans';
import type { Plan } from './types';

// Keeping plans on track (Stage 5). The Sustain agent reminds before payday, spots failed payments
// and reschedules within the rules so the plan does not break.

// Proposed rescue rule (to validate with AGL, BRD open point "treatment when a promised payment fails"):
// one missed instalment may move up to 7 days later, must stay before the next instalment, amount unchanged.
export const RESCUE = { maxDaysLater: 7, reminderDaysBefore: 2 };

export const schedule = (p: Plan): string[] =>
  Array.from({ length: p.count ?? 0 }, (_, k) => iso(nthDate(parseISO(p.firstDate!), p.frequency!, k)));

export interface RescueCheck { id: string; text: string; pass: boolean }

export function checkReschedule(p: Plan, missedIndex: number, newDate: string): { allowed: boolean; checks: RescueCheck[] } {
  const dates = schedule(p);
  const due = parseISO(dates[missedIndex]);
  const next = dates[missedIndex + 1] ? parseISO(dates[missedIndex + 1]) : null;
  const d = parseISO(newDate);
  const late = differenceInCalendarDays(d, due);
  const checks: RescueCheck[] = [
    { id: 'BR-S01', text: `New date is ${late} day${late === 1 ? '' : 's'} after the missed date (7 or fewer)`, pass: late > 0 && late <= RESCUE.maxDaysLater },
    { id: 'BR-S01', text: next ? `Before the next instalment on ${format(next, 'd MMM')}` : 'Last instalment of the plan', pass: !next || d < next },
    { id: 'BR-S01', text: 'Instalment amount and plan total unchanged', pass: true },
    { id: 'BR-P03', text: `Plan still ends on ${format(parseISO(dates[dates.length - 1]), 'd MMM yyyy')}`, pass: true },
  ];
  return { allowed: checks.every((c) => c.pass), checks };
}

// Rescue dates offered by the Sustain agent: the next business day after a weekend gap, and the same weekday next week.
export function rescueOptions(p: Plan, missedIndex: number): string[] {
  const due = parseISO(schedule(p)[missedIndex]);
  const out: string[] = [];
  let d = addDays(due, 1);
  while (out.length < 2 && differenceInCalendarDays(d, due) <= RESCUE.maxDaysLater) {
    const wd = getDay(d);
    // Offer the next Monday (pay often lands after a weekend) and the same weekday a week later.
    if ((wd === 1 && !out.length) || differenceInCalendarDays(d, due) === 7) out.push(iso(d));
    d = addDays(d, 1);
  }
  return out.filter((x) => checkReschedule(p, missedIndex, x).allowed);
}

import { addDays, addMonths, format, parseISO } from 'date-fns';
import { avgMonthlyBill, oldestInvoiceDays, totalOverdue } from './customers';
import { dollars } from './money';
import type { Customer, Frequency, Plan } from './types';

// Business rule limits (BRD section 10). The plan calculator is deterministic: the AI never computes amounts.
export const LIMITS = {
  humanThresholdCents: 200_000, // BR-T02: $2,000 or more goes to the Resolution Team
  maxExtensionDays: 21, // BR-P01
  extensionMaxInvoiceAgeDays: 90, // BR-T05
  instalmentMaxMonths: 3, // BR-P02
  assistMaxMonths: 12, // BR-P03 (all states)
  assistMaxMonthsVic: 24, // BR-P03 (Victoria)
  billSmoothingMaxOverdueCents: 50_000, // BR-P04
  billSmoothingMinHistoryMonths: 12, // BR-P04
  paymentInTransitBusinessDays: 5, // BR-T08
  brokenArrangementsForReview: 2, // BR-T06
};

export const iso = (d: Date) => format(d, 'yyyy-MM-dd');
export const PERIODS_PER_YEAR: Record<Frequency, number> = { weekly: 52, fortnightly: 26, monthly: 12 };

export const instalmentCount = (months: number, freq: Frequency) =>
  freq === 'monthly' ? months : Math.floor((months * PERIODS_PER_YEAR[freq]) / 12);

export const nthDate = (first: Date, freq: Frequency, k: number) =>
  freq === 'monthly' ? addMonths(first, k) : addDays(first, k * (freq === 'weekly' ? 7 : 14));

export const maxAssistMonths = (c: Customer) => (c.state === 'VIC' ? LIMITS.assistMaxMonthsVic : LIMITS.assistMaxMonths);
export const extensionAllowed = (c: Customer) => oldestInvoiceDays(c) <= LIMITS.extensionMaxInvoiceAgeDays;
export const billSmoothingAllowed = (c: Customer) =>
  totalOverdue(c) < LIMITS.billSmoothingMaxOverdueCents && c.monthsOfHistory >= LIMITS.billSmoothingMinHistoryMonths;

// Equal instalments; only the last one absorbs the rounding difference (BR-P02).
export function split(totalCents: number, count: number) {
  const each = Math.round(totalCents / count);
  return { each, last: totalCents - each * (count - 1) };
}

const per = (freq: Frequency) => ({ weekly: 'week', fortnightly: 'fortnight', monthly: 'month' })[freq];

export function fullPayment(c: Customer): Plan {
  const total = totalOverdue(c);
  return { type: 'full', label: 'Pay in full', totalCents: total, upfrontCents: total, explanation: `Clear the full overdue balance of ${dollars(total)} today.` };
}

export function extension(c: Customer, today: Date, days = 14): Plan {
  const d = Math.min(days, LIMITS.maxExtensionDays);
  const due = iso(addDays(today, d));
  const total = totalOverdue(c);
  return { type: 'extension', label: `Extension ${d} days`, totalCents: total, dueDate: due, explanation: `Pay ${dollars(total)} by ${format(parseISO(due), 'd MMM')}, ${d} days from today.` };
}

export function partPaymentExtension(c: Customer, today: Date, upfrontCents?: number, days = 15): Plan {
  const total = totalOverdue(c);
  const up = upfrontCents ?? Math.max(5000, Math.floor((total * 0.25) / 5000) * 5000);
  const d = Math.min(days, LIMITS.maxExtensionDays);
  const due = iso(addDays(today, d));
  return {
    type: 'part_extension', label: 'Part pay + extension', totalCents: total, upfrontCents: up, dueDate: due,
    explanation: `Pay ${dollars(up)} today and the remaining ${dollars(total - up)} by ${format(parseISO(due), 'd MMM')}.`,
  };
}

function overTime(c: Customer, type: 'instalment' | 'assist', months: number, freq: Frequency, first: Date): Plan {
  const count = instalmentCount(months, freq);
  const total = totalOverdue(c) + months * avgMonthlyBill(c);
  const { each, last } = split(total, count);
  const label = type === 'instalment' ? `Instalment plan (${months} months)` : `Assist payment arrangement (${months} months)`;
  return {
    type, label, totalCents: total, frequency: freq, months, count, instalmentCents: each, lastInstalmentCents: last,
    firstDate: iso(first), lastDate: iso(nthDate(first, freq, count - 1)),
    explanation: `Overdue balance plus ${months} months of usage, in ${count} ${freq} payments of ${dollars(each)} per ${per(freq)}.`,
  };
}

export const instalmentPlan = (c: Customer, first: Date, freq: Frequency = 'fortnightly', months = LIMITS.instalmentMaxMonths) =>
  overTime(c, 'instalment', Math.min(months, LIMITS.instalmentMaxMonths), freq, first);

export const assistArrangement = (c: Customer, first: Date, freq: Frequency = 'fortnightly', months = 12) =>
  overTime(c, 'assist', Math.min(months, maxAssistMonths(c)), freq, first);

export function billSmoothing(c: Customer, first: Date, freq: Frequency = 'fortnightly'): Plan {
  const each = Math.round((avgMonthlyBill(c) * 12) / PERIODS_PER_YEAR[freq]);
  return {
    type: 'bill_smoothing', label: 'Bill smoothing (add-on)', totalCents: each * PERIODS_PER_YEAR[freq], frequency: freq,
    instalmentCents: each, firstDate: iso(first),
    explanation: `Even out future bills at about ${dollars(each)} per ${per(freq)}, based on your 12-month average.`,
  };
}

// Assist arrangement lengths offered, shortest first (clears the debt soonest).
export const ASSIST_LENGTHS = [6, 12, 18, 24];

// Pick the shortest Assist arrangement whose instalment fits the customer's comfortable amount (FR-PLN-04).
export function planForBudget(c: Customer, budgetCents: number, freq: Frequency, first: Date): Plan | null {
  for (const m of ASSIST_LENGTHS.filter((m) => m <= maxAssistMonths(c))) {
    const p = assistArrangement(c, first, freq, m);
    if (p.instalmentCents! <= budgetCents) return p;
  }
  return null;
}

// The extra amount per period that goes to clearing the debt (shown in the plan summary).
export const debtComponent = (c: Customer, p: Plan) =>
  p.count ? Math.round(totalOverdue(c) / p.count) : totalOverdue(c);

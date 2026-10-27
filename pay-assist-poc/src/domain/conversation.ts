import { addDays, format, getDay, isBefore, parseISO } from 'date-fns';
import { totalOverdue } from './customers';
import { dollars } from './money';
import {
  ASSIST_LENGTHS, LIMITS, assistArrangement, billSmoothing, billSmoothingAllowed, extension, extensionAllowed, fullPayment,
  instalmentPlan, maxAssistMonths, partPaymentExtension,
} from './plans';
import type { Customer, Frequency, Plan } from './types';

// Language helpers for the Pay Assist chat. The chat understands a few things in free text (pay cycle, amount,
// first date, intent) and always falls back safely to buttons. It never invents amounts: those come from the plan calculator.

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export interface BudgetAnswer {
  freq?: Frequency;
  amountCents?: number;
  firstDate?: string; // YYYY-MM-DD
  weekday?: number; // 0 = Sunday
}

const MONTHS: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

export function parseBudget(text: string, today: Date): BudgetAnswer {
  const t = text.toLowerCase();
  const out: BudgetAnswer = {};
  if (/fortnight/.test(t)) out.freq = 'fortnightly';
  else if (/week/.test(t)) out.freq = 'weekly';
  else if (/month/.test(t)) out.freq = 'monthly';

  const money = t.match(/\$\s?(\d{2,4}(?:\.\d{1,2})?)/) ?? t.match(/\b(\d{2,4})\s*(?:dollars|bucks|a fortnight|a week|a month|per|each)/);
  if (money) out.amountCents = Math.round(parseFloat(money[1]) * 100);

  const date = t.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*/);
  if (date) {
    let d = new Date(today.getFullYear(), MONTHS[date[2]], parseInt(date[1], 10));
    if (isBefore(d, today)) d = new Date(today.getFullYear() + 1, d.getMonth(), d.getDate());
    out.firstDate = format(d, 'yyyy-MM-dd');
    out.weekday = getDay(d);
  }
  const day = WEEKDAYS.findIndex((w) => t.includes(w.toLowerCase()));
  if (day >= 0) out.weekday = day;
  return out;
}

export type Intent = 'options' | 'already_paid' | 'trouble' | 'human' | 'more_time' | 'yes' | 'unsure' | 'change' | null;

export function intent(text: string): Intent {
  const t = text.toLowerCase();
  if (/already paid|i paid|i've paid|ive paid|paid (it|yesterday|last)/.test(t)) return 'already_paid';
  if (/real person|human|someone|speak to|talk to|call me/.test(t)) return 'human';
  if (/too high|more time|lower|longer|smaller|cheaper|anything else|other option/.test(t)) return 'more_time';
  if (/not sure|unsure|don'?t know/.test(t)) return 'unsure';
  if (/change|different (date|amount|day)/.test(t)) return 'change';
  if (/trouble|can'?t pay|cannot pay|struggl|hard to pay|difficult/.test(t)) return 'trouble';
  if (/option|show|yes|ok(ay)?|sure|sounds good|go ahead/.test(t)) return t.includes('option') || t.includes('show') ? 'options' : 'yes';
  return null;
}

// The next paydays on or after tomorrow for a weekday (default Thursday for the demo persona).
export function nextDates(today: Date, weekday: number, n = 3): string[] {
  let d = addDays(today, 1);
  while (getDay(d) !== weekday) d = addDays(d, 1);
  return Array.from({ length: n }, (_, k) => format(addDays(d, k * 7), 'yyyy-MM-dd'));
}

// Options offered in the chat (Steps 11-13): the pre-assessed eligible plans, built by the calculator.
export function chatOptions(c: Customer, today: Date, freq: Frequency = 'fortnightly'): { plans: Plan[]; notes: string[] } {
  const first = addDays(today, 1);
  const plans: Plan[] = [fullPayment(c)];
  const notes: string[] = [];
  if (extensionAllowed(c)) plans.push(partPaymentExtension(c, today));
  else notes.push('Extensions aren\'t available because your oldest bill is more than 90 days overdue.');
  plans.push(instalmentPlan(c, first, freq, 3));
  plans.push(assistArrangement(c, first, freq, 12));
  if (billSmoothingAllowed(c)) plans.push(billSmoothing(c, first, freq));
  else if (totalOverdue(c) >= LIMITS.billSmoothingMaxOverdueCents) notes.push('Bill smoothing is for balances under $500, so it isn\'t shown here.');
  return { plans, notes };
}

// Shortest Assist arrangement within the state limit that fits the budget, plus the alternatives either side.
export function rankForBudget(c: Customer, budgetCents: number, freq: Frequency, first: Date) {
  const lengths = ASSIST_LENGTHS.filter((m) => m <= maxAssistMonths(c));
  const all = lengths.map((m) => assistArrangement(c, first, freq, m));
  const fit = all.find((p) => p.instalmentCents! <= budgetCents) ?? null;
  return { all, fit, lowest: all[all.length - 1] };
}

// Extension long enough for an in-transit payment to post (BR-T08), never over 21 days.
export const POSTING: Record<string, { label: string; businessDays: number; text: string }> = {
  card: { label: 'Card', businessDays: 2, text: '24–48 hours' },
  bank: { label: 'Bank transfer', businessDays: 2, text: '24–48 hours' },
  bpay: { label: 'BPAY', businessDays: 2, text: '1–2 business days' },
  paypal: { label: 'PayPal', businessDays: 5, text: '3–5 business days' },
  auspost: { label: 'Australia Post', businessDays: 5, text: '3–5 business days' },
};

export function postingExtension(c: Customer, today: Date, method: keyof typeof POSTING): Plan {
  const days = Math.min(POSTING[method].businessDays * 2 + 3, LIMITS.maxExtensionDays);
  return extension(c, today, days);
}

export const longDate = (iso: string) => format(parseISO(iso), 'EEEE d MMMM');
export const shortDate = (iso: string) => format(parseISO(iso), 'EEE d MMM yyyy');

export function cadence(p: Plan) {
  if (!p.firstDate) return '';
  const wd = WEEKDAYS[getDay(parseISO(p.firstDate))];
  if (p.frequency === 'weekly') return `every ${wd}`;
  if (p.frequency === 'fortnightly') return `every second ${wd}`;
  return `on the ${format(parseISO(p.firstDate), 'do')} of each month`;
}

// All amounts the AI may say in this conversation, for the Guardian's amount check (FR-GRD-06).
export function allowedAmounts(c: Customer, plans: Plan[]) {
  const set = new Set<number>([totalOverdue(c), ...c.accounts.map((a) => a.overdueCents)]);
  plans.forEach((p) => {
    [p.totalCents, p.upfrontCents, p.instalmentCents, p.lastInstalmentCents].forEach((v) => v !== undefined && set.add(v));
    if (p.upfrontCents !== undefined) set.add(p.totalCents - p.upfrontCents);
  });
  return [...set];
}

export const money = dollars;

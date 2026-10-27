import { fuelLabel, oldestInvoiceDays, totalOverdue } from './customers';
import { generateOverdueFile, validateFile, type OverdueFile } from './generate';
import { checkMessage, checkPlan } from './guardian';
import { dollars } from './money';
import { extension } from './plans';
import { assess } from './rules';
import type { Assessment, Customer, PlanType } from './types';

// The morning run (Scene 1): one pass over the daily file, producing every number the Assess screen shows.
// All counts are computed from the synthetic file, never typed in.

export interface Row {
  c: Customer;
  a: Assessment;
  overdueCents: number;
  days: number;
}

export type DebtBand = 'under500' | '500to1999' | '2000plus';
export const debtBand = (cents: number): DebtBand => (cents < 50_000 ? 'under500' : cents < 200_000 ? '500to1999' : '2000plus');
export const DEBT_BAND_LABEL: Record<DebtBand, string> = { under500: 'Under $500', '500to1999': '$500 to $1,999', '2000plus': '$2,000 or more' };

export const PLAN_LABEL: Record<PlanType, string> = {
  full: 'Pay in full', part_extension: 'Part pay + extension', extension: 'Extension', instalment: 'Instalments (3 months)',
  assist: 'Assist arrangement', bill_smoothing: 'Bill smoothing',
};

export const SMS_TEMPLATE = 'Hi {firstName}, it\'s AGL. You have flexible options to help with your energy account. View them securely here: {link}';

export interface MorningRun {
  file: OverdueFile;
  total: number;
  byFuel: { elec: number; gas: number; dual: number };
  rejected: { customer: Customer; reason: string }[];
  rejectedByReason: Record<string, number>;
  rows: Row[];
  decisions: { ai: number; human: number; none: number };
  routes: Record<string, number>;
  noneReasons: Record<string, number>;
  bands: { High: number; Medium: number; Low: number };
  plans: Partial<Record<PlanType, number>>;
  overdueByDecision: { ai: number; human: number; none: number };
  guardian: { checked: number; allowed: number; blockedDrafts: number; rebuilt: number; messageAllowed: boolean };
  channels: { 'sms+email': number; sms: number; email: number };
  priority: number;
}

let cache: MorningRun | null = null;

export function morningRun(today: Date): MorningRun {
  if (cache) return cache;
  const file = generateOverdueFile();
  const v = validateFile(file);
  const rows: Row[] = v.valid.map((c) => ({ c, a: assess(c, today), overdueCents: totalOverdue(c), days: oldestInvoiceDays(c) }));

  const decisions = { ai: 0, human: 0, none: 0 };
  const overdueByDecision = { ai: 0, human: 0, none: 0 };
  const routes: Record<string, number> = {};
  const noneReasons: Record<string, number> = {};
  const bands = { High: 0, Medium: 0, Low: 0 };
  const plans: Partial<Record<PlanType, number>> = {};
  const channels = { 'sms+email': 0, sms: 0, email: 0 };
  const guardian = { checked: 0, allowed: 0, blockedDrafts: 0, rebuilt: 0, messageAllowed: checkMessage(SMS_TEMPLATE, false).allowed };
  let priority = 0;

  for (const { c, a, overdueCents } of rows) {
    decisions[a.decision]++;
    overdueByDecision[a.decision] += overdueCents;
    bands[a.affordability.band]++;
    if (a.route) routes[a.route] = (routes[a.route] ?? 0) + 1;
    if (a.decision === 'none') noneReasons[a.segment] = (noneReasons[a.segment] ?? 0) + 1;
    if (a.decision === 'ai' && a.recommended) {
      plans[a.recommended.type] = (plans[a.recommended.type] ?? 0) + 1;
      channels[c.contact.preferred]++;
      if (a.priority) priority++;
      // The Plan agent's first draft for able-to-pay customers is a payday extension. The Guardian vetoes it
      // when the oldest invoice is over 90 days (BR-T05) and the Plan agent rebuilds the offer.
      if (a.affordability.band === 'High' && !a.extensionAllowed) {
        guardian.checked++;
        if (!checkPlan(c, extension(c, today, 14), today).allowed) guardian.blockedDrafts++;
      }
      guardian.checked++;
      if (checkPlan(c, a.recommended, today).allowed) guardian.allowed++;
      if (a.affordability.band === 'High' && !a.extensionAllowed) guardian.rebuilt++;
    }
  }

  const rejectedByReason: Record<string, number> = {};
  v.rejected.forEach((r) => { rejectedByReason[r.reason] = (rejectedByReason[r.reason] ?? 0) + 1; });

  cache = {
    file, total: v.total, byFuel: v.byFuel, rejected: v.rejected, rejectedByReason, rows, decisions, routes, noneReasons,
    bands, plans, overdueByDecision, guardian, channels, priority,
  };
  return cache;
}

const DECISION_LABEL = { ai: 'AI contact', human: 'Human contact', none: 'Do not contact' };
export const decisionLabel = (a: Assessment) => (a.decision === 'human' ? `Human: ${a.route}` : DECISION_LABEL[a.decision]);

export function planSummary(a: Assessment) {
  const p = a.recommended ?? a.draftForHuman;
  if (!p) return '';
  const what = p.instalmentCents ? `${p.count} x ${dollars(p.instalmentCents)}` : p.dueDate ? `by ${p.dueDate}` : dollars(p.totalCents);
  return `${a.recommended ? '' : 'Draft for human: '}${p.label}, ${what}`;
}

// Output file for AGL's systems (FR-ASM-06). Opens directly in Excel.
export function toCsv(rows: Row[]) {
  const cell = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = ['Customer ID', 'Name', 'State', 'Fuel', 'Overdue', 'Oldest invoice (days)', 'Affordability index', 'Affordability band',
    'Decision', 'Route', 'Segment', 'Recommended plan', 'Priority', 'Reason code', 'Reason', 'Rules applied'];
  const lines = rows.map(({ c, a, overdueCents, days }) => [
    c.id, c.name, c.state, fuelLabel(c), (overdueCents / 100).toFixed(2), days, a.affordability.index.toFixed(2), a.affordability.band,
    DECISION_LABEL[a.decision], a.route ?? '', a.segment, planSummary(a), a.priority ? 'Yes' : 'No', a.reasonCode, a.reason,
    a.rules.map((r) => r.id).join(' '),
  ].map(cell).join(','));
  return '﻿' + [head.join(','), ...lines].join('\r\n');
}

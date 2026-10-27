import { differenceInCalendarDays, parseISO } from 'date-fns';
import { totalOverdue } from './customers';
import {
  LIMITS, billSmoothingAllowed, extensionAllowed, instalmentCount, maxAssistMonths,
} from './plans';
import type { Customer, Plan } from './types';

export interface GuardianResult {
  allowed: boolean;
  checks: { id: string; text: string; pass: boolean }[];
}

const result = (checks: GuardianResult['checks']): GuardianResult => ({ allowed: checks.every((c) => c.pass), checks });

// Every plan is checked against the arrangement rules before it is offered or executed (FR-GRD-01).
export function checkPlan(c: Customer, p: Plan, today: Date): GuardianResult {
  const checks: GuardianResult['checks'] = [];
  const total = totalOverdue(c);

  if (p.dueDate) {
    const days = differenceInCalendarDays(parseISO(p.dueDate), today);
    checks.push({ id: 'BR-P01', text: `Extension of ${days} days is within 21 days`, pass: days >= 0 && days <= LIMITS.maxExtensionDays });
    checks.push({ id: 'BR-T05', text: 'Oldest invoice is 90 days or less', pass: extensionAllowed(c) });
  }
  if (p.type === 'instalment') {
    checks.push({ id: 'BR-P02', text: `Instalment plan of ${p.months} months is 3 months or less`, pass: (p.months ?? 0) <= LIMITS.instalmentMaxMonths });
  }
  if (p.type === 'assist') {
    const max = maxAssistMonths(c);
    checks.push({ id: 'BR-P03', text: `Assist arrangement of ${p.months} months is within ${max} months (${c.state})`, pass: (p.months ?? 0) <= max });
  }
  if (p.type === 'instalment' || p.type === 'assist') {
    const n = p.count ?? 0;
    const sum = (p.instalmentCents ?? 0) * (n - 1) + (p.lastInstalmentCents ?? 0);
    checks.push({ id: 'BR-P02', text: 'Instalments are equal; only the last differs', pass: n === instalmentCount(p.months!, p.frequency!) && Math.abs((p.lastInstalmentCents ?? 0) - (p.instalmentCents ?? 0)) < n });
    checks.push({ id: 'CALC', text: 'Instalments add up to the plan total', pass: sum === p.totalCents });
    checks.push({ id: 'CALC', text: 'Plan covers the full overdue balance', pass: p.totalCents >= total });
  }
  if (p.type === 'bill_smoothing') {
    checks.push({ id: 'BR-P04', text: 'Bill smoothing: overdue under $500 and 12 months history', pass: billSmoothingAllowed(c) });
  }
  if (p.type === 'part_extension') {
    checks.push({ id: 'BR-P05', text: 'Part payment is less than the balance', pass: (p.upfrontCents ?? 0) > 0 && (p.upfrontCents ?? 0) < total });
  }
  checks.push({ id: 'BR-T02', text: 'Overdue is under the $2,000 AI threshold', pass: total < LIMITS.humanThresholdCents });
  checks.push({ id: 'BR-T03', text: 'No life support registration', pass: !c.flags.lifeSupport });
  return result(checks);
}

// Outbound messages must not reveal balances or account details before identity verification (BR-C01).
export function checkMessage(text: string, verified: boolean): GuardianResult {
  const revealsAmount = /\$\s?\d/.test(text);
  return result([
    { id: 'BR-C01', text: verified ? 'Customer verified; balance may be shown' : 'No balance before verification', pass: verified || !revealsAmount },
  ]);
}

// Every amount the AI states must come from the plan calculator (FR-GRD-06).
export function checkAmounts(text: string, allowedCents: number[]): GuardianResult {
  const found = [...text.matchAll(/\$\s?([\d,]+(?:\.\d{2})?)/g)].map((m) => Math.round(parseFloat(m[1].replace(/,/g, '')) * 100));
  const unknown = found.filter((v) => !allowedCents.includes(v));
  return result([{ id: 'FR-GRD-06', text: unknown.length ? `Unverified amount(s): ${unknown.map((v) => (v / 100).toFixed(2)).join(', ')}` : 'All amounts come from the plan calculator', pass: unknown.length === 0 }]);
}

export type VulnerabilitySignal = 'family_violence' | 'life_support' | 'medical' | 'distress' | 'request_human' | 'dispute';

const SIGNALS: [VulnerabilitySignal, RegExp][] = [
  ['family_violence', /\b(violen\w*|abus\w*|unsafe at home|scared of (him|her|my partner)|hits? me|threaten\w*)\b/i],
  ['life_support', /\b(life support|oxygen|dialysis|ventilator|medical equipment)\b/i],
  ['medical', /\b(hospital|cancer|surgery|chemo|disabilit\w*|illness|sick|mental health|depress\w*)\b/i],
  ['distress', /\b(can'?t cope|hopeless|desperate|suicid\w*|end it|no way out|breaking down|panic)\b/i],
  ['request_human', /\b(real person|human|speak to (someone|somebody|a person)|call me|talk to (someone|a person))\b/i],
  ['dispute', /\b(dispute|wrong bill|overcharged|incorrect bill|not my bill)\b/i],
];

// Conservative keyword screen; anything matched stops collections messaging and escalates (FR-GRD-02/03).
export function detectSignals(text: string): VulnerabilitySignal[] {
  return SIGNALS.filter(([, re]) => re.test(text)).map(([s]) => s);
}

import { addDays } from 'date-fns';
import { avgMonthlyBill, oldestInvoiceDays, totalOverdue } from './customers';
import { dollars } from './money';
import {
  LIMITS, assistArrangement, billSmoothingAllowed, extension, extensionAllowed, fullPayment, instalmentPlan,
} from './plans';
import type { Assessment, Customer, PlanType, RuleHit } from './types';

// Affordability index = average past payment / average monthly bill (BRD 10.2).
export function affordability(c: Customer): Assessment['affordability'] {
  const index = Math.round((c.payment.avgPaymentCents / avgMonthlyBill(c)) * 100) / 100;
  const band = c.flags.hardship || index < 0.6 ? 'Low' : index >= 1 ? 'High' : 'Medium';
  return { index, band };
}

const RULE_TEXT: Record<string, string> = {
  'BR-T01': 'Under $2,000 with no vulnerability flags: AI eligible',
  'BR-T02': '$2,000 or more: Resolution Team sets the arrangement',
  'BR-T03': 'Life support registered: specialist contact only, no automated messages',
  'BR-T04': 'Hardship or vulnerability flag: human specialist',
  'BR-T05': 'Oldest invoice over 90 days: no extension',
  'BR-T06': '2 or more broken arrangements in 6 months: human review',
  'BR-T07': 'Dunning stage 2: priority contact, recommend card',
  'BR-T08': 'Payment in transit: suppress contact until it posts',
  'BR-C05': 'Do-not-contact flag: no outbound contact',
  'BR-P04': 'Bill smoothing only under $500 with 12 months history',
};
const hit = (id: string): RuleHit => ({ id, text: RULE_TEXT[id] });

// Applies the targeting and guardrail rules (BR-T01..T08) in priority order and pre-builds plans.
export function assess(c: Customer, today: Date): Assessment {
  const total = totalOverdue(c);
  const aff = affordability(c);
  const extOk = extensionAllowed(c);
  const first = addDays(today, 1);
  const base = { customerId: c.id, affordability: aff, extensionAllowed: extOk, priority: c.flags.dunningStage === 2 };
  const rules: RuleHit[] = [];

  if (c.flags.lifeSupport) {
    return { ...base, decision: 'human', route: 'Specialist team', segment: 'Life support', eligible: [], reasonCode: 'LS-01',
      reason: 'Life support registered; specialist contact only, no automated collection messages', rules: [hit('BR-T03')] };
  }
  if (c.flags.hardship || c.flags.vulnerability) {
    return { ...base, decision: 'human', route: 'Hardship team', segment: 'Hardship / vulnerable', eligible: [], reasonCode: 'HV-01',
      reason: 'Hardship or vulnerability flag on file; routed to a specialist with support options', rules: [hit('BR-T04')] };
  }
  if (c.flags.doNotContact) {
    return { ...base, decision: 'none', segment: 'Do not contact', eligible: [], reasonCode: 'DN-01',
      reason: 'Customer has asked not to be contacted', rules: [hit('BR-C05')] };
  }
  const transit = c.payment.inTransit;
  if (transit && transit.postedBusinessDaysAgo < LIMITS.paymentInTransitBusinessDays) {
    return { ...base, decision: 'none', segment: 'Payment in transit', eligible: [], reasonCode: 'PT-01',
      reason: `${dollars(transit.cents)} paid by ${transit.method} ${transit.postedBusinessDaysAgo} business days ago; waiting for it to post`,
      rules: [hit('BR-T08')] };
  }
  if (total >= LIMITS.humanThresholdCents) {
    return { ...base, decision: 'human', route: 'Resolution Team', segment: '$2,000 or more', eligible: ['full'],
      draftForHuman: assistArrangement(c, first, 'fortnightly', 12), reasonCode: 'RT-01',
      reason: `Overdue ${dollars(total)} is at or above the $2,000 threshold; AI drafts a plan for the Resolution Team`,
      rules: [hit('BR-T02')] };
  }
  if (c.arrangements.brokenLast6Months >= LIMITS.brokenArrangementsForReview) {
    return { ...base, decision: 'human', route: 'Human review', segment: 'Repeat broken arrangements', eligible: ['full'],
      draftForHuman: assistArrangement(c, first, 'fortnightly', 12), reasonCode: 'HR-01',
      reason: `${c.arrangements.brokenLast6Months} broken arrangements in the last 6 months; human review before a new plan`,
      rules: [hit('BR-T06')] };
  }

  // AI eligible (BR-T01)
  rules.push(hit('BR-T01'));
  if (!extOk) rules.push(hit('BR-T05'));
  if (c.flags.dunningStage === 2) rules.push(hit('BR-T07'));
  const eligible: PlanType[] = ['full'];
  if (extOk) eligible.push('part_extension', 'extension');
  eligible.push('instalment', 'assist');
  if (billSmoothingAllowed(c)) eligible.push('bill_smoothing');
  else if (c.monthsOfHistory >= 12) rules.push(hit('BR-P04'));

  const why: string[] = [`under $2k`];
  if (c.payment.onTimeLast12 >= 10) why.push('good history');
  if (c.payment.onTimeLast12 === 12 && c.arrangements.extensionsHonouredLast12 === 0) why.push('first overdue');
  why.push(`${oldestInvoiceDays(c)} days overdue`);

  let recommended;
  let segment;
  if (aff.band === 'High') {
    recommended = extOk ? extension(c, today, 14) : fullPayment(c);
    segment = extOk ? 'Short-term timing' : 'Able to pay';
    why.push('high affordability');
    if (extOk) why.push('salary-cycle pattern');
  } else if (aff.band === 'Medium') {
    recommended = instalmentPlan(c, first, 'fortnightly', 3);
    segment = extOk ? 'Needs time to pay' : 'Instalments only';
    why.push('medium affordability');
    if (!extOk) why.push('not eligible for extension');
  } else {
    recommended = assistArrangement(c, first, 'fortnightly', 12);
    segment = 'Longer-term support';
    why.push('low affordability');
  }
  if (c.flags.dunningStage === 2) why.push('dunning stage 2, recommend card');

  return { ...base, decision: 'ai', segment, eligible, recommended, reasonCode: `AI-${aff.band[0]}`, reason: why.join('; '), rules };
}

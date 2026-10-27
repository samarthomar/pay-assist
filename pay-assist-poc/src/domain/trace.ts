import { avgMonthlyBill } from './customers';
import { generateOverdueFile, validateFile } from './generate';
import { checkPlan } from './guardian';
import { dollars } from './money';
import { PLAN_LABEL } from './morningRun';
import { assess } from './rules';
import type { Customer } from './types';

// Per-customer decision trace (Phase 5): every step the agents took for one account, with rule IDs,
// so any decision in the demo can be traced back to the rule that produced it.

export type TraceAgent = 'intake' | 'assessment' | 'plan' | 'guardian' | 'engagement' | 'handoff';

export interface TraceStep {
  agent: TraceAgent;
  title: string;
  detail: string;
  rules: string[];
  verdict?: 'allow' | 'block' | 'human';
  checks?: { id: string; text: string; pass: boolean }[];
}

const PLAN_RULES: Record<string, string[]> = {
  full: [], extension: ['BR-P01'], part_extension: ['BR-P01', 'BR-P05'], instalment: ['BR-P02'], assist: ['BR-P03', 'BR-P02'], bill_smoothing: ['BR-P04'],
};

let index: { valid: Customer[]; rejected: { customer: Customer; reason: string }[] } | null = null;
const fileIndex = () => (index ??= validateFile(generateOverdueFile()));

// Search the whole morning file (valid and quarantined) by name or ID.
export function findCustomers(q: string, limit = 8) {
  const t = q.trim().toLowerCase();
  if (t.length < 2) return [];
  const { valid, rejected } = fileIndex();
  const hit = (c: Customer) => c.name.toLowerCase().includes(t) || c.id.toLowerCase().includes(t);
  return [...valid.filter(hit).map((c) => ({ c, quarantined: undefined as string | undefined })),
    ...rejected.filter((r) => hit(r.customer)).map((r) => ({ c: r.customer, quarantined: r.reason }))].slice(0, limit);
}

export function customerById(id: string) {
  const { valid, rejected } = fileIndex();
  const v = valid.find((c) => c.id === id);
  if (v) return { c: v, quarantined: undefined as string | undefined };
  const r = rejected.find((x) => x.customer.id === id);
  return r ? { c: r.customer, quarantined: r.reason } : null;
}

export function buildTrace(c: Customer, today: Date, quarantined?: string): TraceStep[] {
  if (quarantined) {
    return [{ agent: 'intake', title: 'Record quarantined', detail: `${quarantined}. Held back for the data team; no assessment and no contact.`, rules: ['FR-INT-02'], verdict: 'block' }];
  }
  const a = assess(c, today);
  const steps: TraceStep[] = [
    { agent: 'intake', title: 'Record validated', detail: `Contact details present, supply state ${c.state}, ${c.accounts.length} account(s) with positive balances, unique ID.`, rules: ['FR-INT-02'], verdict: 'allow' },
    { agent: 'assessment', title: 'Affordability scored',
      detail: `Average payment ${dollars(c.payment.avgPaymentCents)} ÷ average monthly bill ${dollars(avgMonthlyBill(c))} = ${a.affordability.index.toFixed(2)} → ${a.affordability.band}${c.flags.hardship ? ' (hardship flag forces Low)' : ''}.`,
      rules: ['BRD 10.2'] },
    { agent: 'assessment', title: `Decision: ${a.decision === 'ai' ? 'AI contact' : a.decision === 'human' ? `human (${a.route})` : 'do not contact'}`,
      detail: `${a.reason}. Segment “${a.segment}”, reason code ${a.reasonCode}.`,
      rules: a.rules.map((r) => r.id), verdict: a.decision === 'human' ? 'human' : a.decision === 'none' ? 'block' : 'allow' },
  ];
  const plan = a.recommended ?? a.draftForHuman;
  if (plan) {
    steps.push({ agent: 'plan', title: a.recommended ? `Recommended: ${PLAN_LABEL[plan.type]}` : `Drafted for a person: ${PLAN_LABEL[plan.type]}`,
      detail: `${plan.explanation}${a.recommended ? ` Eligible options: ${a.eligible.map((e) => PLAN_LABEL[e]).join(', ')}.` : ''}`,
      rules: [...(a.extensionAllowed ? [] : ['BR-T05']), ...PLAN_RULES[plan.type]] });
    const g = checkPlan(c, plan, today);
    const onlyHuman = !g.allowed && g.checks.filter((x) => !x.pass).every((x) => x.id === 'BR-T02');
    steps.push({ agent: 'guardian', title: g.allowed ? 'Plan allowed for AI' : onlyHuman ? 'Plan needs human approval' : 'Plan blocked',
      detail: g.allowed ? 'Every arrangement rule passed. The AI may offer this plan.' : onlyHuman ? 'Over the $2,000 AI limit. The AI may draft it, but only a person can approve it.' : 'At least one rule failed. The plan cannot be offered.',
      rules: [...new Set(g.checks.map((x) => x.id))], verdict: g.allowed ? 'allow' : onlyHuman ? 'human' : 'block', checks: g.checks });
  }
  if (a.decision === 'ai') {
    steps.push({ agent: 'engagement', title: 'Contact scheduled', detail: `${c.contact.preferred === 'sms+email' ? 'SMS then email' : c.contact.preferred.toUpperCase()} at 9:00 am with a secure link. No balance before verification.${a.priority ? ' Priority: card recommended.' : ''}`, rules: ['BR-C01', ...(a.priority ? ['BR-T07'] : [])], verdict: 'allow' });
  } else if (a.decision === 'human') {
    steps.push({ agent: 'engagement', title: 'Automated messages suppressed', detail: 'No SMS, email or reminder. A person makes contact.', rules: a.rules.map((r) => r.id), verdict: 'block' });
    steps.push({ agent: 'handoff', title: `Case card sent to ${a.route}`, detail: a.draftForHuman ? 'Includes balances, history, the drafted plan and Copilot suggestions.' : 'Includes balances, flags, history and a suggested call flow.', rules: [], verdict: 'human' });
  } else {
    steps.push({ agent: 'engagement', title: 'No contact today', detail: 'Re-assessed in tomorrow\'s run.', rules: a.rules.map((r) => r.id), verdict: 'block' });
  }
  return steps;
}

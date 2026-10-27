import { describe, expect, it } from 'vitest';
import { persona, totalOverdue } from './customers';
import { FILE_COUNTS, generateOverdueFile, validateFile } from './generate';
import { checkAmounts, checkMessage, checkPlan, detectSignals } from './guardian';
import {
  assistArrangement, billSmoothing, debtComponent, extension, instalmentPlan, partPaymentExtension, planForBudget,
} from './plans';
import { assess } from './rules';
import { morningRun, toCsv } from './morningRun';
import { chatOptions, intent, parseBudget, postingExtension, rankForBudget } from './conversation';
import { copilot, morningCases } from './cases';
import { buildTrace, findCustomers } from './trace';
import { RULE_BOOK } from './ruleBook';
import { checkReschedule, rescueOptions, schedule } from './sustain';
import { PLAN_MIX, REC_MATRIX, ageing, belowTarget, funnel, overallScore } from './kpis';
import { ALL_RULES } from './ruleBook';
import { ESCALATIONS } from './escalation';

const TODAY = new Date(2026, 9, 14); // Wed 14 Oct 2026
const FIRST = new Date(2026, 9, 15); // Thu 15 Oct 2026
const sarah = persona('Sarah');

describe("Sarah's numbers match the demo script", () => {
  it('total overdue is $847.50', () => {
    expect(totalOverdue(sarah)).toBe(84750);
  });

  it('3-month instalment is $231.25 x 6 fortnights', () => {
    const p = instalmentPlan(sarah, FIRST, 'fortnightly', 3);
    expect(p.count).toBe(6);
    expect(p.instalmentCents).toBe(23125);
    expect(p.lastInstalmentCents).toBe(23125);
  });

  it('12-month Assist arrangement is $115.67 x 26, 15 Oct 2026 to 30 Sep 2027', () => {
    const p = assistArrangement(sarah, FIRST, 'fortnightly', 12);
    expect(p.totalCents).toBe(300750);
    expect(p.count).toBe(26);
    expect(p.instalmentCents).toBe(11567);
    expect(p.instalmentCents! * 25 + p.lastInstalmentCents!).toBe(300750);
    expect(p.firstDate).toBe('2026-10-15');
    expect(p.lastDate).toBe('2027-09-30');
    expect(debtComponent(sarah, p)).toBe(3260); // ~$32.60 per fortnight towards the debt
  });

  it('part pay is $200 today and $647.50 by 29 Oct', () => {
    const p = partPaymentExtension(sarah, TODAY);
    expect(p.upfrontCents).toBe(20000);
    expect(p.totalCents - p.upfrontCents!).toBe(64750);
    expect(p.dueDate).toBe('2026-10-29');
  });

  it('a $120 fortnightly budget picks the 12-month plan (6 months is too high)', () => {
    const p = planForBudget(sarah, 12000, 'fortnightly', FIRST)!;
    expect(p.months).toBe(12);
    expect(p.instalmentCents).toBe(11567);
  });

  it('bill smoothing is not eligible for Sarah (overdue over $500)', () => {
    const a = assess(sarah, TODAY);
    expect(a.eligible).not.toContain('bill_smoothing');
    expect(checkPlan(sarah, billSmoothing(sarah, FIRST), TODAY).allowed).toBe(false);
  });
});

describe('Assessment decisions for the demo personas (BRD 6.2)', () => {
  it('Sarah: AI contact, 3-month fortnightly instalment, medium affordability', () => {
    const a = assess(sarah, TODAY);
    expect(a.decision).toBe('ai');
    expect(a.affordability.band).toBe('Medium');
    expect(a.recommended?.type).toBe('instalment');
    expect(a.recommended?.frequency).toBe('fortnightly');
    expect(a.reason).toBe('under $2k; good history; 34 days overdue; medium affordability');
  });

  it('B: AI contact, 14-day extension', () => {
    const a = assess(persona('B'), TODAY);
    expect(a.decision).toBe('ai');
    expect(a.recommended?.type).toBe('extension');
    expect(a.recommended?.dueDate).toBe('2026-10-28');
    expect(a.reason).toContain('first overdue');
  });

  it('C: $2,640 goes to the Resolution Team with an AI-drafted plan', () => {
    const a = assess(persona('C'), TODAY);
    expect(totalOverdue(persona('C'))).toBe(264000);
    expect(a.decision).toBe('human');
    expect(a.route).toBe('Resolution Team');
    expect(a.draftForHuman?.type).toBe('assist');
  });

  it('D: life support goes to a specialist, never AI', () => {
    const a = assess(persona('D'), TODAY);
    expect(a.decision).toBe('human');
    expect(a.route).toBe('Specialist team');
    expect(a.rules[0].id).toBe('BR-T03');
  });

  it('E: invoice 96 days old, instalments only (no extension)', () => {
    const a = assess(persona('E'), TODAY);
    expect(a.decision).toBe('ai');
    expect(a.extensionAllowed).toBe(false);
    expect(a.eligible).not.toContain('extension');
    expect(a.recommended?.type).toBe('instalment');
    expect(a.rules.map((r) => r.id)).toContain('BR-T05');
  });

  it('F: 2 broken extensions, human review', () => {
    const a = assess(persona('F'), TODAY);
    expect(a.decision).toBe('human');
    expect(a.route).toBe('Human review');
  });
});

describe('Guardian', () => {
  it('blocks an extension longer than 21 days', () => {
    const ext = { ...extension(sarah, TODAY, 14), dueDate: '2026-11-05' }; // 22 days
    expect(checkPlan(sarah, ext, TODAY).allowed).toBe(false);
  });

  it('allows Sarah\'s 12-month plan', () => {
    expect(checkPlan(sarah, assistArrangement(sarah, FIRST, 'fortnightly', 12), TODAY).allowed).toBe(true);
  });

  it('blocks a 24-month plan outside Victoria', () => {
    const b = persona('B'); // NSW
    const p = { ...assistArrangement(b, FIRST, 'fortnightly', 12), months: 24 };
    expect(checkPlan(b, p, TODAY).allowed).toBe(false);
  });

  it('blocks balances in messages before verification', () => {
    expect(checkMessage('You owe $847.50', false).allowed).toBe(false);
    expect(checkMessage('You have flexible payment options available', false).allowed).toBe(true);
    expect(checkMessage('Total: $847.50', true).allowed).toBe(true);
  });

  it('blocks amounts not produced by the calculator', () => {
    expect(checkAmounts('That is $115.67 every second Thursday', [11567]).allowed).toBe(true);
    expect(checkAmounts('That is $110.00 every second Thursday', [11567]).allowed).toBe(false);
  });

  it('detects vulnerability signals', () => {
    expect(detectSignals("I'm scared of my partner, he threatened me")).toContain('family_violence');
    expect(detectSignals('Can I speak to a real person?')).toContain('request_human');
    expect(detectSignals('My working hours were cut and I get paid fortnightly')).toEqual([]);
  });
});

describe('Daily overdue file', () => {
  const file = generateOverdueFile();
  const v = validateFile(file);

  it('has 12,457 accounts split 7,214 / 2,931 / 2,312', () => {
    expect(v.total).toBe(FILE_COUNTS.total);
    expect(v.byFuel).toEqual({ elec: 7214, gas: 2931, dual: 2312 });
  });

  it('quarantines the 23 planted defective records', () => {
    expect(v.rejected.length).toBe(23);
    expect(v.valid.length).toBe(12434);
  });

  it('is identical on every run', () => {
    expect(JSON.stringify(generateOverdueFile().records.slice(0, 50))).toBe(JSON.stringify(file.records.slice(0, 50)));
  });

  it('every valid account gets a decision with a reason', () => {
    const results = v.valid.map((c) => assess(c, TODAY));
    expect(results.every((a) => a.reason.length > 0 && a.rules.length > 0)).toBe(true);
    const ai = results.filter((a) => a.decision === 'ai');
    expect(ai.every((a) => checkPlan(v.valid.find((c) => c.id === a.customerId)!, a.recommended!, TODAY).allowed)).toBe(true);
  });
});

describe('Morning run summary (Scene 1)', () => {
  const r = morningRun(TODAY);

  it('adds up: every valid account has exactly one decision', () => {
    expect(r.decisions.ai + r.decisions.human + r.decisions.none).toBe(12434);
    expect(r.rejected.length).toBe(23);
  });

  it('Guardian vetoes draft extensions on invoices over 90 days, and every final AI plan passes', () => {
    expect(r.guardian.blockedDrafts).toBeGreaterThan(0);
    expect(r.guardian.allowed).toBe(r.decisions.ai);
    expect(r.guardian.messageAllowed).toBe(true);
  });

  it('exports a CSV with a header and one line per account', () => {
    const csv = toCsv(r.rows.slice(0, 3));
    expect(csv.split('\r\n').length).toBe(4);
    expect(csv).toContain('Sarah Mitchell');
  });
});

describe('Pay Assist chat understanding (Scene 2 and 3)', () => {
  it("understands Sarah's sentence: fortnightly, from 15 October, $120", () => {
    const b = parseBudget('Fortnightly, from 15th of October. Around $120 a fortnight is okay.', TODAY);
    expect(b).toEqual({ freq: 'fortnightly', amountCents: 12000, firstDate: '2026-10-15', weekday: 4 });
  });

  it('recognises intents and falls back safely', () => {
    expect(intent("I've already paid")).toBe('already_paid');
    expect(intent('Option 3 is a bit too high for me. Can I get more time?')).toBe('more_time');
    expect(intent('can I talk to someone')).toBe('human');
    expect(intent('purple elephants')).toBeNull();
  });

  it('offers Sarah 4 options and explains why bill smoothing is missing', () => {
    const { plans, notes } = chatOptions(sarah, TODAY);
    expect(plans.map((p) => p.type)).toEqual(['full', 'part_extension', 'instalment', 'assist']);
    expect(notes.join(' ')).toContain('Bill smoothing');
  });

  it('Tom (invoice 96 days) gets no part pay + extension option', () => {
    expect(chatOptions(persona('E'), TODAY).plans.map((p) => p.type)).not.toContain('part_extension');
  });

  it('$120 picks 12 months; Sarah can go to 24 months in VIC, Liam only 12 in NSW', () => {
    const r = rankForBudget(sarah, 12000, 'fortnightly', FIRST);
    expect(r.fit?.months).toBe(12);
    expect(r.all.map((p) => p.months)).toEqual([6, 12, 18, 24]);
    expect(rankForBudget(persona('B'), 1000, 'fortnightly', FIRST).all.map((p) => p.months)).toEqual([6, 12]);
  });

  it('already paid by PayPal: extension within 21 days that the Guardian allows', () => {
    const p = postingExtension(sarah, TODAY, 'paypal');
    expect(checkPlan(sarah, p, TODAY).allowed).toBe(true);
  });
});

describe('Protect: human queues and Copilot (Scenes 4 to 6)', () => {
  const { cases, totals } = morningCases(TODAY);
  const byId = (id: string) => cases.find((k) => k.id === id)!;

  it('queues match the morning run and the demo customers come first', () => {
    expect(Object.values(totals).reduce((s, v) => s + v, 0)).toBe(1711);
    expect(cases.slice(0, 3).map((k) => k.c.persona)).toEqual(['C', 'D', 'F']);
  });

  it('Priya ($2,640) is an approval case with a drafted plan that only needs the human sign-off', () => {
    const k = byId('CASE-100817');
    expect(k.kind).toBe('approve');
    const failed = checkPlan(k.c, k.a.draftForHuman!, TODAY).checks.filter((x) => !x.pass).map((x) => x.id);
    expect(failed).toEqual(['BR-T02']);
    const cp = copilot(k, TODAY, 'Alex');
    expect(cp.suggestions[1].plan?.months).toBe(24); // VIC allows a lower 24-month option
    expect(cp.watchouts.join(' ')).toContain('BR-T02');
  });

  it('Margaret (life support) is a call case, never messaged', () => {
    const k = byId('CASE-100818');
    expect(k.kind).toBe('call');
    expect(k.priority).toBe(true);
    expect(copilot(k, TODAY, 'Alex').facts).toContainEqual(['Automated messages sent', '0 (suppressed by the Engagement agent)']);
  });

  it('a family violence handover gives safety-first replies with no amounts', () => {
    const k = { ...byId('CASE-100818'), kind: 'live' as const, esc: ESCALATIONS['ESC-03'], signal: 'family_violence' as const };
    const cp = copilot(k, TODAY, 'Alex');
    expect(cp.replies!.join(' ')).toContain('1800 737 732');
    expect(cp.replies!.some((r) => /\$\d/.test(r))).toBe(false);
  });
});

describe('Decision traces (Phase 5: every decision traceable to a rule)', () => {
  it("Sarah's trace runs intake → assessment → plan → guardian → engagement", () => {
    const t = buildTrace(sarah, TODAY);
    expect(t.map((s) => s.agent)).toEqual(['intake', 'assessment', 'assessment', 'plan', 'guardian', 'engagement']);
    expect(t[1].detail).toContain('0.75');
    expect(t[4].verdict).toBe('allow');
  });

  it('Priya needs a person: the Guardian step says human, not blocked', () => {
    const t = buildTrace(persona('C'), TODAY);
    expect(t.find((s) => s.agent === 'guardian')!.verdict).toBe('human');
    expect(t[t.length - 1].title).toContain('Resolution Team');
  });

  it('quarantined records trace to the intake rule', () => {
    const q = validateFile(generateOverdueFile()).rejected[0];
    expect(findCustomers(q.customer.id).some((x) => x.quarantined)).toBe(true);
    const t = buildTrace(q.customer, TODAY, q.reason);
    expect(t).toHaveLength(1);
    expect(t[0].verdict).toBe('block');
  });

  it('every rule ID in every trace has a plain-English explanation', () => {
    const v = validateFile(generateOverdueFile()).valid;
    const ids = new Set(v.filter((_, i) => i % 25 === 0).flatMap((c) => buildTrace(c, TODAY).flatMap((s) => s.rules)));
    expect([...ids].filter((id) => !RULE_BOOK[id])).toEqual([]);
  });
});

describe('Sustain: failed payment rescue (Scene 7)', () => {
  const plan = assistArrangement(sarah, FIRST, 'fortnightly', 12);

  it('payment 2 is Thu 29 Oct; rescue offers Mon 2 Nov and Thu 5 Nov', () => {
    expect(schedule(plan)[1]).toBe('2026-10-29');
    expect(rescueOptions(plan, 1)).toEqual(['2026-11-02', '2026-11-05']);
  });

  it('the Guardian allows a move within 7 days and before the next instalment, and blocks anything later', () => {
    expect(checkReschedule(plan, 1, '2026-11-02').allowed).toBe(true);
    expect(checkReschedule(plan, 1, '2026-11-06').allowed).toBe(false); // 8 days
    expect(checkReschedule(plan, 1, '2026-10-29').allowed).toBe(false); // not later
  });

  it('reminder and rescue texts reveal no amounts (BR-C01)', () => {
    expect(checkMessage("Hi Sarah, your plan payment today didn't go through. Reply 1 to try again Mon 2 Nov.", false).allowed).toBe(true);
    expect(checkMessage('Your payment of $115.67 failed', false).allowed).toBe(false);
  });
});

describe('Results and Ask the agents (Phase 7)', () => {
  const r = morningRun(TODAY);

  it('the weighted scorecard is 91, as in the demo script', () => {
    expect(overallScore()).toBe(91);
  });

  it('4 KPIs are below target, matching the script (amber)', () => {
    expect(belowTarget().map((k) => k.name)).toEqual(['Arrangement adherence (30 days)', 'Affordability accuracy', 'Vulnerability detection', 'Warm-transfer success']);
  });

  it('the recommendation matrix matches 63% acceptance and the 22/18/41/19 plan mix', () => {
    const diag = REC_MATRIX.cells.reduce((s, row, i) => s + row[i], 0);
    const cols = REC_MATRIX.labels.map((_, j) => REC_MATRIX.cells.reduce((s, row) => s + row[j], 0));
    expect(diag).toBe(63);
    expect(cols).toEqual(PLAN_MIX.map(([, v]) => v));
  });

  it('funnel starts from today\'s real AI contacts; ageing covers all overdue debt', () => {
    expect(funnel(r)[0][1]).toBe(r.decisions.ai);
    const total = r.rows.reduce((s, x) => s + x.overdueCents, 0);
    expect(ageing(r).reduce((s, b) => s + b.before, 0)).toBe(total);
  });

});

describe('Rule book', () => {
  it('every rule has a plain explanation, an example and where to see it; codes are unique', () => {
    expect(new Set(ALL_RULES.map((r) => r.id)).size).toBe(ALL_RULES.length);
    ALL_RULES.forEach((r) => expect(r.simple && r.example && r.where && r.source).toBeTruthy());
  });

  it('covers every hand-over rule, and marks BR-S01 as proposed', () => {
    Object.keys(ESCALATIONS).forEach((id) => expect(RULE_BOOK[id]).toBeTruthy());
    expect(ALL_RULES.find((r) => r.id === 'BR-S01')!.source).toContain('Proposed');
  });

  it('a "speak to someone" handover is not treated as a safety case', () => {
    const { cases } = morningCases(TODAY);
    const base = cases.find((k) => k.id === 'CASE-100817')!;
    const asked = copilot({ ...base, kind: 'live', esc: ESCALATIONS['ESC-04'] }, TODAY, 'Alex');
    expect(asked.headline).not.toContain('do not discuss the debt');
    const safety = copilot({ ...base, kind: 'live', esc: ESCALATIONS['ESC-03'], signal: 'family_violence' }, TODAY, 'Alex');
    expect(safety.headline).toContain('do not discuss the debt');
  });
});

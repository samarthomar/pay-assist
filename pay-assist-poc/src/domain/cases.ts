import { addDays, format, parseISO } from 'date-fns';
import { avgMonthlyBill, oldestInvoiceDays, totalOverdue } from './customers';
import type { Escalation } from './escalation';
import type { VulnerabilitySignal } from './guardian';
import { dollars } from './money';
import { morningRun } from './morningRun';
import {
  ASSIST_LENGTHS, PERIODS_PER_YEAR, assistArrangement, extension, extensionAllowed, instalmentPlan, maxAssistMonths,
} from './plans';
import type { Assessment, Customer, Frequency, Plan } from './types';

// The human-in-the-loop queue (Protect stage): cases from the morning run plus live handovers from the chat.

export type CaseKind = 'approve' | 'call' | 'live';
export type Team = 'Resolution Team' | 'Specialist team' | 'Hardship team' | 'Human review';

export interface Case {
  id: string;
  c: Customer;
  a: Assessment;
  team: Team | 'Specialist (priority)';
  kind: CaseKind;
  priority: boolean;
  reason: string;
  waiting: string;
  esc?: Escalation;
  signal?: VulnerabilitySignal;
}

const kindFor = (team: string): CaseKind => (team === 'Resolution Team' || team === 'Human review' ? 'approve' : 'call');

// The demo personas first, then a sample of each team's queue from the morning run.
export function morningCases(today: Date, perTeam = 6): { cases: Case[]; totals: Record<string, number> } {
  const r = morningRun(today);
  const human = r.rows.filter((x) => x.a.decision === 'human');
  const pick = [...human.filter((x) => x.c.persona), ...(['Resolution Team', 'Specialist team', 'Hardship team', 'Human review'] as Team[])
    .flatMap((t) => human.filter((x) => !x.c.persona && x.a.route === t).slice(0, perTeam))];
  const cases = pick.map(({ c, a }, i): Case => ({
    id: `CASE-${c.id.slice(3)}`, c, a, team: a.route as Team, kind: kindFor(a.route!), priority: a.priority || c.flags.lifeSupport,
    reason: a.reason, waiting: `${7 + ((i * 7) % 50)} min`,
  }));
  return { cases, totals: r.routes };
}

export const planOptions = (c: Customer, today: Date, freq: Frequency): Plan[] => {
  const first = addDays(today, 1);
  return [
    ...(extensionAllowed(c) ? [extension(c, today, 14)] : []),
    instalmentPlan(c, first, freq, 3),
    ...ASSIST_LENGTHS.filter((m) => m <= maxAssistMonths(c)).map((m) => assistArrangement(c, first, freq, m)),
  ];
};

// Monthly equivalent of a plan, to compare with what the customer usually pays.
export const monthlyEquivalent = (p: Plan) =>
  p.instalmentCents && p.frequency ? Math.round((p.instalmentCents * PERIODS_PER_YEAR[p.frequency]) / 12) : p.totalCents;

export interface Copilot {
  headline: string;
  facts: [string, string][];
  suggestions: { title: string; text: string; plan?: Plan }[];
  watchouts: string[];
  script?: string[];
  replies?: string[];
  notes: (outcome: string) => string;
}

// The Handoff agent's Copilot: briefs the specialist and drafts their work. Deterministic, built from case data.
export function copilot(k: Case, today: Date, specialist: string): Copilot {
  const { c, a } = k;
  const total = totalOverdue(c);
  const usual = c.payment.avgPaymentCents;
  const bill = avgMonthlyBill(c);
  const facts: [string, string][] = [
    ['Overdue', `${dollars(total)}${c.accounts.length > 1 ? ` (${c.accounts.map((x) => `${x.fuel === 'gas' ? 'gas' : 'elec'} ${dollars(x.overdueCents)}`).join(', ')})` : ''}`],
    ['Oldest bill', `${oldestInvoiceDays(c)} days`],
    ['Usual payment vs average bill', `${dollars(usual)} vs ${dollars(bill)} a month (index ${a.affordability.index.toFixed(2)})`],
    ['Paid on time', `${c.payment.onTimeLast12} of 12 · ${c.payment.failedLast12} failed`],
    ['Broken plans (6 months)', String(c.arrangements.brokenLast6Months)],
    ['Concession', c.flags.concession ? 'Yes, on file' : 'None on file'],
  ];

  // Any other live handover (asked for a person, medical, hardship, bill dispute): full context, normal service.
  if (k.kind === 'live' && k.esc && k.esc.id !== 'ESC-03') {
    const esc = k.esc;
    return {
      headline: `${c.firstName} was handed over from the chat: ${esc.trigger.toLowerCase()}. The whole conversation came with the case, so ${c.firstName} won't need to repeat anything.`,
      facts: [...facts, ['Handover rule', `${esc.id} → ${esc.routeTo}`]],
      suggestions: [
        { title: 'Pick up where Pay Assist stopped', text: 'Read the conversation, then greet the customer by name.' },
        { title: esc.id === 'ESC-08' ? 'Pause collection on the disputed amount' : esc.id === 'ESC-02' ? 'Check for life support or medical needs' : 'Offer the options the customer was shown', text: esc.id === 'ESC-08' ? 'Send the bill to the billing team to review.' : esc.id === 'ESC-02' ? 'Confirm any medical equipment and register it if needed.' : 'They are in the case card; the calculator can recalculate any of them.' },
      ],
      watchouts: ['Do not ask the customer to repeat what they already said', 'Any plan you agree must still pass the Guardian checks'],
      replies: [
        `Hi ${c.firstName}, I'm ${specialist}. I've read your conversation with Pay Assist, so you won't need to repeat anything.`,
        'How can I help you today?',
        'Would you like me to go through the payment options with you?',
      ],
      notes: (o) => `Live chat handover (${esc.id}: ${esc.trigger}). Full transcript received. ${o}. Specialist: ${specialist}.`,
    };
  }

  if (k.kind === 'live') {
    const fv = k.signal === 'family_violence';
    return {
      headline: fv ? 'Possible family violence disclosed in chat. Safety first: do not discuss the debt.' : 'Customer showed signs of distress in chat. Wellbeing first: do not discuss the debt.',
      facts: [['Disclosure', fv ? 'Family violence language' : 'Distress language'], ['Collections', 'Stopped by the Guardian at the moment of disclosure'], ['Context shared', 'Minimal safety summary (ESC-03)']],
      suggestions: [
        { title: 'Pause collections for 30 days', text: 'No reminders, no outbound collections contact. Reviewed by a specialist before it ends.' },
        { title: 'Protect the account', text: fv ? 'Add a family violence flag: details are hidden from general view and contact goes only to the customer\'s safe channel.' : 'Add a vulnerability flag so future contact is handled by a specialist.' },
        { title: 'Offer support, not a plan', text: fv ? 'Share 1800RESPECT (1800 737 732). If in immediate danger, call 000.' : 'Share Lifeline (13 11 14). If in immediate danger, call 000.' },
      ],
      watchouts: ['Ask if it is safe to talk before anything else', 'Never mention the balance or a payment date in this conversation', 'Do not contact other people on the account'],
      replies: [
        `Hi ${c.firstName}, I'm ${specialist} from our specialist support team. Thank you for telling us. Are you safe to talk right now?`,
        "We've paused everything on your account, so there's nothing you need to pay or do today.",
        fv ? 'If you would like to talk to someone, 1800RESPECT is there 24/7 on 1800 737 732. If you are in danger right now, please call 000.'
          : 'If you need someone to talk to, Lifeline is there 24/7 on 13 11 14. If you are in danger right now, please call 000.',
        'Is there a safe way and time for us to contact you next?',
      ],
      notes: (o) => `Live chat handover (ESC-03). ${fv ? 'Possible family violence' : 'Distress'} disclosed; collections stopped automatically. ${o}. No discussion of the debt. Specialist: ${specialist}.`,
    };
  }

  if (k.kind === 'approve') {
    const freq: Frequency = 'fortnightly';
    const opts = planOptions(c, today, freq).filter((p) => p.type === 'assist');
    const draft = a.draftForHuman ?? opts[1] ?? opts[0];
    const lowest = opts[opts.length - 1];
    const suggestions: Copilot['suggestions'] = [
      { title: `Approve as drafted: ${dollars(draft.instalmentCents!)} a fortnight for ${draft.months} months`, text: `Clears ${dollars(total)} by ${format(parseISO(draft.lastDate!), 'MMM yyyy')} and covers ongoing usage. About ${dollars(monthlyEquivalent(draft))} a month.`, plan: draft },
    ];
    if (lowest.months !== draft.months) {
      suggestions.push({ title: `Lower option: ${dollars(lowest.instalmentCents!)} a fortnight for ${lowest.months} months`, text: `Lowest regular payment allowed in ${c.state}. Consider it because ${c.firstName}'s usual payment (${dollars(usual)} a month) is below the average bill.`, plan: lowest });
    }
    const watchouts: string[] = [];
    if (total >= 200_000) watchouts.push('Over $2,000: the AI cannot set this plan. Your approval is required (BR-T02)');
    if (c.arrangements.brokenLast6Months >= 2) watchouts.push(`${c.arrangements.brokenLast6Months} broken plans in 6 months: confirm the amount is realistic before approving`);
    if (c.payment.failedLast12) watchouts.push(`${c.payment.failedLast12} failed payment(s) this year: suggest direct debit on payday`);
    if (!c.flags.concession) watchouts.push('No concession on file: ask whether the customer holds a concession card');
    return {
      headline: `${c.firstName} needs a plan the AI isn't allowed to set on its own. The Plan agent has drafted one for you to approve, edit or reject.`,
      facts, suggestions, watchouts,
      notes: (o) => `${o}. Plan drafted by the Plan agent from the morning assessment (${a.reasonCode}); reviewed and approved by ${specialist}. Customer notified by SMS and email.`,
    };
  }

  // Specialist / hardship call
  const inst = instalmentPlan(c, addDays(today, 1), 'fortnightly', 3);
  const ext = extensionAllowed(c) ? extension(c, today, 14) : null;
  const ls = c.flags.lifeSupport;
  return {
    headline: ls
      ? `${c.firstName} is registered for life support. No automated messages were sent. A specialist calls instead.`
      : `${c.firstName} has a hardship or vulnerability flag. Offer support first, then options.`,
    facts: [...facts, ['Automated messages sent', '0 (suppressed by the Engagement agent)']],
    suggestions: [
      ...(ext ? [{ title: `Short extension: ${dollars(total)} by ${format(parseISO(ext.dueDate!), 'd MMM')}`, text: '14 days, within the 21-day limit.', plan: ext }] : []),
      { title: `Instalments: ${dollars(inst.instalmentCents!)} a fortnight for 3 months`, text: 'Covers the overdue amount and usage.', plan: inst },
      { title: 'Hardship programme', text: 'Pause collections and review bills, concessions and energy use together.' },
    ],
    watchouts: ls
      ? ['Disconnection protections apply while life support is registered', 'Confirm the equipment is still in use and the registration details are current', 'Speak only with the account holder or authorised person']
      : ['Ask about concessions and government support', 'Do not offer a plan the customer says they cannot afford'],
    script: ls
      ? [`Hi, may I speak with ${c.name}? I'm calling from AGL's specialist team about your gas account.`,
        'Before anything else, can I check the life support equipment at your home is still in use?',
        'Your supply is protected while you are registered, so there is no risk of disconnection while we work this out.',
        'There is a balance we can help you with. Would a short extension or smaller fortnightly payments suit you better?']
      : [`Hi ${c.firstName}, I'm calling from AGL's support team. How are things going for you at the moment?`,
        'We have a hardship programme that can pause collections while we look at your bills together.',
        'Would you like to hear about the options?'],
    notes: (o) => `Outbound specialist call. ${ls ? 'Life support registration confirmed; disconnection protections explained. ' : ''}Outcome: ${o}${o === 'Extension agreed' && ext ? ` (${dollars(total)} by ${format(parseISO(ext.dueDate!), 'd MMM')})` : o === 'Instalments agreed' ? ` (${dollars(inst.instalmentCents!)} fortnightly × ${inst.count}, from ${format(parseISO(inst.firstDate!), 'd MMM')})` : ''}. Specialist: ${specialist}.`,
  };
}

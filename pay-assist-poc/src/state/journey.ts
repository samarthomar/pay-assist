import { create } from 'zustand';
import { addDays, format, parseISO } from 'date-fns';
import { avgMonthlyBill, persona, totalOverdue } from '../domain/customers';
import {
  POSTING, allowedAmounts, cadence, chatOptions, intent, longDate, nextDates, parseBudget, postingExtension, rankForBudget, WEEKDAYS,
} from '../domain/conversation';
import { ESCALATIONS, escalationForSignal, type Escalation } from '../domain/escalation';
import { checkAmounts, checkMessage, checkPlan, detectSignals, type VulnerabilitySignal } from '../domain/guardian';
import { dollars } from '../domain/money';
import { debtComponent } from '../domain/plans';
import { assess } from '../domain/rules';
import type { Customer, Frequency, Plan } from '../domain/types';
import { DEMO_NOW, useApp } from './store';
import type { AgentId } from './stages';

// Sarah's journey (Scenes 2 and 3): notifications, verification and the Pay Assist chat, as a small state machine.
// Customer-facing text is scripted; every amount comes from the plan calculator and every AI message passes the Guardian.

export type JourneyPersona = 'Sarah' | 'B' | 'E';
export type Screen = 'lock' | 'sms' | 'email' | 'verify' | 'chat' | 'confirm-email';

export type Card =
  | { kind: 'balance' }
  | { kind: 'options'; plans: Plan[]; notes: string[] }
  | { kind: 'plan'; plan: Plan; title: string; lines: string[] }
  | { kind: 'ranked'; plans: Plan[]; best: number }
  | { kind: 'summary'; plan: Plan; rows: [string, string][] }
  | { kind: 'paypage'; method: 'newcard' | 'debit' | 'paypal' }
  | { kind: 'done'; ref: string; lines: string[] }
  | { kind: 'rating' }
  | { kind: 'handoff'; esc: Escalation }
  | { kind: 'slider' };

export interface Msg { id: number; from: 'ai' | 'customer' | 'system' | 'human'; text?: string; card?: Card; name?: string }
export interface Reply { label: string; go: () => void; primary?: boolean }
export interface Behind { id: number; at: string; agent: AgentId; text: string; tool?: string; verdict?: 'allow' | 'block' }

interface Ctx {
  freq?: Frequency;
  weekday?: number;
  firstDate?: string;
  budgetCents?: number;
  offered: Plan[];
  chosen?: Plan;
  failures: number;
  ended?: 'done' | 'handoff' | 'failed-auth';
  handoff?: { esc: Escalation; signal?: VulnerabilitySignal; at: string; joined?: string };
  rating?: number;
}

interface JourneyState {
  who: JourneyPersona;
  screen: Screen;
  sent: boolean;
  dobTries: number;
  otpSent: boolean;
  otpTries: number;
  verified: boolean;
  authError?: string;
  confirmEmail: boolean;
  messages: Msg[];
  replies: Reply[];
  input: 'text' | 'none';
  placeholder: string;
  typing: boolean;
  awaitBudget: boolean;
  behind: Behind[];
  ctx: Ctx;
  failPayment: boolean;
  set: (p: Partial<JourneyState>) => void;
}

const today = new Date(DEMO_NOW.getFullYear(), DEMO_NOW.getMonth(), DEMO_NOW.getDate());
export const OTP = '482913';
export const REF = (c: Customer) => `PA-2026-${c.id.slice(3)}`;

const blank = (who: JourneyPersona = 'Sarah') => ({
  who, screen: 'lock' as Screen, sent: false, dobTries: 0, otpSent: false, otpTries: 0, verified: false, authError: undefined,
  confirmEmail: false, messages: [] as Msg[], replies: [] as Reply[], input: 'none' as const, placeholder: '', typing: false, awaitBudget: false,
  behind: [] as Behind[], ctx: { offered: [], failures: 0 } as Ctx,
});

export const useJourney = create<JourneyState>((set) => ({
  ...blank(),
  failPayment: false,
  set: (p) => set(p),
}));

const J = () => useJourney.getState();
export const customer = () => persona(J().who);
let nextId = 1;
let epoch = 0; // bumps on restart so queued messages from an old run are dropped
let clock = 0; // minutes after 9:00 for the phone-side timeline

const NAMES: Record<AgentId, string> = {
  orchestrator: 'Orchestrator', intake: 'Intake', assessment: 'Assessment', engagement: 'Engagement', payassist: 'Pay Assist',
  plan: 'Plan', guardian: 'Guardian', handoff: 'Handoff', sustain: 'Sustain', insights: 'Insights',
};

export const phoneTime = () => format(addDays(new Date(2026, 9, 14, 9, clock), 0), 'H:mm');

function behind(agent: AgentId, text: string, tool?: string, verdict?: Behind['verdict']) {
  const e: Behind = { id: nextId++, at: phoneTime(), agent, text, tool, verdict };
  J().set({ behind: [e, ...J().behind] });
  const app = useApp.getState();
  if (tool) app.addTrace(agent, tool, text, verdict);
  app.log(agent === 'guardian' ? 'guardian' : 'agent', NAMES[agent], text);
}

function customerSays(text: string) {
  clock += 1;
  J().set({ messages: [...J().messages, { id: nextId++, from: 'customer', text }], replies: [] });
  useApp.getState().log('customer', customer().firstName, text);
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
let queue: Promise<void> = Promise.resolve();

// Queue an AI message. The Guardian checks wording and amounts before it is shown (FR-GRD-01/06).
function say(text: string | undefined, card?: Card, extraAllowed: number[] = []) {
  const my = epoch;
  queue = queue.then(async () => {
    if (my !== epoch) return;
    J().set({ typing: true });
    useApp.getState().setAgent('payassist', 'working', 'Pay Assist: talking with ' + customer().firstName);
    await wait(text && text.length > 120 ? 900 : 650);
    if (my !== epoch) return;
    if (text) {
      const c = customer();
      const allowed = [...allowedAmounts(c, J().ctx.offered), ...extraAllowed];
      const m = checkMessage(text, J().verified);
      const a = checkAmounts(text, allowed);
      if (!m.allowed || !a.allowed) {
        behind('guardian', `Blocked a draft message: ${[...m.checks, ...a.checks].filter((k) => !k.pass).map((k) => k.text).join('; ')}`, 'check_message()', 'block');
        J().set({ typing: false });
        return;
      }
      if (/\$\d/.test(text)) behind('guardian', 'Message allowed: every amount came from the plan calculator', 'check_amounts()', 'allow');
    }
    J().set({ typing: false, messages: [...J().messages, { id: nextId++, from: 'ai', text, card }] });
  });
  return queue;
}

let lastReplies: Reply[] = [];

function ask(replies: Reply[], placeholder = 'Type a message…') {
  const my = epoch;
  if (replies.length) lastReplies = replies;
  queue = queue.then(() => {
    if (my !== epoch) return;
    J().set({ replies, input: 'text', placeholder });
    useApp.getState().setAgent('payassist', 'done', `Pay Assist: waiting for ${customer().firstName}`);
  });
}

// ---------- journey control ----------

export function restart(who: JourneyPersona = J().who) {
  epoch++;
  clock = 0;
  pending = null;
  lastReplies = [];
  queue = Promise.resolve();
  J().set({ ...blank(who) });
}

export function sendMessages() {
  const c = customer();
  const a = assess(c, today);
  J().set({ sent: true });
  behind('engagement', `Channel: SMS first, email 2 minutes later (preference ${c.contact.preferred === 'sms+email' ? 'SMS + email' : c.contact.preferred})`, 'choose_channel()');
  behind('engagement', 'Send time 9:00 am: inside permitted contact hours (8 am to 8 pm)', 'schedule_contact()');
  behind('guardian', 'SMS and email allowed: no balance or account details before verification (BR-C01)', 'check_message(verified=false)', 'allow');
  if (a.priority) behind('engagement', 'Dunning stage 2: marked priority, card recommended for faster posting (BR-T07)');
  behind('engagement', `SMS delivered to ${c.contact.mobile}; email delivered to ${c.contact.email ?? 'n/a'}`, 'send_notifications()');
}

export function openScreen(screen: Screen) {
  if (screen !== J().screen && screen !== 'lock') clock += 1;
  if (screen === 'verify' && J().screen !== 'verify') behind('engagement', 'Secure link opened: click tracked', 'track_click()');
  if (screen === 'email' && J().screen !== 'email') behind('engagement', 'Email opened: open tracked');
  J().set({ screen });
}

export function submitDob(value: string) {
  const c = customer();
  const [y, m, d] = c.dob.split('-');
  if (value.trim() !== `${d}/${m}/${y}`) {
    const tries = J().dobTries + 1;
    J().set({ dobTries: tries, authError: 'That date of birth doesn\'t match our records. Please check and try again.' });
    behind('guardian', `Date of birth did not match (attempt ${tries})`, 'verify_dob()', 'block');
    return;
  }
  J().set({ otpSent: true, authError: undefined });
  behind('guardian', 'Date of birth matched', 'verify_dob()', 'allow');
  behind('engagement', `One-time code sent to mobile ending ${c.contact.mobile?.slice(-3)}`, 'send_otp()');
}

export function submitOtp(value: string) {
  if (value.trim() === OTP) {
    J().set({ verified: true, authError: undefined });
    behind('guardian', 'Identity verified: balance may now be shown', 'verify_otp()', 'allow');
    behind('payassist', `Account context loaded: ${customer().accounts.length} contract account(s), morning assessment attached`, 'load_context()');
    return;
  }
  const tries = J().otpTries + 1;
  if (tries >= 3) {
    J().set({ otpTries: tries, authError: ESCALATIONS['ESC-06'].customerMessage, ctx: { ...J().ctx, ended: 'failed-auth' } });
    behind('guardian', 'Verification failed 3 times: journey ended, attempt log sent to the contact centre (ESC-06)', 'verify_otp()', 'block');
    return;
  }
  J().set({ otpTries: tries, authError: `That code isn't right. You have ${3 - tries} attempt${3 - tries === 1 ? '' : 's'} left.` });
  behind('guardian', `Incorrect code (attempt ${tries} of 3)`, 'verify_otp()', 'block');
}

// Presenter shortcut for jumping straight into the chat.
export function skipToChat() {
  if (!J().sent) sendMessages();
  J().set({ verified: true, otpSent: true });
  behind('guardian', 'Identity verified (presenter shortcut)', 'verify_otp()', 'allow');
  startChat();
}

// ---------- the conversation ----------

export function startChat() {
  if (J().messages.length) { J().set({ screen: 'chat' }); return; }
  const c = customer();
  clock = Math.max(clock, 4);
  J().set({ screen: 'chat' });
  behind('payassist', `Chat session ${REF(c).replace('PA', 'S')} started`, 'start_session()');
  say(`Hi ${c.firstName}, welcome back! 👋`);
  say(`I'm Pay Assist, your digital assistant for your gas and electricity account. I'm here to help you find a payment option that suits you. There's no pressure, and we can go at your pace.`);
  say(`I can see there's an overdue balance on your account:`, { kind: 'balance' });
  say('Would you like me to show you the payment options available to you?');
  ask(mainChoices());
}

const mainChoices = (): Reply[] => [
  { label: 'Yes, show me my options', go: () => { customerSays('Yes, show me my options'); showOptions(); }, primary: true },
  { label: "I've already paid", go: () => { customerSays("I've already paid"); alreadyPaid(); } },
  { label: "I'm having trouble paying right now", go: () => { customerSays("I'm having trouble paying right now"); trouble(); } },
  { label: "I'd like to speak to someone", go: () => { customerSays("I'd like to speak to someone"); handoff(ESCALATIONS['ESC-04']); } },
];

// Free text typed by the presenter. Safety signals always win; then intent; otherwise a safe fallback to buttons.
export function typed(text: string) {
  if (!text.trim()) return;
  if (J().ctx.handoff?.joined) { customerSays(text); return; } // a person is now in the chat; the AI stays silent
  if (J().ctx.ended) return;
  customerSays(text);
  const signals = detectSignals(text).filter((s) => s !== 'request_human');
  if (signals.length) {
    behind('guardian', `Vulnerability signal detected (${signals.join(', ')}): collections messaging stopped`, 'detect_signals()', 'block');
    return handoff(escalationForSignal(signals[0]), signals[0]);
  }
  if (pending === 'situation') return situation(text);
  if (pending === 'budget') return budget(text);
  if (pending === 'reference') return reference(text);
  const i = intent(text);
  if (i === 'human') return handoff(ESCALATIONS['ESC-04']);
  if (i === 'already_paid') return alreadyPaid();
  if (i === 'trouble') return trouble();
  if (i === 'more_time' && J().ctx.offered.length) return probe();
  if (i === 'unsure' && J().ctx.chosen) return notSure();
  if (i === 'change' && J().ctx.chosen) return probe(true);
  if ((i === 'yes' || i === 'options') && pending === 'recommend' && J().ctx.chosen) return summary(J().ctx.chosen!);
  if (i === 'options' || i === 'yes') return showOptions();
  say("Sorry, I didn't quite catch that. You can tap one of the options below, or tell me in a few words.");
  ask(lastReplies.length ? lastReplies : mainChoices());
}

let pending: 'situation' | 'budget' | 'reference' | 'recommend' | null = null;

function trouble() {
  const c = customer();
  pending = 'situation';
  say(`I'm sorry to hear that, ${c.firstName}. Thank you for telling me. You're not alone, and I'm here to support you.`);
  say('Can I ask a little about your situation so I can suggest the right option?');
  const pick = (t: string) => () => { customerSays(t); situation(t); };
  ask([
    { label: 'My working hours were cut and I get paid fortnightly', go: pick('My working hours were cut and I get paid fortnightly.'), primary: true },
    { label: 'Lost my job / reduced income', go: pick('Lost my job / reduced income') },
    { label: 'Unexpected expenses', go: pick('Unexpected expenses') },
    { label: 'Medical or personal circumstances', go: () => { customerSays('Medical or personal circumstances'); handoff(ESCALATIONS['ESC-02']); } },
    { label: 'Prefer not to say', go: pick('Prefer not to say') },
  ], 'Tell me in your own words…');
}

function situation(text: string) {
  pending = null;
  const signals = detectSignals(text);
  if (signals.length) return handoff(escalationForSignal(signals[0]), signals[0]);
  const b = parseBudget(text, today);
  if (b.freq) J().set({ ctx: { ...J().ctx, freq: b.freq } });
  behind('guardian', 'Vulnerability screen: no high-risk signals (medical, life support, family violence, distress, request for a person)', 'detect_signals()', 'allow');
  if (b.freq) behind('payassist', `Remembered: paid ${b.freq}. Will align payments to payday`, 'update_context()');
  say('Thanks for sharing that. I can set up a plan with you now, or connect you with our specialist support team who can also talk to you about hardship assistance and concessions. What would you prefer?');
  ask([
    { label: 'Keep going with Pay Assist', go: () => { customerSays("Let's keep going here"); showOptions(); }, primary: true },
    { label: 'Connect me to a specialist', go: () => { customerSays('Connect me to a specialist'); handoff(ESCALATIONS['ESC-05']); } },
  ]);
}

function showOptions() {
  const c = customer();
  const { plans, notes } = chatOptions(c, today, J().ctx.freq ?? 'fortnightly');
  J().set({ ctx: { ...J().ctx, offered: plans } });
  behind('plan', `Built ${plans.length} options from the morning assessment: ${plans.map((p) => p.label).join(', ')}`, 'build_options()');
  const verdicts = plans.map((p) => checkPlan(c, p, today).allowed);
  behind('guardian', `All ${verdicts.filter(Boolean).length} options checked against the arrangement rules`, 'check_plans()', verdicts.every(Boolean) ? 'allow' : 'block');
  say('Sure, let me help you with that. Based on your account, here are the options available to you today:', { kind: 'options', plans, notes });
  say("Which of these feels most manageable for you right now? It's completely okay if none of them feel quite right. We can adjust.");
  const instal = plans.find((p) => p.type === 'instalment');
  ask([
    ...plans.filter((p) => p.type !== 'bill_smoothing').map((p, i) => ({ label: `Option ${i + 1}: ${p.label}`, go: () => { customerSays(`Option ${i + 1}, please`); choose(p); } })),
    { label: `Option ${plans.indexOf(instal!) + 1} is a bit too high for me. Can I get more time?`, go: () => { customerSays(`Option ${plans.indexOf(instal!) + 1} is a bit too high for me. Can I get more time?`); probe(); }, primary: true },
  ]);
}

function choose(p: Plan) {
  J().set({ ctx: { ...J().ctx, chosen: p } });
  summary(p);
}

function probe(again = false) {
  const c = customer();
  pending = 'budget';
  J().set({ awaitBudget: true });
  const known = J().ctx.freq;
  if (!again) say('Absolutely, that\'s what I\'m here for. A longer plan would lower each payment. Just a couple of quick questions so I get it right.');
  else J().set({ ctx: { ...J().ctx, budgetCents: undefined, firstDate: undefined } });
  say(known && !again
    ? `You mentioned you're paid ${known}. What day are you paid, roughly how much could you comfortably pay each ${known === 'fortnightly' ? 'fortnight' : known === 'weekly' ? 'week' : 'month'} including your usual energy use, and when would you like the first payment?`
    : 'How often are you paid, and on what day? Roughly how much could you comfortably pay each time, including your usual energy use? And when would you like your first payment?',
  { kind: 'slider' });
  const sarahLine = 'Fortnightly, from 15th of October. Around $120 a fortnight is okay.';
  ask([
    ...(c.persona === 'Sarah' ? [{ label: sarahLine, go: () => { customerSays(sarahLine); budget(sarahLine); }, primary: true }] : []),
  ], 'e.g. "Fortnightly on Thursdays, about $120"');
}

// Called by the slider card or by free text.
export function budget(text: string, direct?: { freq: Frequency; weekday: number; amountCents: number; firstDate: string }) {
  const c = customer();
  const b = direct ?? parseBudget(text, today);
  const ctx: Ctx = { ...J().ctx };
  if (b.freq) ctx.freq = b.freq;
  if (b.amountCents) ctx.budgetCents = b.amountCents;
  if (b.weekday !== undefined) ctx.weekday = b.weekday;
  if (b.firstDate) ctx.firstDate = b.firstDate;
  if (b.weekday !== undefined && !b.firstDate) ctx.firstDate = nextDates(today, b.weekday)[0];
  J().set({ ctx });
  const missing = [!ctx.freq && 'how often you\'re paid', !ctx.budgetCents && 'roughly how much you could pay each time'].filter(Boolean);
  if (missing.length) {
    say(`Thanks. Could you also tell me ${missing.join(' and ')}?`);
    ask([], 'Type your answer, or use the slider above');
    return;
  }
  pending = 'recommend';
  J().set({ awaitBudget: false });
  const freq = ctx.freq!;
  const weekday = ctx.weekday ?? 4;
  const first = ctx.firstDate ?? nextDates(today, weekday)[0];
  J().set({ ctx: { ...J().ctx, freq, weekday, firstDate: first } });
  const parts = [`${freq}`, `${dollars(ctx.budgetCents!)} per payment`, `first payment ${format(parseISO(first), 'd MMM')} (${WEEKDAYS[parseISO(first).getDay()]})`];
  behind('payassist', `Understood: ${parts.join(', ')}`, 'extract_preferences()');
  const ranked = rankForBudget(c, ctx.budgetCents!, freq, parseISO(first));
  J().set({ ctx: { ...J().ctx, offered: [...J().ctx.offered, ...ranked.all] } });
  behind('plan', ranked.all.map((p) => `${p.months}m ${dollars(p.instalmentCents!)}`).join(' · ') + ` (max ${c.state === 'VIC' ? '24 months in VIC' : '12 months'})`, `plan_for_budget(budget=${dollars(ctx.budgetCents!)}, freq=${freq})`);
  if (!ranked.fit) {
    const low = ranked.lowest;
    say(`The lowest regular payment I can offer is ${dollars(low.instalmentCents!)} ${cadence(low)} over ${low.months} months. Would that work, or would you like to talk to our hardship team about more support?`);
    J().set({ ctx: { ...J().ctx, chosen: low } });
    ask([
      { label: 'That works', go: () => { customerSays('That works'); summary(low); }, primary: true },
      { label: 'Talk to the hardship team', go: () => { customerSays('Talk to the hardship team'); handoff(ESCALATIONS['ESC-05']); } },
    ]);
    return;
  }
  const p = ranked.fit;
  const why = [`${dollars(ctx.budgetCents!)} covers the ${p.months}-month instalment of ${dollars(p.instalmentCents!)}`];
  const shorter = ranked.all[ranked.all.indexOf(p) - 1];
  if (shorter) why.push(`${shorter.months} months would be ${dollars(shorter.instalmentCents!)}, above budget`);
  why.push('shortest plan that fits, so the debt clears sooner');
  behind('plan', `Recommended ${p.label}: ${why.join('; ')}`);
  behind('guardian', `Plan allowed: ${checkPlan(c, p, today).checks.length} rule checks passed`, 'check_plan()', checkPlan(c, p, today).allowed ? 'allow' : 'block');
  J().set({ ctx: { ...J().ctx, chosen: p } });
  recommend(p);
}

function recommend(p: Plan) {
  const c = customer();
  pending = 'recommend';
  say(`That's great, thank you ${c.firstName}. Based on what you've shared, I recommend the ${p.months}-month Assist Payment Arrangement:`, {
    kind: 'plan', plan: p, title: `${dollars(p.instalmentCents!)} ${cadence(p)}`,
    lines: [`Starting ${longDate(p.firstDate!)}`, `${p.count} payments, last on ${format(parseISO(p.lastDate!), 'd MMM yyyy')}`],
  });
  say(`This covers your overdue balance and your normal ${c.fuelType === 'dual' ? 'electricity and gas' : c.fuelType === 'gas' ? 'gas' : 'electricity'} usage, so you won't receive separate bills to pay during the plan.`);
  ask([
    { label: 'Sounds good', go: () => { customerSays('Sounds good'); summary(p); }, primary: true },
    { label: 'Can I change the amount or date?', go: () => { customerSays('Can I change the amount or date?'); probe(true); } },
    { label: "I'm still not sure", go: () => { customerSays("I'm still not sure"); notSure(); } },
  ]);
}

function notSure() {
  pending = null;
  say('No problem at all. Would you prefer lower payments over a longer time, or clearing the balance faster with slightly higher payments?');
  const rank = (pref: 'longer' | 'faster') => () => {
    const c = customer();
    const ctx = J().ctx;
    const all = rankForBudget(c, ctx.budgetCents ?? 0, ctx.freq ?? 'fortnightly', parseISO(ctx.firstDate ?? nextDates(today, 4)[0])).all;
    const cur = all.findIndex((p) => p.months === ctx.chosen?.months);
    const best = pref === 'longer' ? Math.min(all.length - 1, cur + 1) : Math.max(0, cur - 1);
    behind('plan', `Re-ranked for "${pref === 'longer' ? 'lower payments' : 'clear it faster'}": highlighting ${all[best].months} months at ${dollars(all[best].instalmentCents!)}`, 'rerank_options()');
    J().set({ ctx: { ...ctx, offered: [...ctx.offered, ...all], chosen: all[best] } });
    say(pref === 'longer' ? 'Here are your choices, with the lowest comfortable payment highlighted:' : 'Here are your choices, with the faster option highlighted:', { kind: 'ranked', plans: all, best });
    ask(all.map((p, i) => ({ label: `${p.months} months · ${dollars(p.instalmentCents!)}`, go: () => { customerSays(`The ${p.months}-month plan`); summary(p); }, primary: i === best })));
  };
  ask([
    { label: 'Lower payments, longer time', go: () => { customerSays('Lower payments over a longer time'); rank('longer')(); } },
    { label: 'Clear it faster', go: () => { customerSays('Clear it faster'); rank('faster')(); } },
  ]);
}

function summary(p: Plan) {
  const c = customer();
  pending = null;
  J().set({ ctx: { ...J().ctx, chosen: p } });
  const rows: [string, string][] = [];
  const extra: number[] = [];
  if (p.type === 'assist' || p.type === 'instalment') {
    const perMonth = Math.round(totalOverdue(c) / p.months!);
    extra.push(avgMonthlyBill(c), perMonth, debtComponent(c, p));
    rows.push(
      [`Overdue balance${c.accounts.length > 1 ? ' (electricity + gas)' : ''}`, dollars(totalOverdue(c))],
      ['Average energy bill', `${dollars(avgMonthlyBill(c))} per month`],
      ['Additional amount to clear the debt', `≈ ${dollars(perMonth)} per month (≈ ${dollars(debtComponent(c, p))} per ${p.frequency === 'weekly' ? 'week' : p.frequency === 'monthly' ? 'month' : 'fortnight'})`],
      [`Your ${p.frequency} payment`, `${dollars(p.instalmentCents!)} (includes usage + overdue)`],
      ['Number of payments', `${p.count} ${p.frequency} payments`],
      ['First / last payment', `${format(parseISO(p.firstDate!), 'EEE d MMM yyyy')} / ${format(parseISO(p.lastDate!), 'EEE d MMM yyyy')}`],
      ['Overdue debt fully cleared by', format(parseISO(p.lastDate!), 'MMMM yyyy')],
    );
  } else if (p.type === 'part_extension') {
    rows.push(['Pay today', dollars(p.upfrontCents!)], ['Remaining balance', `${dollars(p.totalCents - p.upfrontCents!)} by ${longDate(p.dueDate!)}`]);
  } else if (p.type === 'extension') {
    rows.push(['Amount', dollars(p.totalCents)], ['Pay by', longDate(p.dueDate!)]);
  } else {
    rows.push(['Pay today', dollars(p.totalCents)], ['Accounts cleared', c.accounts.map((a) => a.fuel === 'gas' ? 'Gas' : 'Electricity').join(' and ')]);
  }
  J().set({ ctx: { ...J().ctx, offered: [...J().ctx.offered, p] } });
  behind('guardian', `Final check before payment: ${p.label} allowed`, 'check_plan()', checkPlan(c, p, today).allowed ? 'allow' : 'block');
  say("Here's a summary of your plan:", { kind: 'summary', plan: p, rows }, extra);
  methods();
}

function methods() {
  const c = customer();
  const a = assess(c, today);
  const card = c.contact.storedCard;
  say(`How would you like to make your payments? Card and bank payments post in 24–48 hours; PayPal and Australia Post take 3–5 business days.${a.priority ? ' As your account needs attention soon, I\'d suggest a card so your payment posts quickly.' : ''}`);
  ask([
    ...(card ? [{ label: `${card.brand} ending ${card.last4} (on file)`, go: () => { customerSays(`My ${card.brand} ending ${card.last4}`); pay('stored'); }, primary: true }] : []),
    { label: 'New debit or credit card', go: () => { customerSays('A new card'); pay('newcard'); }, primary: !card },
    { label: 'Direct debit from my bank', go: () => { customerSays('Direct debit from my bank'); pay('debit'); } },
    { label: 'PayPal (use for Amex)', go: () => { customerSays('PayPal'); pay('paypal'); } },
    { label: 'BPAY / app / Australia Post', go: () => { customerSays("I'll pay manually"); pay('manual'); } },
  ]);
}

export type Method = 'stored' | 'newcard' | 'debit' | 'paypal' | 'manual';

function pay(m: Method) {
  if (m === 'newcard' || m === 'debit' || m === 'paypal') {
    behind('payassist', 'Opened the secure hosted payment page. Card and bank details never pass through the AI (PCI DSS)', 'open_payment_page()');
    say('I\'ll open our secure payment page. Your details go straight to the payment provider. I never see them.', { kind: 'paypage', method: m });
    return;
  }
  if (m === 'manual') {
    behind('payassist', 'Manual payment chosen: BPAY details shared; Sustain agent will watch for posting');
    return complete('BPAY');
  }
  authorise('stored');
}

export function authorise(m: Method) {
  const c = customer();
  const card = c.contact.storedCard;
  const label = m === 'stored' && card ? `${card.brand} ending ${card.last4}` : m === 'debit' ? 'bank account ending 312' : m === 'paypal' ? 'PayPal' : 'new card ending 1111';
  J().set({ messages: [...J().messages, { id: nextId++, from: 'system', text: `Authorising ${label}…` }], replies: [] });
  const fail = J().failPayment && J().ctx.failures === 0;
  const my = epoch;
  queue = queue.then(async () => {
    await wait(1100);
    if (my !== epoch) return;
    if (fail) {
      J().set({ ctx: { ...J().ctx, failures: 1 } });
      behind('payassist', 'Payment gateway declined the authorisation (code 05: do not honour)', 'authorise_payment()', 'block');
    } else {
      behind('payassist', `${label} authorised and tokenised for scheduled payments`, 'authorise_payment()', 'allow');
    }
  });
  if (fail) {
    say("It looks like that payment didn't go through. Don't worry. Would you like to try again, use a different card, or choose another payment method?");
    ask([
      { label: 'Try again', go: () => { customerSays('Try again'); authorise(m); }, primary: true },
      { label: 'Use a different card', go: () => { customerSays('Use a different card'); pay('newcard'); } },
      { label: 'Choose another method', go: () => { customerSays('Another method, please'); methods(); } },
    ]);
    return;
  }
  complete(label);
}

function complete(method: string) {
  const c = customer();
  const p = J().ctx.chosen!;
  const ref = REF(c);
  const first = p.firstDate ? longDate(p.firstDate) : p.dueDate ? longDate(p.dueDate) : 'today';
  const amount = p.instalmentCents ?? p.upfrontCents ?? p.totalCents;
  const lines = [
    p.label, method === 'BPAY' ? 'BPAY biller code 0000 · reference ' + c.id.slice(3) + '0' : `${p.count ? 'Payments from' : 'Paid by'} ${method}`,
    p.count ? `${p.count} payments of ${dollars(p.instalmentCents!)}` : dollars(p.totalCents),
  ];
  const what = p.type === 'full' ? `Your payment of ${dollars(p.totalCents)} has been received` : p.type === 'part_extension'
    ? `Your payment of ${dollars(p.upfrontCents!)} has been received and the rest is due ${first}`
    : p.type === 'extension' ? `Your extension is set up and ${dollars(p.totalCents)} is due ${first}`
      : `Your plan is active and your first payment of ${dollars(amount)} is scheduled for ${first}`;
  say(`All set, ${c.firstName}! ${what}. Reference: ${ref}.`, { kind: 'done', ref, lines });
  const my = epoch;
  queue = queue.then(() => {
    if (my !== epoch) return;
    behind('handoff', `Arrangement written to billing/CRM on ${c.accounts.map((a) => a.number).join(' and ')}`, 'write_arrangement()', 'allow');
    behind('handoff', 'Interaction notes, reason code and chat transcript stored. Disposition: Payment Arrangement – Self-Service', 'write_notes()');
    behind('engagement', `Removed from today's contact list; confirmation email sent (Ref ${ref})`, 'send_confirmation()');
    behind('sustain', `Plan handed to the Sustain agent: payday reminder 2 days before each payment`, 'monitor_plan()');
    J().set({ confirmEmail: true, ctx: { ...J().ctx, ended: 'done' } });
    useApp.getState().setAgent('sustain', 'working', 'Sustain: watching the new plan');
  });
  feedback();
}

function feedback() {
  say('Before you go, how was your experience with Pay Assist today?', { kind: 'rating' });
  queue = queue.then(() => { J().set({ replies: [], input: 'none' }); });
}

export function rate(stars: number, easy: boolean, comment: string) {
  const c = customer();
  J().set({ ctx: { ...J().ctx, rating: stars } });
  customerSays(`${'★'.repeat(stars)}${easy ? ' · Easy to do' : ''}${comment ? ` · "${comment}"` : ''}`);
  behind('insights', `Feedback recorded: ${stars}/5, ${easy ? 'easy' : 'not easy'}${comment ? `, "${comment}"` : ''}`, 'record_feedback()');
  say(`Thank you so much! If anything changes, just come back to this chat or call us. We can always adjust your plan. Take care, ${c.firstName}. 😊`);
  queue = queue.then(() => J().set({ replies: [], input: 'none' }));
}

// ---------- Scene 3: "I've already paid" ----------

let paidMethod: keyof typeof POSTING = 'card';

function alreadyPaid() {
  pending = null;
  say('Thanks for letting me know. Payments can take time to reach your account: usually 24–48 hours for card or bank, and 3–5 business days for PayPal or Australia Post.');
  say('How did you pay?');
  ask((Object.keys(POSTING) as (keyof typeof POSTING)[]).map((k) => ({
    label: POSTING[k].label, go: () => {
      customerSays(POSTING[k].label);
      paidMethod = k;
      pending = 'reference';
      say('Could you share the payment receipt or reference number? I can then give you an extension so the payment has time to post.');
      ask([{ label: 'Receipt 7731 0942', go: () => { customerSays('Receipt 7731 0942'); reference('7731 0942'); }, primary: true }], 'Type the receipt or reference number');
    },
  })));
}

function reference(text: string) {
  const c = customer();
  pending = null;
  const ref = text.replace(/[^0-9A-Za-z ]/g, '').replace(/^receipt\s*/i, '').trim() || 'not provided';
  const p = postingExtension(c, today, paidMethod);
  const g = checkPlan(c, p, today);
  behind('payassist', `Payment reference ${ref} recorded (${POSTING[paidMethod].label}, posts in ${POSTING[paidMethod].text})`, 'record_payment_reference()');
  behind('plan', `Extension to ${format(parseISO(p.dueDate!), 'd MMM')} so the payment can post (${POSTING[paidMethod].businessDays} business days + buffer)`, 'build_extension()');
  behind('guardian', `Extension allowed: ${g.checks[0].text}`, 'check_plan()', g.allowed ? 'allow' : 'block');
  behind('engagement', `Reminders paused until ${format(parseISO(p.dueDate!), 'd MMM')}; customer removed from today's contact list`, 'suppress_contact()');
  behind('sustain', `Will check on ${format(parseISO(p.dueDate!), 'd MMM')} that the payment has posted`, 'schedule_check()');
  J().set({ ctx: { ...J().ctx, chosen: p, offered: [...J().ctx.offered, p], ended: 'done' } });
  say(`Thank you. I've noted reference ${ref} and paused reminders until ${longDate(p.dueDate!)}, so your payment has time to post. If it hasn't arrived by then, we'll let you know. There's nothing more you need to do today.`);
  feedback();
}

// ---------- handoff (detailed human workspace arrives in Phase 4) ----------

function handoff(esc: Escalation, signal?: VulnerabilitySignal) {
  J().set({ ctx: { ...J().ctx, handoff: { esc, signal, at: phoneTime() } } });
  const c = customer();
  pending = null;
  behind('guardian', `Escalation ${esc.id}: ${esc.trigger}. Collections messaging stopped`, 'escalate()', 'block');
  behind('handoff', `Case card created for ${esc.routeTo}${esc.priority && !esc.routeTo.includes('priority') ? ' (priority)' : ''}: ${esc.context === 'minimal' ? 'minimal safety summary only' : 'balances, options shown and chat transcript'}`, 'create_case()');
  say(esc.customerMessage.replace('{name}', c.firstName), { kind: 'handoff', esc });
  queue = queue.then(() => J().set({ replies: [], input: 'none', ctx: { ...J().ctx, ended: 'handoff' } }));
}

// ---------- the specialist joins the same chat (Protect stage) ----------

export function specialistJoin(name: string) {
  const h = J().ctx.handoff;
  if (!h || h.joined) return;
  clock += 1;
  J().set({
    ctx: { ...J().ctx, handoff: { ...h, joined: name } }, input: 'text', placeholder: `Reply to ${name}…`, typing: false,
    messages: [...J().messages, { id: nextId++, from: 'system', text: `${name} from the specialist team joined the chat` }],
  });
  behind('handoff', `Warm handover: ${name} joined with the case card. Pay Assist has stepped back`, 'transfer_chat()', 'allow');
}

export function specialistSay(text: string) {
  const name = J().ctx.handoff?.joined;
  if (!name || !text.trim()) return;
  clock += 1;
  J().set({ messages: [...J().messages, { id: nextId++, from: 'human', name, text }] });
  useApp.getState().log('human', name, `Said to ${customer().firstName}: ${text}`);
}

export const DISTRESS_LINE = "Sorry, things are really bad at home. I'm scared of my partner and he controls all the money.";

// Presenter control for Scene 6: the customer discloses something serious mid-chat.
export function discloseDistress() {
  if (!J().verified) skipToChat();
  if (J().ctx.ended) return;
  typed(DISTRESS_LINE);
}


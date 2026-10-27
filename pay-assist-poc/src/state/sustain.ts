import { create } from 'zustand';
import { format, parseISO } from 'date-fns';
import { persona } from '../domain/customers';
import { checkMessage } from '../domain/guardian';
import { dollars } from '../domain/money';
import { assistArrangement } from '../domain/plans';
import { checkReschedule, rescueOptions, schedule } from '../domain/sustain';
import type { Plan } from '../domain/types';
import { useJourney } from './journey';
import { useApp } from './store';
import type { AgentId } from './stages';

// Scene 7 part 1: "two weeks later". The presenter fast-forwards through Sarah's plan one event at a time.

export type PayStatus = 'scheduled' | 'paid' | 'failed' | 'moved';
export interface SmsMsg { id: number; from: 'agl' | 'me'; text: string; at: string }
export interface SEvent { id: number; at: string; agent: AgentId; text: string; tool?: string; verdict?: 'allow' | 'block' }

interface SustainState {
  step: number;
  now: string; // simulated date-time label
  status: PayStatus[];
  movedTo?: string;
  outcome?: 'rescued' | 'human';
  sms: SmsMsg[];
  events: SEvent[];
  awaitingReply: boolean;
  checks?: ReturnType<typeof checkReschedule>;
}

const sarah = persona('Sarah');
const FIRST = new Date(2026, 9, 15);

// Sarah's plan: the one she accepted in the chat if it was an over-time plan, otherwise the scripted 12-month plan.
export function sustainPlan(): Plan {
  const j = useJourney.getState();
  const p = j.who === 'Sarah' && j.ctx.ended === 'done' ? j.ctx.chosen : undefined;
  return p && p.count && p.firstDate && p.frequency ? p : assistArrangement(sarah, FIRST, 'fortnightly', 12);
}

const fresh = (): SustainState => ({
  step: 0, now: 'Wed 14 Oct 2026, 9:15 am', status: schedule(sustainPlan()).map(() => 'scheduled'), sms: [], events: [], awaitingReply: false,
});

export const useSustain = create<SustainState>(() => fresh());
const S = () => useSustain.getState();
const set = (p: Partial<SustainState>) => useSustain.setState(p);
let id = 1;

function ev(agent: AgentId, text: string, tool?: string, verdict?: SEvent['verdict']) {
  set({ events: [{ id: id++, at: S().now, agent, text, tool, verdict }, ...S().events] });
  const app = useApp.getState();
  if (tool) app.addTrace(agent, tool, text, verdict);
  app.log(agent === 'guardian' ? 'guardian' : 'agent', agent[0].toUpperCase() + agent.slice(1), `${text} (Sarah Mitchell)`);
}

// Every SMS goes through the Guardian: no amounts or balances outside a verified session (BR-C01).
function sms(text: string) {
  const g = checkMessage(text, false);
  ev('guardian', g.allowed ? 'SMS allowed: no balance or amount outside a verified session' : 'SMS blocked: contains an amount', 'check_message(verified=false)', g.allowed ? 'allow' : 'block');
  if (g.allowed) set({ sms: [...S().sms, { id: id++, from: 'agl', text, at: S().now }] });
}

const setStatus = (i: number, s: PayStatus) => set({ status: S().status.map((x, k) => (k === i ? s : x)) });
const day = (d: string) => format(parseISO(d), 'EEE d MMM');

export const STEP_LABELS = ['Plan starts', 'First payment', 'Payday reminder', 'Payment fails', 'Rescue agreed', 'Retry succeeds'];

export function restartSustain() {
  set(fresh());
}

// Fast-forward to the next event in Sarah's plan.
export function fastForward() {
  const p = sustainPlan();
  const dates = schedule(p);
  const amt = dollars(p.instalmentCents!);
  const step = S().step;
  const app = useApp.getState();

  if (step === 0) {
    set({ step: 1, now: `${day(dates[0])} 2026, 9:00 am` });
    app.setAgent('sustain', 'working', 'Sustain: watching Sarah\'s plan');
    setStatus(0, 'paid');
    ev('sustain', `Payment 1 of ${dates.length} received: ${amt} by card ending 4821`, 'reconcile_payment()', 'allow');
    sms(`Thanks Sarah, we've received your first plan payment. Your next one is due ${day(dates[1])}. Reply HELP any time.`);
    return;
  }
  if (step === 1) {
    set({ step: 2, now: `${format(parseISO(dates[1]).getTime() - 2 * 864e5, 'EEE d MMM')} 2026, 10:00 am` });
    ev('sustain', `Payday reminder: payment 2 due ${day(dates[1])}, 2 days away`, 'schedule_reminder()');
    sms(`Hi Sarah, a friendly reminder that your next plan payment is due this ${format(parseISO(dates[1]), 'EEEE d MMM')}. Reply CHANGE if you need a different date.`);
    return;
  }
  if (step === 2) {
    set({ step: 3, now: `${day(dates[1])} 2026, 9:05 am` });
    setStatus(1, 'failed');
    app.setAgent('sustain', 'working', 'Sustain: payment 2 failed, preparing a rescue');
    ev('sustain', `Payment 2 failed at 9:00 am (insufficient funds). Detected within 5 minutes`, 'payment_webhook()', 'block');
    ev('sustain', 'First missed payment on this plan; 10 of 12 bills paid on time; reduced hours and paid fortnightly. Likely a timing problem, so offer a new date rather than escalate');
    const opts = rescueOptions(p, 1);
    opts.forEach((o) => ev('guardian', `New date ${day(o)} allowed for payment 2`, 'check_reschedule()', checkReschedule(p, 1, o).allowed ? 'allow' : 'block'));
    sms(`Hi Sarah, your plan payment today didn't go through. Don't worry, your plan is still active. Reply 1 to try again ${day(opts[0])}, 2 for ${day(opts[1])}, or 3 if you'd like us to call you.`);
    set({ awaitingReply: true });
    return;
  }
  if (step === 4 && S().outcome === 'rescued') {
    const moved = S().movedTo!;
    set({ step: 5, now: `${day(moved)} 2026, 9:00 am` });
    setStatus(1, 'paid');
    ev('sustain', `Payment 2 received on the new date: ${amt}. Plan back on track (2 of ${dates.length} paid)`, 'reconcile_payment()', 'allow');
    sms(`Thanks Sarah, payment received. Your plan is on track and your next payment is ${day(dates[2])}.`);
    ev('insights', 'Plan rescued without a human, without a broken arrangement and without dunning', 'record_outcome()');
    app.setAgent('sustain', 'done', 'Sustain: Sarah\'s plan rescued and back on track');
  }
}

export function reply(choice: '1' | '2' | '3') {
  const p = sustainPlan();
  const opts = rescueOptions(p, 1);
  set({ sms: [...S().sms, { id: id++, from: 'me', text: choice, at: S().now }], awaitingReply: false, step: 4 });
  useApp.getState().log('customer', 'Sarah', `Replied ${choice} by SMS`);
  if (choice === '3') {
    set({ outcome: 'human' });
    ev('handoff', 'Callback requested: case card sent to the contact centre with the plan, the failed payment and the SMS thread (ESC-04: customer asked for a person)', 'create_case()');
    sms('No problem. A member of our team will call you today. Your plan stays active in the meantime.');
    return;
  }
  const newDate = opts[choice === '1' ? 0 : 1];
  const checks = checkReschedule(p, 1, newDate);
  set({ checks });
  checks.checks.forEach((c) => ev('guardian', c.text, undefined, c.pass ? 'allow' : 'block'));
  if (!checks.allowed) return;
  ev('plan', `Payment 2 moved from ${day(schedule(p)[1])} to ${day(newDate)}; amount and end date unchanged`, 'reschedule_instalment()', 'allow');
  ev('handoff', 'Change written to billing/CRM; note added to the arrangement', 'write_arrangement()', 'allow');
  setStatus(1, 'moved');
  set({ movedTo: newDate, outcome: 'rescued' });
  sms(`Done. Your payment is now set for ${format(parseISO(newDate), 'EEEE d MMM')}. The rest of your plan stays the same.`);
}

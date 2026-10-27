import { create } from 'zustand';
import { format } from 'date-fns';
import { dollars } from '../domain/money';
import type { Case } from '../domain/cases';
import type { Plan } from '../domain/types';
import { demoTime, useApp } from './store';

// The specialist's workspace state (Protect stage).
export const SPECIALIST = 'Alex Morgan';

export type CaseStatus = 'open' | 'approved' | 'rejected' | 'logged' | 'protected';

export interface CaseState {
  status: CaseStatus;
  openedAt?: number;
  seconds?: number;
  note?: string;
  plan?: Plan;
  actions: string[];
}

interface ProtectState {
  selected: string | null;
  team: string;
  cases: Record<string, CaseState>;
  select: (id: string | null) => void;
  setTeam: (team: string) => void;
  reset: () => void;
}

export const useProtect = create<ProtectState>((set, get) => ({
  selected: null,
  team: 'All',
  cases: {},
  select: (id) => {
    const cur = id ? get().cases[id] : undefined;
    set({ selected: id, cases: id && !cur ? { ...get().cases, [id]: { status: 'open', openedAt: Date.now(), actions: [] } } : get().cases });
  },
  setTeam: (team) => set({ team }),
  reset: () => set({ selected: null, team: 'All', cases: {} }),
}));

const P = () => useProtect.getState();
export const caseState = (id: string): CaseState => P().cases[id] ?? { status: 'open', actions: [] };

function update(id: string, patch: Partial<CaseState>) {
  P().cases[id] ?? P().select(id);
  useProtect.setState((s) => ({ cases: { ...s.cases, [id]: { ...caseState(id), ...patch } } }));
}

const elapsed = (id: string) => Math.max(1, Math.round((Date.now() - (caseState(id).openedAt ?? Date.now())) / 1000));

export function approve(k: Case, plan: Plan, edited: boolean) {
  const seconds = elapsed(k.id);
  update(k.id, { status: 'approved', plan, seconds });
  const app = useApp.getState();
  const what = plan.instalmentCents ? `${plan.count} × ${dollars(plan.instalmentCents)} ${plan.frequency}` : `${dollars(plan.totalCents)} by ${plan.dueDate}`;
  app.log('human', SPECIALIST, `${edited ? 'Edited and approved' : 'Approved'} ${plan.label} for ${k.c.name}: ${what} (${seconds}s)`);
  app.addTrace('handoff', 'write_arrangement()', `${plan.label} written to billing/CRM for ${k.c.name}, approved by ${SPECIALIST}`, 'allow');
  app.addTrace('engagement', 'send_confirmation()', `SMS and email sent to ${k.c.firstName} with the confirmed plan`);
  app.setAgent('handoff', 'done', `Handoff: plan for ${k.c.firstName} approved by ${SPECIALIST}`);
}

export function reject(k: Case, reason: string) {
  update(k.id, { status: 'rejected', note: reason, seconds: elapsed(k.id) });
  useApp.getState().log('human', SPECIALIST, `Rejected the drafted plan for ${k.c.name}: ${reason}. Case kept open for a call`);
}

export function logCall(k: Case, outcome: string, note: string) {
  update(k.id, { status: 'logged', note, seconds: elapsed(k.id) });
  const app = useApp.getState();
  app.log('human', SPECIALIST, `Call with ${k.c.name} logged: ${outcome}`);
  app.addTrace('handoff', 'write_notes()', `Copilot-drafted notes saved to CRM for ${k.c.name}`, 'allow');
}

export function protectAction(k: Case, action: string) {
  const st = caseState(k.id);
  if (st.actions.includes(action)) return;
  update(k.id, { actions: [...st.actions, action], status: 'protected' });
  const app = useApp.getState();
  app.log('human', SPECIALIST, `${action} for ${k.c.name}`);
  app.addTrace('guardian', 'apply_protection()', `${action} (${k.c.name})`, 'allow');
}

export const stamp = () => format(demoTime(), 'HH:mm');

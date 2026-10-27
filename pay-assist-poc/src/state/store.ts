import { create } from 'zustand';
import type { AgentId, StageId } from './stages';

// Fixed demo clock: the morning run happens before the business day.
export const DEMO_NOW = new Date(2026, 9, 14, 7, 30);

export type AuditKind = 'system' | 'agent' | 'guardian' | 'human' | 'customer';
export type AgentStatus = 'idle' | 'working' | 'done';

export type ConsoleTab = 'map' | 'calls' | 'trace';
export type RunStatus = 'idle' | 'ready' | 'running' | 'done';

// One tool call made by an agent, shown in the agent console (and later per-customer traces).
export interface TraceEntry {
  id: number;
  at: Date;
  agent: AgentId;
  tool: string;
  result: string;
  verdict?: 'allow' | 'block';
}

export interface AuditEvent {
  id: number;
  at: Date;
  kind: AuditKind;
  actor: string;
  text: string;
}

interface AppState {
  stage: StageId;
  audit: AuditEvent[];
  auditOpen: boolean;
  consoleOpen: boolean;
  consoleTab: ConsoleTab;
  ruleBookOpen: boolean;
  ruleFocus: string | null;
  helpOpen: boolean;
  traceId: string | null;
  agentFilter: AgentId | null;
  agentStatus: Record<AgentId, AgentStatus>;
  agentActivity: string;
  run: { status: RunStatus; step: number; progress: number; uploadedName?: string };
  trace: TraceEntry[];
  setRun: (run: Partial<AppState['run']>) => void;
  addTrace: (agent: AgentId, tool: string, result: string, verdict?: TraceEntry['verdict']) => void;
  setStage: (stage: StageId) => void;
  log: (kind: AuditKind, actor: string, text: string) => void;
  setAuditOpen: (open: boolean) => void;
  setConsoleOpen: (open: boolean) => void;
  openRuleBook: (id?: string) => void;
  closeRuleBook: () => void;
  setHelpOpen: (open: boolean) => void;
  openConsole: (tab: ConsoleTab, opts?: { traceId?: string; agent?: AgentId | null }) => void;
  setAgent: (id: AgentId, status: AgentStatus, activity?: string) => void;
  reset: () => void;
}

let nextId = 1;
const STARTED = Date.now();

// Audit times run on the demo clock, starting at DEMO_NOW when the app opens.
export const demoTime = () => new Date(DEMO_NOW.getTime() + (Date.now() - STARTED));

const idleAgents = (): Record<AgentId, AgentStatus> => ({
  orchestrator: 'idle', intake: 'idle', assessment: 'idle', engagement: 'idle', payassist: 'idle',
  plan: 'idle', guardian: 'idle', handoff: 'idle', sustain: 'idle', insights: 'idle',
});

const initial = () => ({
  stage: 'assess' as StageId,
  audit: [] as AuditEvent[],
  auditOpen: false,
  consoleOpen: false,
  consoleTab: 'map' as ConsoleTab,
  ruleBookOpen: false,
  ruleFocus: null as string | null,
  helpOpen: false,
  traceId: null as string | null,
  agentFilter: null as AgentId | null,
  agentStatus: idleAgents(),
  agentActivity: 'Waiting for the daily overdue file',
  run: { status: 'idle' as RunStatus, step: -1, progress: 0 },
  trace: [] as TraceEntry[],
});

export const useApp = create<AppState>((set) => ({
  ...initial(),
  setStage: (stage) => set({ stage }),
  log: (kind, actor, text) =>
    set((s) => ({ audit: [{ id: nextId++, at: demoTime(), kind, actor, text }, ...s.audit] })),
  setAuditOpen: (auditOpen) => set({ auditOpen }),
  setConsoleOpen: (consoleOpen) => set({ consoleOpen }),
  openRuleBook: (id) => set({ ruleBookOpen: true, ruleFocus: id ?? null }),
  closeRuleBook: () => set({ ruleBookOpen: false, ruleFocus: null }),
  setHelpOpen: (helpOpen) => set({ helpOpen }),
  openConsole: (consoleTab, opts) => set((s) => ({
    consoleOpen: true, consoleTab,
    traceId: opts?.traceId ?? s.traceId,
    agentFilter: opts && 'agent' in opts ? opts.agent ?? null : s.agentFilter,
  })),
  setAgent: (id, status, activity) =>
    set((s) => ({
      agentStatus: { ...s.agentStatus, [id]: status },
      agentActivity: activity ?? s.agentActivity,
    })),
  setRun: (run) => set((s) => ({ run: { ...s.run, ...run } })),
  addTrace: (agent, tool, result, verdict) =>
    set((s) => ({ trace: [{ id: nextId++, at: demoTime(), agent, tool, result, verdict }, ...s.trace] })),
  reset: () => set(initial()),
}));

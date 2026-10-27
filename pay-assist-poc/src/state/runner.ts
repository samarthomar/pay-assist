import { morningRun, type MorningRun } from '../domain/morningRun';
import { DEMO_NOW, useApp } from './store';
import type { AgentId } from './stages';

const n = (v: number) => v.toLocaleString('en-AU');

export interface RunStep {
  agent: AgentId;
  title: string;
  tool: string;
  working: string; // shown in the agent strip while the step runs
  result: string;
  detail?: string;
  verdict?: 'allow' | 'block';
  ms: number;
  units: number; // records processed, for the live counter
}

// The scripted agent plan for the morning run. Every number comes from the computed run.
export function runSteps(r: MorningRun): RunStep[] {
  const { decisions: d, bands: b, guardian: g } = r;
  return [
    { agent: 'orchestrator', title: 'Plan the run', tool: `plan_run(file="${r.file.name}")`, working: 'Planning the morning run',
      result: `9 tasks planned for ${n(r.total)} accounts`, detail: 'Intake → Assessment → Plan → Guardian → Engagement → Handoff', ms: 900, units: 0 },
    { agent: 'intake', title: 'Validate the daily file', tool: 'validate_file(checks=[contact, state, balance, duplicates])', working: 'Checking every record',
      result: `${n(r.rows.length)} valid · ${r.rejected.length} quarantined`,
      detail: `${n(r.byFuel.elec)} electricity · ${n(r.byFuel.gas)} gas · ${n(r.byFuel.dual)} dual fuel`, ms: 1500, units: r.total },
    { agent: 'assessment', title: 'Apply AGL targeting rules', tool: 'apply_rules(BR-T01..BR-T08, BR-C05)', working: 'Applying targeting rules',
      result: `${n(d.ai)} AI contact · ${n(d.human)} human · ${n(d.none)} do not contact`,
      detail: 'Life support, hardship, do-not-contact and payment-in-transit checked first', ms: 1600, units: r.rows.length },
    { agent: 'assessment', title: 'Score affordability', tool: 'score_affordability(index = avg payment / avg bill)', working: 'Scoring affordability',
      result: `High ${n(b.High)} · Medium ${n(b.Medium)} · Low ${n(b.Low)}`, detail: 'Using 12 months of payment history per customer', ms: 1300, units: r.rows.length },
    { agent: 'plan', title: 'Build a plan for every AI customer', tool: 'build_plans(calculator=deterministic)', working: 'Building affordable plans',
      result: `${n(d.ai)} plans built · ${n(d.human - (r.routes['Specialist team'] ?? 0) - (r.routes['Hardship team'] ?? 0))} drafts for humans`,
      detail: 'Amounts come from the plan calculator, never from the AI', ms: 1400, units: d.ai },
    { agent: 'guardian', title: 'Veto check', tool: 'check_plans(BR-P01..BR-P05, BR-T02, BR-T03)', working: 'Checking every plan against the rules',
      result: `${n(g.blockedDrafts)} draft extensions: invoice over 90 days (BR-T05)`, verdict: 'block',
      detail: `Plan agent rebuilt them; ${n(g.allowed)} of ${n(d.ai)} final plans allowed`, ms: 1500, units: g.checked },
    { agent: 'guardian', title: 'Check the outbound message', tool: 'check_message(template="sms_first_contact", verified=false)', working: 'Checking message wording',
      result: g.messageAllowed ? 'No balance shown before verification (BR-C01)' : 'Balance shown before verification (BR-C01)',
      verdict: g.messageAllowed ? 'allow' : 'block', ms: 800, units: 0 },
    { agent: 'engagement', title: 'Schedule contact', tool: 'schedule(window="09:00-20:00", channel=preferred)', working: 'Scheduling messages',
      result: `${n(d.ai)} messages queued for 9:00 am · ${n(r.priority)} priority`,
      detail: `${n(r.channels['sms+email'])} SMS + email · ${n(r.channels.sms)} SMS only · ${n(r.channels.email)} email only`, ms: 1100, units: d.ai },
    { agent: 'handoff', title: 'Brief the human teams', tool: 'create_cases(queues=[Resolution, Specialist, Hardship, Review])', working: 'Preparing case cards',
      result: `${n(d.human)} case cards created`, detail: Object.entries(r.routes).map(([k, v]) => `${k} ${n(v)}`).join(' · '), ms: 1100, units: d.human },
    { agent: 'orchestrator', title: 'Publish the output', tool: 'publish(output="assessment_2026-10-14.csv")', working: 'Publishing results',
      result: `Done: $${(r.overdueByDecision.ai / 1e8).toFixed(2)}m of overdue ready for AI self-service`, ms: 700, units: 0 },
  ];
}

let timer: number | undefined;

export function receiveFile(uploadedName?: string) {
  const s = useApp.getState();
  s.setRun({ status: 'ready', step: -1, progress: 0, uploadedName });
  s.setAgent('intake', 'idle', 'Daily overdue file received, waiting to run');
  s.log('system', 'File transfer', uploadedName
    ? `File "${uploadedName}" chosen; the demo uses the synthetic file AGL_overdue_residential_2026-10-14.csv`
    : 'AGL_overdue_residential_2026-10-14.csv received at 06:12 (12,457 rows)');
}

export function startRun() {
  const r = morningRun(DEMO_NOW);
  const steps = runSteps(r);
  const s = useApp.getState();
  s.setRun({ status: 'running', step: 0, progress: 0 });
  s.log('human', 'Collections manager', 'Started the morning assessment run');
  begin(0, steps);
}

function begin(i: number, steps: RunStep[]) {
  const s = useApp.getState();
  const step = steps[i];
  s.setRun({ step: i, progress: 0 });
  s.setAgent(step.agent, 'working', `${agentName(step.agent)}: ${step.working}…`);
  const started = Date.now();
  window.clearInterval(timer);
  timer = window.setInterval(() => {
    const st = useApp.getState();
    if (st.run.status !== 'running') return window.clearInterval(timer); // reset or skipped
    const progress = Math.min(1, (Date.now() - started) / step.ms);
    st.setRun({ progress });
    if (progress < 1) return;
    window.clearInterval(timer);
    finish(step);
    if (i + 1 < steps.length) begin(i + 1, steps);
    else complete();
  }, 60);
}

function finish(step: RunStep) {
  const s = useApp.getState();
  s.setAgent(step.agent, 'done');
  s.addTrace(step.agent, step.tool, step.result, step.verdict);
  s.log(step.agent === 'guardian' ? 'guardian' : 'agent', agentName(step.agent), `${step.title}: ${step.result}`);
}

function complete() {
  const s = useApp.getState();
  s.setRun({ status: 'done', step: Number.MAX_SAFE_INTEGER, progress: 1 });
  s.setAgent('orchestrator', 'done', 'Morning run complete · messages go out at 9:00 am');
}

// Presenter shortcut: finish every remaining step instantly.
export function skipRun() {
  const r = morningRun(DEMO_NOW);
  const steps = runSteps(r);
  const s = useApp.getState();
  const from = Math.max(0, s.run.step);
  window.clearInterval(timer);
  s.setRun({ status: 'done' });
  steps.slice(from).forEach(finish);
  complete();
}

const NAMES: Record<AgentId, string> = {
  orchestrator: 'Orchestrator', intake: 'Intake', assessment: 'Assessment', engagement: 'Engagement', payassist: 'Pay Assist',
  plan: 'Plan', guardian: 'Guardian', handoff: 'Handoff', sustain: 'Sustain', insights: 'Insights',
};
const agentName = (id: AgentId) => NAMES[id];

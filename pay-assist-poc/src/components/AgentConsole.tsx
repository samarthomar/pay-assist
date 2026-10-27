import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { morningRun } from '../domain/morningRun';
import { DEMO_NOW, useApp, type ConsoleTab } from '../state/store';
import { AGENTS, type AgentId } from '../state/stages';
import { CustomerTrace } from './CustomerTrace';

const TABS: { id: ConsoleTab; label: string }[] = [
  { id: 'map', label: 'Live map' },
  { id: 'calls', label: 'Tool calls' },
  { id: 'trace', label: 'Customer trace' },
];

// Bottom sheet opened from the agent strip: the "under the hood" view, available on every stage.
export function AgentConsole() {
  const setConsoleOpen = useApp((s) => s.setConsoleOpen);
  const tab = useApp((s) => s.consoleTab);
  const openConsole = useApp((s) => s.openConsole);
  const trace = useApp((s) => s.trace);
  const blocks = trace.filter((t) => t.verdict === 'block').length;
  const allows = trace.filter((t) => t.verdict === 'allow').length;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setConsoleOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [setConsoleOpen]);

  return (
    <>
      <div className="scrim" onClick={() => setConsoleOpen(false)} />
      <section className="console" role="dialog" aria-label="Agent console">
        <div className="ch">
          <div>
            <div className="ck">Under the hood</div>
            <h3>Agent console</h3>
          </div>
          <div className="ctabs" role="tablist">
            {TABS.map((t) => (
              <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''} onClick={() => openConsole(t.id)}>{t.label}</button>
            ))}
          </div>
          <div className="row">
            <span className="cstat">{trace.length} tool calls · Guardian {allows} allow / {blocks} stop</span>
            <button className="btn small on-red" onClick={() => setConsoleOpen(false)}>Close</button>
          </div>
        </div>
        <div className="cb">
          {tab === 'map' && <LiveMap />}
          {tab === 'calls' && <ToolCalls />}
          {tab === 'trace' && <CustomerTrace />}
        </div>
      </section>
    </>
  );
}

const LANES: { label: string; agents: AgentId[] }[] = [
  { label: 'Back office', agents: ['intake', 'assessment', 'plan', 'engagement'] },
  { label: 'With customers and people', agents: ['payassist', 'sustain', 'handoff', 'insights'] },
];

function LiveMap() {
  const status = useApp((s) => s.agentStatus);
  const trace = useApp((s) => s.trace);
  const run = useApp((s) => s.run);
  const openConsole = useApp((s) => s.openConsole);
  const r = useMemo(() => (run.status === 'done' ? morningRun(DEMO_NOW) : null), [run.status]);
  const last = (id: AgentId) => trace.find((t) => t.agent === id);
  const count = (id: AgentId) => trace.filter((t) => t.agent === id).length;
  const g = trace.filter((t) => t.agent === 'guardian' || t.verdict);
  const writes = trace.filter((t) => /write_|send_confirmation/.test(t.tool)).length;

  const Node = ({ id }: { id: AgentId }) => {
    const a = AGENTS.find((x) => x.id === id)!;
    const l = last(id);
    return (
      <button className={`am-node ${status[id]}`} onClick={() => openConsole('calls', { agent: id })} title={`Show ${a.name}'s tool calls`}>
        <div className="row between"><span className="strong small">{a.name}</span><span className="am-dot" /></div>
        <div className="tiny am-job">{a.job}</div>
        <div className="mono am-last">{l ? l.tool : 'no calls yet'}</div>
        <div className="tiny am-count">{count(id)} call{count(id) === 1 ? '' : 's'}</div>
      </button>
    );
  };

  return (
    <>
      <p className="small am-principle"><b>How it works:</b> AI agents talk and decide; deterministic code calculates amounts and enforces the rules. Nothing reaches a customer or a system without passing the Guardian.</p>
      <div className="amap">
        <div className="am-col">
          <div className="am-src"><span className="tiny muted">Input</span><b className="small">Daily overdue file</b><span className="tiny muted">06:12 · 12,457 rows</span></div>
          <div className="am-src"><span className="tiny muted">Input</span><b className="small">Customer replies</b><span className="tiny muted">chat, SMS, email</span></div>
        </div>
        <div className="am-arrow">→</div>
        <div className="am-col"><Node id="orchestrator" /></div>
        <div className="am-arrow">→</div>
        <div className="am-lanes">
          {LANES.map((l) => (
            <div key={l.label} className="am-lane">
              <span className="am-lane-label tiny">{l.label}</span>
              <div className="am-lane-nodes">{l.agents.map((id) => <Node key={id} id={id} />)}</div>
            </div>
          ))}
        </div>
        <div className="am-arrow">→</div>
        <button className={`am-guardian ${status.guardian}`} onClick={() => openConsole('calls', { agent: 'guardian' })}>
          <span className="strong">Guardian</span>
          <span className="tiny">Checks every plan, message and payment</span>
          {r && <span className="am-g-stats">This morning: <b className="num">{r.guardian.allowed.toLocaleString('en-AU')}</b> plans allowed, <b className="num stopn">{r.guardian.blockedDrafts}</b> drafts stopped</span>}
          <span className="am-g-stats">Live: <b className="num">{g.filter((t) => t.verdict === 'allow').length}</b> allowed, <b className="num stopn">{g.filter((t) => t.verdict === 'block').length}</b> stopped</span>
          <span className="mono am-last">{last('guardian')?.result ?? 'waiting'}</span>
        </button>
        <div className="am-arrow">→</div>
        <div className="am-col">
          <div className="am-out"><b className="small">Customers</b><span className="tiny muted">SMS · email · Pay Assist chat</span>{r && <span className="tiny num">{r.decisions.ai.toLocaleString('en-AU')} contacted today</span>}</div>
          <div className="am-out"><b className="small">Specialists</b><span className="tiny muted">Queues · case cards · Copilot</span>{r && <span className="tiny num">{r.decisions.human.toLocaleString('en-AU')} cases</span>}</div>
          <div className="am-out"><b className="small">Billing / CRM</b><span className="tiny muted">Arrangements · notes</span><span className="tiny num">{writes} write-backs</span></div>
        </div>
      </div>
      <div className="row tiny mt12 am-legend">
        <span><i className="lg working" />Working now</span><span><i className="lg done" />Has worked</span><span><i className="lg idle" />Idle</span>
        <span className="muted">Click any agent to see its tool calls.</span>
      </div>
    </>
  );
}

function ToolCalls() {
  const trace = useApp((s) => s.trace);
  const agent = useApp((s) => s.agentFilter);
  const openConsole = useApp((s) => s.openConsole);
  const [verdict, setVerdict] = useState<'all' | 'guardian' | 'block'>('all');
  const [q, setQ] = useState('');
  const rows = trace.filter((t) => (!agent || t.agent === agent)
    && (verdict === 'all' || (verdict === 'block' ? t.verdict === 'block' : !!t.verdict))
    && (!q || `${t.tool} ${t.result}`.toLowerCase().includes(q.toLowerCase())));

  return (
    <>
      <div className="filters">
        <select value={agent ?? ''} onChange={(e) => openConsole('calls', { agent: (e.target.value || null) as AgentId | null })} aria-label="Agent">
          <option value="">All agents</option>
          {AGENTS.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <div className="seg">
          {([['all', 'Everything'], ['guardian', 'Guardian decisions'], ['block', 'Stops only']] as const).map(([v, l]) => (
            <button key={v} className={verdict === v ? 'on' : ''} onClick={() => setVerdict(v)}>{l}</button>
          ))}
        </div>
        <input className="search" placeholder="Search tool calls" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="tiny muted" style={{ marginLeft: 'auto' }}>{rows.length} of {trace.length}</span>
      </div>
      {trace.length === 0 ? (
        <p className="tiny ctip">No tool calls yet. Run the morning assessment, or start Sarah's journey, to watch the agents work.</p>
      ) : (
        <div className="trace mt12">
          {rows.map((t) => (
            <div key={t.id} className={`tline ${t.verdict ?? ''}`}>
              <span className="mono muted">{format(t.at, 'HH:mm:ss')}</span>
              <span className="tag ai">{AGENTS.find((a) => a.id === t.agent)!.name}</span>
              <span className="mono">{t.tool}</span>
              <span className="small">
                {t.verdict && <span className={`tag ${t.verdict === 'block' ? 'solid' : ''}`}>{t.verdict === 'block' ? 'Stop' : 'Allow'}</span>} {t.result}
              </span>
            </div>
          ))}
          {rows.length === 0 && <div className="empty">No tool calls match.</div>}
        </div>
      )}
    </>
  );
}

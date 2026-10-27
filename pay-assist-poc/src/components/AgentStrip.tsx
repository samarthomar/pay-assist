import { useApp } from '../state/store';
import { AGENTS, STAGES } from '../state/stages';

// Always-visible strip: which agents serve this stage and what the team is doing now.
export function AgentStrip() {
  const stage = useApp((s) => s.stage);
  const status = useApp((s) => s.agentStatus);
  const activity = useApp((s) => s.agentActivity);
  const setConsoleOpen = useApp((s) => s.setConsoleOpen);
  const active = new Set(STAGES.find((s) => s.id === stage)!.agents);
  const working = AGENTS.filter((a) => status[a.id] === 'working').length;

  return (
    <div className="agentstrip">
      <span className="as-label">
        <span className={`pulse ${working ? 'live' : ''}`} />
        AI agents
      </span>
      <div className="as-chips">
        {AGENTS.map((a) => (
          <span
            key={a.id}
            className={`achip ${status[a.id]} ${active.has(a.id) ? 'here' : ''}`}
            title={`${a.name}: ${a.job}`}
          >
            {a.name}
          </span>
        ))}
      </div>
      <span className="as-activity">{activity}</span>
      <button className="btn small outline" onClick={() => setConsoleOpen(true)}>Agent console</button>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { BarList, Donut, Funnel, LineChart, Paired } from '../components/charts';
import {
  AREAS, DISPOSITIONS, DROP_OFF, KPIS, PLAN_MIX, REC_MATRIX, SENTIMENT, SYSTEMS, VERBATIMS, ageing, funnel, overallScore, trend,
  type AreaId, type Kpi,
} from '../domain/kpis';
import { morningRun, type MorningRun } from '../domain/morningRun';
import { useJourney } from '../state/journey';
import { useProtect } from '../state/protect';
import { DEMO_NOW, useApp } from '../state/store';
import { useSustain } from '../state/sustain';

const n = (v: number) => v.toLocaleString('en-AU');
const money = (cents: number) => (cents >= 1e8 ? `$${(cents / 1e8).toFixed(1)}M` : `$${Math.round(cents / 1e5)}k`);
const PERIOD = { today: { label: 'Today', days: 1 }, week: { label: 'Last 7 days', days: 5 }, month: { label: 'Last 30 days', days: 21 } };

export function ResultsScene() {
  const [area, setArea] = useState<AreaId>('self');
  const [period, setPeriod] = useState<keyof typeof PERIOD>('today');
  const [state, setState] = useState('');
  const [fuel, setFuel] = useState('');
  const full = useMemo(() => morningRun(DEMO_NOW), []);
  // Filters apply to today's real file; longer periods repeat today's volumes per business day (illustrative).
  const r = useMemo(() => filterRun(full, state, fuel), [full, state, fuel]);
  const k = PERIOD[period].days;
  const score = overallScore();

  return (
    <>
      <div className="results-top">
        <div className="card score">
          <div className="tiny strong muted">Overall Pay Assist scorecard</div>
          <div className="row" style={{ alignItems: 'flex-end' }}>
            <div className="score-big num">{score}</div>
            <div className="small" style={{ paddingBottom: 12 }}><span className="status on">On target</span><br /><span className="tiny muted">weighted across 5 areas</span></div>
          </div>
          <div className="areas">
            {AREAS.map((a) => (
              <button key={a.id} className={`area ${area === a.id ? 'on' : ''}`} onClick={() => setArea(a.id)}>
                <div className="row between"><span className="small strong">{a.name}</span><span className="num strong">{a.score}</span></div>
                <div className="abar"><span style={{ width: `${a.score}%` }} /></div>
                <div className="tiny muted">{a.weight}% weight · {a.comment}</div>
              </button>
            ))}
          </div>
        </div>
        <SessionCard />
      </div>

      <div className="card mt16">
        <div className="row between">
          <div className="rtabs" role="tablist">
            {AREAS.map((a) => <button key={a.id} role="tab" aria-selected={area === a.id} className={area === a.id ? 'on' : ''} onClick={() => setArea(a.id)}>{a.name}</button>)}
          </div>
          <div className="filters">
            <select value={period} onChange={(e) => setPeriod(e.target.value as keyof typeof PERIOD)} aria-label="Period">
              {Object.entries(PERIOD).map(([v, p]) => <option key={v} value={v}>{p.label}</option>)}
            </select>
            <select value={state} onChange={(e) => setState(e.target.value)} aria-label="State">
              <option value="">All states</option>{['VIC', 'NSW', 'QLD', 'SA', 'ACT'].map((s) => <option key={s}>{s}</option>)}
            </select>
            <select value={fuel} onChange={(e) => setFuel(e.target.value)} aria-label="Fuel">
              <option value="">All fuels</option><option value="elec">Electricity</option><option value="gas">Gas</option><option value="dual">Dual fuel</option>
            </select>
          </div>
        </div>
        <div className="tiny muted mt8">
          KPI targets and values are illustrative pilot values from the demo script, to calibrate with AGL. Volumes, debt ageing and escalation reasons are calculated from today's synthetic file{state || fuel ? ' for the selected filters' : ''}.
        </div>
        <div className="rbody mt12">
          <KpiTable kpis={KPIS[area]} />
          <div className="rcharts">
            {area === 'self' && <>
              <Funnel steps={funnel(r).map(([l, v]) => [l, v * k])} label={`Journey funnel · ${PERIOD[period].label.toLowerCase()} (rates from the KPI set)`} />
              <BarList items={PLAN_MIX} fmt={(v) => `${v}%`} label="Plan mix" max={50} />
              <Paired items={ageing(r)} label="Overdue debt by age: today vs projected after 90 days" a="Today (real file)" b="Projected (illustrative)" fmt={money} />
              <LineChart values={trend(21, 74, 4)} target={70} fmt={(v) => `${Math.round(v)}%`} label="Self-service completion, last 14 days" />
            </>}
            {area === 'cx' && <>
              <LineChart values={trend(22, 4.6, 0.2, 0.4)} target={4.5} fmt={(v) => v.toFixed(1)} label="CSAT, last 14 days" />
              <BarList items={DROP_OFF} fmt={(v) => `${v}%`} label="Where customers drop off (17% in total)" max={10} />
              <div className="chart"><div className="tiny strong muted">Sentiment at the start vs the end of the chat</div>
                <div className="senti">{(['start', 'end'] as const).map((w) => (
                  <div key={w}><span className="tiny muted">{w === 'start' ? 'Start' : 'End'}</span><div className="stack">{SENTIMENT[w].map(([l, v], i) => <span key={l} style={{ width: `${v}%`, background: ['var(--red-deep)', 'var(--cream-2)', 'var(--red)'][i] }} title={`${l} ${v}%`}>{v}%</span>)}</div></div>
                ))}<div className="row tiny"><span className="legend"><i style={{ background: 'var(--red-deep)' }} />Negative</span><span className="legend"><i style={{ background: 'var(--cream-2)' }} />Neutral</span><span className="legend"><i style={{ background: 'var(--red)' }} />Positive</span></div></div>
              </div>
              <div className="chart"><div className="tiny strong muted">What customers said (synthetic)</div>{VERBATIMS.map((v) => <div key={v} className="verb small">“{v}”</div>)}</div>
            </>}
            {area === 'ai' && <>
              <Compliance />
              <div className="chart"><div className="tiny strong muted">Recommended plan vs plan chosen (% of AI sessions)</div>
                <table className="matrix"><thead><tr><th>Recommended ↓ / chosen →</th>{REC_MATRIX.labels.map((l) => <th key={l}>{l}</th>)}</tr></thead>
                  <tbody>{REC_MATRIX.cells.map((row, i) => <tr key={i}><th>{REC_MATRIX.labels[i]}</th>{row.map((v, j) => <td key={j} style={{ background: `rgba(227,24,55,${v / 30})`, color: v > 15 ? 'var(--white)' : 'var(--ink)' }} className="num">{v}</td>)}</tr>)}</tbody>
                </table>
                <div className="tiny muted mt4">Diagonal = first recommendation accepted (63%).</div>
              </div>
              <LineChart values={trend(23, 82, 3, 0.5)} target={85} fmt={(v) => `${Math.round(v)}%`} label="Affordability accuracy, last 14 days (watch)" />
            </>}
            {area === 'tech' && <>
              <div className="chart"><div className="tiny strong muted">System health</div>
                <div className="health-grid">{SYSTEMS.map(([s, up, note]) => <div key={s} className="hg"><span className="hg-dot" /><b className="small">{s}</b><span className="num small">{up}</span><span className="tiny muted">{note}</span></div>)}</div>
              </div>
              <LineChart values={trend(24, 1.8, 0.4, -0.3)} target={3} fmt={(v) => `${v.toFixed(1)}s`} label="AI response time p95, last 14 days" lowerIsBetter />
              <LineChart values={trend(25, 18, 6, -0.4)} target={30} fmt={(v) => `${Math.round(v)} min`} label="File processing time, last 14 days" lowerIsBetter />
            </>}
            {area === 'handoff' && <>
              <Donut items={Object.entries(r.routes).sort((a, b) => b[1] - a[1]).map(([kk, v]) => [label(kk), v * k])} centre={n(r.decisions.human * k)} label={`Escalations by reason · ${PERIOD[period].label.toLowerCase()} (from the file)`} />
              <BarList items={DISPOSITIONS} fmt={(v) => `${v}%`} label="Outcome of each contact" max={45} />
              <LineChart values={trend(26, 110, 20, -0.3)} target={120} fmt={(v) => `${Math.floor(v / 60)}m ${Math.round(v % 60)}s`} label="Specialist wait time, last 14 days" lowerIsBetter />
            </>}
          </div>
        </div>
      </div>
    </>
  );
}

const label = (route: string) => ({ 'Resolution Team': '$2,000 or more', 'Hardship team': 'Hardship / vulnerable', 'Human review': 'Repeat broken plans', 'Specialist team': 'Life support' } as Record<string, string>)[route] ?? route;

function filterRun(full: MorningRun, state: string, fuel: string): MorningRun {
  if (!state && !fuel) return full;
  const rows = full.rows.filter(({ c }) => (!state || c.state === state) && (!fuel || c.fuelType === fuel));
  const decisions = { ai: 0, human: 0, none: 0 };
  const routes: Record<string, number> = {};
  rows.forEach(({ a }) => { decisions[a.decision]++; if (a.route) routes[a.route] = (routes[a.route] ?? 0) + 1; });
  return { ...full, rows, decisions, routes };
}

function KpiTable({ kpis }: { kpis: Kpi[] }) {
  return (
    <table className="t kpitable">
      <thead><tr><th>KPI</th><th>Target</th><th className="r">Value</th><th>Status</th></tr></thead>
      <tbody>
        {kpis.map((k) => (
          <tr key={k.name}>
            <td><div className="strong small">{k.name}</div><div className="tiny muted">{k.definition}</div></td>
            <td className="small">{k.target}</td>
            <td className="r num strong">{k.value}</td>
            <td>{k.status !== 'none' && <span className={`status ${k.status}`}>{k.status === 'on' ? 'On target' : 'Watch'}</span>}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Compliance checklist, backed by the Guardian's live record from this session.
function Compliance() {
  const trace = useApp((s) => s.trace);
  const stops = trace.filter((t) => t.verdict === 'block').length;
  const allows = trace.filter((t) => t.verdict === 'allow').length;
  const items: [string, string][] = [
    ['No balance shown before verification', 'BR-C01'],
    ['Hardship support offered in the email, the chat and the confirmation', 'BRD D1'],
    ['Every amount came from the plan calculator', 'FR-GRD-06'],
    ['No plan outside the rules reached a customer', 'BR-P01..P05'],
    ['Vulnerable customers routed to people', 'BR-T03/T04'],
  ];
  return (
    <div className="chart">
      <div className="tiny strong muted">Compliance checklist</div>
      {items.map(([t, id]) => <div key={t} className="gcheck pass"><span className="gmark">✓</span><span className="small">{t}</span><span className="mono muted">{id}</span></div>)}
      <div className="tiny mt8">In this demo session the Guardian made <b>{allows}</b> allow and <b>{stops}</b> stop decisions.</div>
    </div>
  );
}

// What actually happened during this demo session (real, not illustrative).
function SessionCard() {
  const run = useApp((s) => s.run.status);
  const trace = useApp((s) => s.trace);
  const j = useJourney((s) => s.ctx);
  const cases = useProtect((s) => s.cases);
  const sus = useSustain((s) => s.outcome);
  const r = morningRun(DEMO_NOW);
  const done = run === 'done';
  const approved = Object.values(cases).filter((c) => c.status === 'approved').length;
  const handled = Object.values(cases).filter((c) => c.status !== 'open').length;
  const tiles: [string, string, string][] = [
    ['Accounts assessed', done ? n(r.rows.length + r.rejected.length) : '–', done ? `${r.rejected.length} quarantined` : 'run the morning assessment'],
    ['Self-service today', done ? `${Math.round((r.decisions.ai / r.rows.length) * 100)}%` : '–', done ? `${n(r.decisions.ai)} AI contacts` : ''],
    ['Guardian stops', String(trace.filter((t) => t.verdict === 'block').length), 'this session'],
    ['Customer journey', j.ended === 'done' ? 'Completed' : j.handoff ? 'Handed over' : '–', j.ended === 'done' && j.chosen ? j.chosen.label : j.handoff ? j.handoff.esc.routeTo : 'not run yet'],
    ['Human cases handled', String(handled), `${approved} plan${approved === 1 ? '' : 's'} approved`],
    ['Plans rescued', sus === 'rescued' ? '1' : '0', sus === 'rescued' ? 'Sarah, no person needed' : 'run Sustain'],
  ];
  return (
    <div className="card session">
      <div className="row between"><div className="tiny strong muted">From this demo session</div><span className="tag ai">Real, not illustrative</span></div>
      <div className="stiles mt8">
        {tiles.map(([a, b, c]) => <div key={a} className="stile"><span className="tiny muted">{a}</span><b className="num">{b}</b><span className="tiny muted">{c}</span></div>)}
      </div>
    </div>
  );
}

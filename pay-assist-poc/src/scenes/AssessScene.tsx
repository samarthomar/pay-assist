import { useMemo, useRef, useState, type DragEvent } from 'react';
import { fuelLabel } from '../domain/customers';
import { dollars, wholeDollars } from '../domain/money';
import {
  DEBT_BAND_LABEL, PLAN_LABEL, debtBand, decisionLabel, morningRun, toCsv, type DebtBand, type Row,
} from '../domain/morningRun';
import type { ContactDecision, PlanType } from '../domain/types';
import { CustomerDrawer } from '../components/CustomerDrawer';
import { receiveFile, runSteps, skipRun, startRun } from '../state/runner';
import { DEMO_NOW, useApp } from '../state/store';
import { AGENTS } from '../state/stages';

const n = (v: number) => v.toLocaleString('en-AU');
const pct = (v: number, of: number) => `${Math.round((v / of) * 100)}%`;
const PAGE = 25;

export function AssessScene() {
  const run = useApp((s) => s.run);
  const r = useMemo(() => morningRun(DEMO_NOW), []);
  const steps = useMemo(() => runSteps(r), [r]);
  const done = run.status === 'done';
  // A result is shown once the step that produces it has finished.
  const reached = (i: number) => done || (run.status === 'running' && run.step > i);
  const live = (i: number, total: number) => (reached(i) ? total : run.status === 'running' && run.step === i ? Math.round(total * run.progress) : null);

  return (
    <>
      <div className="assess-top">
        <div className="col">
          <FileCard />
          <RunSteps steps={steps} />
        </div>
        <div className="col">
          <div className="card outcome">
            <div className="row between">
              <h3>Run outcome</h3>
              {run.status === 'running' && <button className="btn small ghost" onClick={skipRun}>Skip animation</button>}
              {done && <span className="tag ai">Completed · ready before 8 am</span>}
            </div>
            <div className="kpis mt12">
              <Kpi label="Accounts checked" value={live(1, r.total)} sub={reached(1) ? `${r.rejected.length} quarantined` : undefined} />
              <Kpi label="AI contact" value={reached(2) ? r.decisions.ai : null} sub={reached(2) ? `${pct(r.decisions.ai, r.rows.length)} self-service` : undefined} accent />
              <Kpi label="Human contact" value={reached(2) ? r.decisions.human : null} sub={reached(2) ? 'case cards prepared' : undefined} />
              <Kpi label="Do not contact" value={reached(2) ? r.decisions.none : null} sub={reached(2) ? 'paid or opted out' : undefined} />
            </div>
            <SplitBar show={reached(2)} parts={[
              { label: 'AI contact', v: r.decisions.ai, cls: 'ai' },
              { label: 'Human contact', v: r.decisions.human, cls: 'human' },
              { label: 'Do not contact', v: r.decisions.none, cls: 'none' },
            ]} />
            <div className="breakdowns mt16">
              <Breakdown title="Affordability" show={reached(3)} items={[
                ['High', r.bands.High], ['Medium', r.bands.Medium], ['Low', r.bands.Low]]} />
              <Breakdown title="Recommended plans (AI)" show={reached(4)} items={
                (Object.entries(r.plans) as [PlanType, number][]).sort((a, b) => b[1] - a[1]).map(([k, v]) => [PLAN_LABEL[k], v])} />
              <Breakdown title="Human teams" show={reached(8)} items={
                Object.entries(r.routes).sort((a, b) => b[1] - a[1])} />
              <Breakdown title="Not contacted" show={reached(2)} items={Object.entries(r.noneReasons)} />
            </div>
            {reached(5) && (
              <div className="guardian-note mt16">
                <span className="tag solid">Guardian</span>
                <span className="small">
                  Blocked <b>{n(r.guardian.blockedDrafts)}</b> draft extensions for invoices over 90 days (BR-T05). The Plan agent rebuilt
                  them as pay-in-full offers. <b>{n(r.guardian.allowed)}</b> of {n(r.decisions.ai)} final plans passed every rule.
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
      {done && (
        <>
          <Quarantine />
          <DecisionTable rows={r.rows} />
        </>
      )}
    </>
  );
}

function FileCard() {
  const run = useApp((s) => s.run);
  const r = useMemo(() => morningRun(DEMO_NOW), []);
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  if (run.status === 'idle') {
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      setOver(false);
      receiveFile(e.dataTransfer.files[0]?.name);
    };
    return (
      <div
        className={`card dropzone ${over ? 'over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
      >
        <FileIcon />
        <h3 className="mt8">Today's overdue file</h3>
        <p className="small muted">Arrives from AGL billing at 06:12 each business day. Drop a CSV or Excel file here, or use today's sample.</p>
        <div className="row mt12" style={{ justifyContent: 'center' }}>
          <button className="btn primary" onClick={() => receiveFile()}>Use today's file</button>
          <button className="btn" onClick={() => input.current?.click()}>Choose a file…</button>
        </div>
        <input ref={input} type="file" accept=".csv,.xlsx,.xls" hidden onChange={(e) => receiveFile(e.target.files?.[0]?.name)} />
      </div>
    );
  }
  return (
    <div className="card filecard">
      <div className="row">
        <FileIcon small />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="strong small ellipsis">{r.file.name}</div>
          <div className="tiny muted">Received 06:12 · {n(r.total)} rows · {n(r.byFuel.elec)} electricity, {n(r.byFuel.gas)} gas, {n(r.byFuel.dual)} dual fuel</div>
        </div>
      </div>
      {run.uploadedName && <div className="tiny muted mt8">You chose “{run.uploadedName}”. For the demo, agents use the synthetic file above.</div>}
      {run.status === 'ready' && (
        <button className="btn primary mt12 full" onClick={startRun}>Run morning assessment</button>
      )}
    </div>
  );
}

function FileIcon({ small }: { small?: boolean }) {
  const s = small ? 30 : 44;
  return (
    <svg width={s} height={s} viewBox="0 0 44 44" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M10 4h17l9 9v25a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" fill="var(--red-tint)" stroke="var(--red)" strokeWidth="1.6" />
      <path d="M27 4v9h9" fill="none" stroke="var(--red)" strokeWidth="1.6" />
      <path d="M14 22h16M14 27h16M14 32h10" stroke="var(--red)" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function RunSteps({ steps }: { steps: ReturnType<typeof runSteps> }) {
  const run = useApp((s) => s.run);
  return (
    <div className="card mt16">
      <h3>Agent run</h3>
      <div className="sub">Each agent calls a tool; the Guardian can veto.</div>
      <ol className="steps">
        {steps.map((s, i) => {
          const state = run.status === 'done' || (run.status === 'running' && i < run.step) ? 'done'
            : run.status === 'running' && i === run.step ? 'working' : 'pending';
          const name = AGENTS.find((a) => a.id === s.agent)!.name;
          return (
            <li key={i} className={`step ${state} ${s.verdict === 'block' && state === 'done' ? 'veto' : ''}`}>
              <span className="sdot" />
              <div className="sbody">
                <div className="row between">
                  <span className="small"><b>{name}</b> · {s.title}</span>
                  {state === 'working' && s.units > 0 && <span className="tiny num red">{n(Math.round(s.units * run.progress))}</span>}
                </div>
                {state !== 'pending' && <div className="mono stool">{s.tool}</div>}
                {state === 'working' && <div className="sbar"><span style={{ width: `${run.progress * 100}%` }} /></div>}
                {state === 'done' && (
                  <div className="small sres">
                    {s.verdict && <span className={`tag ${s.verdict === 'block' ? 'solid' : 'ai'}`}>{s.verdict === 'block' ? 'Vetoed' : 'Allowed'}</span>} {s.result}
                    {s.detail && <div className="tiny muted">{s.detail}</div>}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Kpi({ label, value, sub, accent }: { label: string; value: number | null; sub?: string; accent?: boolean }) {
  return (
    <div className={`kpi ${accent ? 'accent' : ''}`}>
      <div className="label">{label}</div>
      <div className="value num">{value === null ? '–' : n(value)}</div>
      <div className="tiny muted">{sub ?? ' '}</div>
    </div>
  );
}

function SplitBar({ show, parts }: { show: boolean; parts: { label: string; v: number; cls: string }[] }) {
  const total = parts.reduce((s, p) => s + p.v, 0);
  return (
    <div className="split mt16" aria-hidden={!show}>
      <div className="sbar-track">
        {parts.map((p) => (
          <span key={p.cls} className={p.cls} style={{ width: show ? `${(p.v / total) * 100}%` : 0 }} title={`${p.label}: ${n(p.v)}`} />
        ))}
      </div>
      {show && (
        <div className="row tiny mt8">
          {parts.map((p) => <span key={p.cls} className="legend"><i className={p.cls} />{p.label} {pct(p.v, total)}</span>)}
        </div>
      )}
    </div>
  );
}

function Breakdown({ title, show, items }: { title: string; show: boolean; items: [string, number][] }) {
  const max = Math.max(...items.map(([, v]) => v), 1);
  return (
    <div className="bd">
      <div className="tiny strong muted">{title}</div>
      {show ? items.map(([k, v]) => (
        <div key={k} className="bd-row">
          <span className="tiny">{k}</span>
          <span className="bd-bar"><span style={{ width: `${(v / max) * 100}%` }} /></span>
          <span className="tiny num">{n(v)}</span>
        </div>
      )) : <div className="tiny muted mt8">Waiting…</div>}
    </div>
  );
}

function Quarantine() {
  const r = useMemo(() => morningRun(DEMO_NOW), []);
  const [open, setOpen] = useState(false);
  return (
    <div className="card mt16">
      <div className="row between">
        <div>
          <h3>Quarantined by the Intake agent</h3>
          <div className="sub" style={{ marginBottom: 0 }}>
            {r.rejected.length} records held back for the data team instead of being guessed at:{' '}
            {Object.entries(r.rejectedByReason).map(([k, v]) => `${v} × ${k.split(':')[0].toLowerCase()}`).join(', ')}
          </div>
        </div>
        <button className="btn small" onClick={() => setOpen((o) => !o)}>{open ? 'Hide records' : 'Show records'}</button>
      </div>
      {open && (
        <table className="t mt12">
          <thead><tr><th>Customer ID</th><th>Name</th><th>Reason</th></tr></thead>
          <tbody>
            {r.rejected.map(({ customer: c, reason }, i) => (
              <tr key={i}><td className="mono">{c.id}</td><td>{c.name}</td><td>{reason}</td></tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

type Filters = { q: string; state: string; fuel: string; band: '' | DebtBand; decision: '' | ContactDecision; plan: string };
const NO_FILTERS: Filters = { q: '', state: '', fuel: '', band: '', decision: '', plan: '' };

function DecisionTable({ rows }: { rows: Row[] }) {
  const log = useApp((s) => s.log);
  const [f, setF] = useState<Filters>(NO_FILTERS);
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<Row | null>(null);
  const set = (patch: Partial<Filters>) => { setF((x) => ({ ...x, ...patch })); setPage(0); };

  const filtered = useMemo(() => {
    const q = f.q.trim().toLowerCase();
    const out = rows.filter(({ c, a, overdueCents }) =>
      (!q || c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q))
      && (!f.state || c.state === f.state)
      && (!f.fuel || c.fuelType === f.fuel)
      && (!f.band || debtBand(overdueCents) === f.band)
      && (!f.decision || a.decision === f.decision)
      && (!f.plan || (a.recommended ?? a.draftForHuman)?.type === f.plan));
    // Demo customers first, so the presenter can find them instantly.
    return [...out.filter((x) => x.c.persona), ...out.filter((x) => !x.c.persona)];
  }, [rows, f]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const shown = filtered.slice(page * PAGE, page * PAGE + PAGE);
  const filteredOn = JSON.stringify(f) !== JSON.stringify(NO_FILTERS);

  const download = () => {
    const blob = new Blob([toCsv(filtered)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filteredOn ? 'pay-assist_assessment_2026-10-14_filtered.csv' : 'pay-assist_assessment_2026-10-14.csv';
    a.click();
    URL.revokeObjectURL(a.href);
    log('human', 'Collections manager', `Downloaded the assessment output (${n(filtered.length)} rows)`);
  };

  return (
    <div className="card mt16">
      <div className="row between">
        <div>
          <h3>Decisions for every account</h3>
          <div className="sub" style={{ marginBottom: 0 }}>Click any customer to see the rules, reasons and Guardian checks behind the decision.</div>
        </div>
        <button className="btn outline" onClick={download}>Download {filteredOn ? `${n(filtered.length)} rows` : 'output'} (CSV for Excel)</button>
      </div>
      <div className="filters mt12">
        <input className="search" placeholder="Search name or customer ID" value={f.q} onChange={(e) => set({ q: e.target.value })} />
        <select value={f.decision} onChange={(e) => set({ decision: e.target.value as Filters['decision'] })} aria-label="Decision">
          <option value="">All decisions</option>
          <option value="ai">AI contact</option>
          <option value="human">Human contact</option>
          <option value="none">Do not contact</option>
        </select>
        <select value={f.state} onChange={(e) => set({ state: e.target.value })} aria-label="State">
          <option value="">All states</option>
          {['VIC', 'NSW', 'QLD', 'SA', 'ACT'].map((s) => <option key={s}>{s}</option>)}
        </select>
        <select value={f.fuel} onChange={(e) => set({ fuel: e.target.value })} aria-label="Fuel">
          <option value="">All fuels</option>
          <option value="elec">Electricity</option>
          <option value="gas">Gas</option>
          <option value="dual">Dual fuel</option>
        </select>
        <select value={f.band} onChange={(e) => set({ band: e.target.value as Filters['band'] })} aria-label="Debt band">
          <option value="">All amounts</option>
          {(Object.keys(DEBT_BAND_LABEL) as DebtBand[]).map((b) => <option key={b} value={b}>{DEBT_BAND_LABEL[b]}</option>)}
        </select>
        <select value={f.plan} onChange={(e) => set({ plan: e.target.value })} aria-label="Plan">
          <option value="">All plans</option>
          {(['extension', 'full', 'instalment', 'assist'] as PlanType[]).map((p) => <option key={p} value={p}>{PLAN_LABEL[p]}</option>)}
        </select>
        {filteredOn && <button className="btn small ghost" onClick={() => set(NO_FILTERS)}>Clear filters</button>}
        <span className="tiny muted" style={{ marginLeft: 'auto' }}>{n(filtered.length)} of {n(rows.length)} accounts</span>
      </div>
      <div className="table-wrap mt12">
        <table className="t decisions">
          <thead>
            <tr>
              <th>Customer</th><th>State</th><th>Fuel</th><th className="r">Overdue</th><th className="r">Days</th>
              <th>Affordability</th><th>Decision</th><th>Plan</th><th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => {
              const { c, a, overdueCents, days } = row;
              const p = a.recommended ?? a.draftForHuman;
              return (
                <tr key={c.id} onClick={() => setOpen(row)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setOpen(row)}>
                  <td>
                    <div className="strong">{c.name} {c.persona && <span className="tag ai">Demo</span>}</div>
                    <div className="mono muted">{c.id}</div>
                  </td>
                  <td>{c.state}</td>
                  <td>{fuelLabel(c)}</td>
                  <td className="r num">{wholeDollars(overdueCents)}</td>
                  <td className="r num">{days}</td>
                  <td><span className={`band ${a.affordability.band}`}>{a.affordability.band}</span> <span className="tiny muted num">{a.affordability.index.toFixed(2)}</span></td>
                  <td><span className={`dec ${a.decision}`}>{decisionLabel(a)}</span>{a.priority && <span className="tag red" style={{ marginLeft: 4 }}>Priority</span>}</td>
                  <td className="small">{p ? (a.recommended ? PLAN_LABEL[p.type] : <span className="muted">Draft: {PLAN_LABEL[p.type]}</span>) : <span className="muted">–</span>}
                    {p?.instalmentCents ? <div className="tiny muted num">{p.count} × {dollars(p.instalmentCents)}</div> : null}
                  </td>
                  <td className="small reason">{a.reason}</td>
                </tr>
              );
            })}
            {shown.length === 0 && <tr><td colSpan={9} className="empty">No accounts match these filters.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="row between mt12">
        <span className="tiny muted">Page {page + 1} of {n(pages)}</span>
        <div className="row">
          <button className="btn small" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</button>
          <button className="btn small" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      </div>
      {open && <CustomerDrawer row={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

import { useMemo, useState } from 'react';
import { RuleCode } from './RuleBook';
import { format } from 'date-fns';
import { fuelLabel, PERSONAS, totalOverdue } from '../domain/customers';
import { dollars } from '../domain/money';
import { RULE_BOOK } from '../domain/ruleBook';
import { buildTrace, customerById, findCustomers } from '../domain/trace';
import { customer as journeyCustomer, useJourney } from '../state/journey';
import { useProtect } from '../state/protect';
import { DEMO_NOW, useApp } from '../state/store';
import { AGENTS } from '../state/stages';

const VERDICT: Record<string, string> = { allow: 'Allowed', block: 'Stopped', human: 'Person decides' };

// Every decision for one customer, from the morning file to the latest action, each tied to its rule.
export function CustomerTrace() {
  const id = useApp((s) => s.traceId) ?? PERSONAS[0].id;
  const openConsole = useApp((s) => s.openConsole);
  const audit = useApp((s) => s.audit);
  const behind = useJourney((s) => s.behind);
  useJourney((s) => s.who);
  const cases = useProtect((s) => s.cases);
  const [q, setQ] = useState('');
  const found = useMemo(() => findCustomers(q), [q]);
  const hit = customerById(id);
  if (!hit) return <div className="empty">Customer not found.</div>;
  const { c, quarantined } = hit;
  const steps = buildTrace(c, DEMO_NOW, quarantined);

  // What has happened to this customer during the demo so far.
  const inJourney = journeyCustomer().id === c.id ? [...behind].reverse() : [];
  const human = audit.filter((e) => e.text.includes(c.name)).reverse();
  const caseSt = cases[`CASE-${c.id.slice(3)}`] ?? cases[`LIVE-${c.id.slice(3)}`];
  const used = [...new Set(steps.flatMap((s) => s.rules))].filter((r) => RULE_BOOK[r]);

  return (
    <div className="ctrace">
      <div className="ct-pick">
        <div className="row">
          {PERSONAS.map((p) => (
            <button key={p.id} className={`qteam ${p.id === c.id ? 'on' : ''}`} onClick={() => openConsole('trace', { traceId: p.id })}>{p.name}</button>
          ))}
        </div>
        <div className="ct-search">
          <input className="search" placeholder="Search any of the 12,457 customers by name or ID" value={q} onChange={(e) => setQ(e.target.value)} />
          {found.length > 0 && (
            <div className="ct-results">
              {found.map(({ c: f, quarantined: qq }) => (
                <button key={f.id + (qq ?? '')} onClick={() => { openConsole('trace', { traceId: f.id }); setQ(''); }}>
                  <span className="small strong">{f.name}</span> <span className="mono muted">{f.id}</span>{qq && <span className="tag red">Quarantined</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="ct-grid mt12">
        <div>
          <div className="ct-who">
            <div className="strong">{c.name}</div>
            <div className="tiny muted">{c.id} · {c.state || 'no state'} · {fuelLabel(c)} · overdue {dollars(totalOverdue(c))}</div>
          </div>
          <ol className="ct-steps">
            {steps.map((s, i) => (
              <li key={i} className={`ct-step ${s.verdict ?? ''}`}>
                <div className="row between">
                  <span className="small"><span className="tag ai">{AGENTS.find((a) => a.id === s.agent)!.name}</span> <b>{s.title}</b></span>
                  {s.verdict && <span className={`tag ${s.verdict === 'block' ? 'solid' : s.verdict === 'human' ? '' : 'ai'}`}>{VERDICT[s.verdict]}</span>}
                </div>
                <div className="small mt4">{s.detail}</div>
                {s.checks && (
                  <div className="ct-checks">
                    {s.checks.map((k, j) => <span key={j} className={`tiny ${k.pass ? '' : 'red'}`}>{k.pass ? '✓' : '✕'} {k.text}</span>)}
                  </div>
                )}
                {s.rules.length > 0 && <div className="row mt4">{s.rules.map((r) => <RuleCode key={r} id={r} />)}</div>}
              </li>
            ))}
            {inJourney.length > 0 && (
              <li className="ct-step live">
                <div className="small"><span className="tag solid">Live</span> <b>During the demo journey</b></div>
                {inJourney.map((b) => <div key={b.id} className="tiny mt4"><span className="mono muted">{b.at}</span> <b>{AGENTS.find((a) => a.id === b.agent)!.name}</b> · {b.text}</div>)}
              </li>
            )}
            {(human.length > 0 || caseSt) && (
              <li className="ct-step human">
                <div className="small"><span className="tag">Person</span> <b>Human actions</b>{caseSt && ` · case ${caseSt.status}`}</div>
                {human.map((e) => <div key={e.id} className="tiny mt4"><span className="mono muted">{format(e.at, 'HH:mm')}</span> <b>{e.actor}</b> · {e.text}</div>)}
              </li>
            )}
          </ol>
        </div>
        <aside className="ct-rules">
          <div className="tiny strong muted">Rules referenced</div>
          {used.map((r) => <div key={r} className="rule"><RuleCode id={r} className="mono red" /><span className="tiny">{RULE_BOOK[r]}</span></div>)}
        </aside>
      </div>
    </div>
  );
}

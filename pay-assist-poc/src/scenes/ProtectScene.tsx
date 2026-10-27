import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { RuleCode } from '../components/RuleBook';
import { format, parseISO } from 'date-fns';
import { copilot, morningCases, planOptions, type Case } from '../domain/cases';
import { fuelLabel, totalOverdue } from '../domain/customers';
import { checkPlan } from '../domain/guardian';
import { dollars, wholeDollars } from '../domain/money';
import type { Frequency, Plan } from '../domain/types';
import { DEMO_NOW, useApp } from '../state/store';
import {
  REF, customer, specialistJoin, specialistSay, useJourney,
} from '../state/journey';
import {
  SPECIALIST, approve, caseState, logCall, protectAction, reject, useProtect,
} from '../state/protect';

const secs = (n = 0) => `${n} second${n === 1 ? '' : 's'}`;
const TEAMS = ['All', 'Live', 'Resolution Team', 'Specialist team', 'Hardship team', 'Human review'];
const short: Record<string, string> = { 'Resolution Team': 'Resolution', 'Specialist team': 'Specialist', 'Hardship team': 'Hardship', 'Human review': 'Review' };

function useLiveCase(): Case | null {
  const handoff = useJourney((s) => s.ctx.handoff);
  const who = useJourney((s) => s.who);
  return useMemo(() => {
    if (!handoff) return null;
    const c = customer();
    return {
      id: `LIVE-${c.id.slice(3)}`, c, a: { customerId: c.id, decision: 'human', segment: 'Live handover', affordability: { index: 0, band: 'Medium' }, extensionAllowed: false, eligible: [], priority: true, reasonCode: handoff.esc.id, reason: handoff.esc.trigger, rules: [{ id: handoff.esc.id, text: handoff.esc.trigger }] },
      team: handoff.esc.routeTo as Case['team'], kind: 'live', priority: handoff.esc.priority,
      reason: handoff.esc.trigger, waiting: 'just now', esc: handoff.esc, signal: handoff.signal,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handoff?.esc.id, handoff?.at, who]);
}

export function ProtectScene() {
  const { cases, totals } = useMemo(() => morningCases(DEMO_NOW), []);
  const live = useLiveCase();
  const all = live ? [live, ...cases] : cases;
  const { selected, team, select, setTeam } = useProtect();
  const states = useProtect((s) => s.cases);
  const current = all.find((k) => k.id === selected) ?? null;

  useEffect(() => { if (live && !selected) select(live.id); }, [live, selected, select]);

  const shown = all.filter((k) => team === 'All' || (team === 'Live' ? k.kind === 'live' : k.team === team))
    .sort((a, b) => Number(b.kind === 'live') - Number(a.kind === 'live') || Number(!!b.c.persona) - Number(!!a.c.persona) || Number(b.priority) - Number(a.priority));
  const humanTotal = Object.values(totals).reduce((s, v) => s + v, 0);

  return (
    <div className="protect-grid">
      <aside className="card queue">
        <h3>Human queues</h3>
        <div className="sub">{humanTotal.toLocaleString('en-AU')} cases from this morning{live ? ' + 1 live handover' : ''}. Each arrives with a case card.</div>
        <div className="qteams">
          {TEAMS.map((t) => {
            const n = t === 'All' ? humanTotal + (live ? 1 : 0) : t === 'Live' ? (live ? 1 : 0) : totals[t] ?? 0;
            return <button key={t} className={`qteam ${team === t ? 'on' : ''} ${t === 'Live' && live ? 'live' : ''}`} onClick={() => setTeam(t)}>{short[t] ?? t} <span className="num">{n.toLocaleString('en-AU')}</span></button>;
          })}
        </div>
        <div className="qlist">
          {shown.map((k) => {
            const st = states[k.id]?.status;
            return (
              <button key={k.id} className={`qitem ${selected === k.id ? 'on' : ''} ${k.kind === 'live' ? 'live' : ''}`} onClick={() => select(k.id)}>
                <div className="row between">
                  <span className="strong small">{k.c.name}{k.c.persona && <span className="tag ai" style={{ marginLeft: 6 }}>Demo</span>}</span>
                  <span className="num small">{k.kind === 'live' && k.esc?.id === 'ESC-03' ? '' : wholeDollars(totalOverdue(k.c))}</span>
                </div>
                <div className="tiny muted ellipsis">{k.kind === 'live' ? `Live chat · ${k.reason}` : k.reason}</div>
                <div className="row tiny mt4">
                  <span className="tag">{short[k.team] ?? k.team}</span>
                  {k.priority && <span className="tag solid">Priority</span>}
                  {st && st !== 'open' && <span className="tag ai">✓ {st === 'protected' ? 'Protected' : st[0].toUpperCase() + st.slice(1)}</span>}
                  <span className="muted" style={{ marginLeft: 'auto' }}>{k.waiting}</span>
                </div>
              </button>
            );
          })}
          {shown.length === 0 && <div className="empty">No cases in this queue.</div>}
        </div>
        <div className="tiny muted mt8">Showing a sample of each queue for the demo.</div>
      </aside>
      {current ? <CaseView key={current.id} k={current} /> : (
        <div className="card empty-case">
          <h3>Pick a case</h3>
          <p className="small muted">Try <b>Priya Raman</b> ($2,640: approve an AI-drafted plan in one click), <b>Margaret Hughes</b> (life support: never messaged), or run Scene 6 for a live distress handover.</p>
        </div>
      )}
    </div>
  );
}

function CaseView({ k }: { k: Case }) {
  const cp = useMemo(() => copilot(k, DEMO_NOW, SPECIALIST), [k]);
  const st = useProtect((s) => s.cases[k.id]) ?? caseState(k.id);
  const [pick, setPick] = useState<Plan | null>(null);

  return (
    <>
      <section className="card case">
        <div className="row between">
          <div>
            <div className="row">
              <h2>{k.c.name}</h2>
              {k.priority && <span className="tag solid">Priority</span>}
              <span className="tag">{k.team}</span>
              <button className="btn small ghost" onClick={() => useApp.getState().openConsole('trace', { traceId: k.c.id })}>Trace</button>
            </div>
            <div className="tiny muted mt4">{k.c.id} · {k.c.state} · {fuelLabel(k.c)} · {k.kind === 'live' ? `handed over at ${useJourney.getState().ctx.handoff?.at}` : 'from the 07:30 morning run'}</div>
          </div>
          {k.kind === 'live' && k.esc?.id === 'ESC-03' ? <span className="tag">Balance hidden: safety first</span> : <div className="case-amt num">{dollars(totalOverdue(k.c))}</div>}
        </div>
        <div className="why mt12">
          <span className="tiny strong">Why this came to a person</span>
          <div className="small">{k.reason}</div>
          <div className="row mt4">{k.a.rules.map((r) => <RuleCode key={r.id} id={r.id} />)}</div>
        </div>
        {k.kind === 'approve' && <ApprovePanel k={k} st={st} pick={pick} setPick={setPick} />}
        {k.kind === 'call' && <CallPanel k={k} st={st} script={cp.script ?? []} notes={cp.notes} />}
        {k.kind === 'live' && <LivePanel k={k} replies={cp.replies ?? []} notes={cp.notes} />}
      </section>
      <aside className="card copilot">
        <div className="row between"><h3>Copilot</h3><span className="tag ai">Handoff agent</span></div>
        <p className="small cp-head">{cp.headline}</p>
        <div className="tiny strong muted mt12">Key facts</div>
        <dl className="facts mt4">{cp.facts.map(([a, b]) => <Fragment key={a}><dt>{a}</dt><dd>{b}</dd></Fragment>)}</dl>
        <div className="tiny strong muted mt12">Suggestions</div>
        {cp.suggestions.map((s) => (
          <div key={s.title} className="sugg">
            <div className="small strong">{s.title}</div>
            <div className="tiny muted">{s.text}</div>
            {s.plan && k.kind === 'approve' && st.status === 'open' && <button className="btn small outline mt4" onClick={() => setPick(s.plan!)}>Use this plan</button>}
            {!s.plan && k.kind === 'live' && k.esc?.id === 'ESC-03' && <ApplyButton k={k} action={s.title} />}
          </div>
        ))}
        <div className="tiny strong muted mt12">Watch-outs</div>
        <ul className="watch">{cp.watchouts.map((w) => <li key={w} className="small">{w}</li>)}</ul>
      </aside>
    </>
  );
}

function ApplyButton({ k, action }: { k: Case; action: string }) {
  const done = useProtect((s) => s.cases[k.id]?.actions.includes(action));
  return <button className={`btn small mt4 ${done ? '' : 'outline'}`} disabled={done} onClick={() => protectAction(k, action)}>{done ? '✓ Applied' : 'Apply'}</button>;
}

function GuardianChecks({ k, plan }: { k: Case; plan: Plan }) {
  const g = checkPlan(k.c, plan, DEMO_NOW);
  return (
    <div className="mt8">
      {g.checks.map((x, i) => {
        const needsHuman = !x.pass && x.id === 'BR-T02';
        return (
          <div key={i} className={`gcheck ${x.pass ? 'pass' : needsHuman ? 'human' : 'fail'}`}>
            <span className="gmark">{x.pass ? '✓' : needsHuman ? '👤' : '✕'}</span>
            <span className="small">{needsHuman ? 'Over the $2,000 AI limit: your approval is required' : x.text}</span>
            <RuleCode id={x.id} className="mono muted" />
          </div>
        );
      })}
    </div>
  );
}

const planWhat = (p: Plan) => p.instalmentCents
  ? `${dollars(p.instalmentCents)} ${p.frequency} × ${p.count}`
  : p.dueDate ? `${dollars(p.totalCents)} by ${format(parseISO(p.dueDate), 'd MMM')}` : dollars(p.totalCents);

function ApprovePanel({ k, st, pick, setPick }: { k: Case; st: ReturnType<typeof caseState>; pick: Plan | null; setPick: (p: Plan | null) => void }) {
  const draft = k.a.draftForHuman!;
  const [editing, setEditing] = useState(false);
  const [freq, setFreq] = useState<Frequency>('fortnightly');
  const [rejecting, setRejecting] = useState(false);
  const plan = pick ?? draft;
  const edited = plan !== draft;
  const options = planOptions(k.c, DEMO_NOW, freq);
  const blocked = checkPlan(k.c, plan, DEMO_NOW).checks.some((x) => !x.pass && x.id !== 'BR-T02');

  if (st.status === 'approved' && st.plan) {
    const p = st.plan;
    return (
      <div className="approved mt16">
        <div className="row"><span className="done-tick sm">✓</span><div><div className="strong">Approved in {secs(st.seconds)}</div><div className="tiny muted">Written to billing/CRM on {k.c.accounts.map((a) => a.number).join(' and ')} · notes saved · customer notified</div></div></div>
        <div className="tiny strong muted mt12">What {k.c.firstName} receives</div>
        <div className="sms-preview small">Hi {k.c.firstName}, it's AGL. Your payment plan is confirmed: {p.instalmentCents ? `${dollars(p.instalmentCents)} ${p.frequency}, starting ${format(parseISO(p.firstDate!), 'EEE d MMM')}` : planWhat(p)}. Details: agl.com.au/pa/{REF(k.c).slice(-6)}. Ref {REF(k.c)}.</div>
        <div className="tiny muted mt8">Compare: today this needs an outbound call, identity checks and manual set-up in billing.</div>
      </div>
    );
  }
  if (st.status === 'rejected') {
    return <div className="approved mt16"><div className="strong">Draft rejected</div><div className="small muted">{st.note}. The case stays in the queue for a call.</div></div>;
  }

  return (
    <div className="mt16">
      <div className="row between">
        <span className="tiny strong">{edited ? 'Plan you selected' : 'Plan drafted by the Plan agent'}</span>
        {edited && <button className="btn small ghost" onClick={() => setPick(null)}>Back to the draft</button>}
      </div>
      <div className={`draft ${edited ? 'edited' : ''}`}>
        <div className="strong">{plan.label}</div>
        <div className="draft-amt num">{planWhat(plan)}</div>
        <div className="small muted">{plan.explanation}</div>
        {plan.firstDate && plan.lastDate && <div className="tiny muted">{format(parseISO(plan.firstDate), 'd MMM yyyy')} to {format(parseISO(plan.lastDate), 'd MMM yyyy')}</div>}
      </div>
      <div className="tiny strong muted mt12">Guardian checks</div>
      <GuardianChecks k={k} plan={plan} />
      {editing && (
        <div className="editor mt12">
          <div className="row between"><span className="tiny strong">Edit the plan (the calculator recalculates, the Guardian re-checks)</span>
            <div className="seg">{(['weekly', 'fortnightly', 'monthly'] as Frequency[]).map((f) => <button key={f} className={f === freq ? 'on' : ''} onClick={() => setFreq(f)}>{f}</button>)}</div>
          </div>
          <div className="plan-opts mt8">
            {options.map((p) => (
              <button key={p.label + p.frequency} className={`popt ${plan.label === p.label && plan.frequency === p.frequency ? 'on' : ''}`} onClick={() => setPick(p)}>
                <span className="small strong">{p.label}</span><span className="small num">{planWhat(p)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {rejecting ? (
        <div className="row mt16">
          {['Customer asked for a call', 'Affordability concerns', 'Possible billing dispute'].map((r) => <button key={r} className="btn small" onClick={() => reject(k, r)}>{r}</button>)}
          <button className="btn small ghost" onClick={() => setRejecting(false)}>Cancel</button>
        </div>
      ) : (
        <div className="row mt16">
          <button className="btn primary big" disabled={blocked} onClick={() => approve(k, plan, edited)}>{edited ? 'Approve edited plan' : 'Approve plan'}</button>
          <button className="btn" onClick={() => setEditing((e) => !e)}>{editing ? 'Close editor' : 'Edit'}</button>
          <button className="btn ghost" onClick={() => setRejecting(true)}>Reject</button>
          {blocked && <span className="tiny red">The Guardian blocks this plan</span>}
        </div>
      )}
    </div>
  );
}

const OUTCOMES = ['Extension agreed', 'Instalments agreed', 'Hardship programme', 'Callback booked', 'No answer, voicemail left'];

function CallPanel({ k, st, script, notes }: { k: Case; st: ReturnType<typeof caseState>; script: string[]; notes: (o: string) => string }) {
  const [outcome, setOutcome] = useState(OUTCOMES[1]);
  const [text, setText] = useState(notes(OUTCOMES[1]));
  return (
    <div className="mt16">
      {k.c.flags.lifeSupport && (
        <div className="never">
          <div className="strong small">Never messaged</div>
          <div className="small">The Guardian applied BR-T03 in the morning run: no SMS, no email, no automated reminder. A person calls instead.</div>
          <div className="row tiny mt4"><span className="tag">SMS 0</span><span className="tag">Email 0</span><span className="tag">Reminders 0</span><span className="tag red">Disconnection protected</span></div>
        </div>
      )}
      <div className="tiny strong muted mt12">Suggested call flow (Copilot)</div>
      <ol className="script">{script.map((l) => <li key={l} className="small">{l}</li>)}</ol>
      {st.status === 'logged' ? (
        <div className="approved mt12"><div className="strong">Call logged in {secs(st.seconds)}</div><div className="small muted">{st.note}</div></div>
      ) : (
        <>
          <div className="row mt12">
            <span className="tiny strong">Outcome</span>
            <select value={outcome} onChange={(e) => { setOutcome(e.target.value); setText(notes(e.target.value)); }}>{OUTCOMES.map((o) => <option key={o}>{o}</option>)}</select>
          </div>
          <div className="tiny strong muted mt8">Notes drafted by Copilot (edit before saving)</div>
          <textarea className="notes" value={text} onChange={(e) => setText(e.target.value)} rows={3} />
          <button className="btn primary mt8" onClick={() => logCall(k, outcome, text)}>Save to CRM</button>
        </>
      )}
    </div>
  );
}

function LivePanel({ k, replies, notes }: { k: Case; replies: string[]; notes: (o: string) => string }) {
  const messages = useJourney((s) => s.messages);
  const joined = useJourney((s) => s.ctx.handoff?.joined);
  const safety = k.esc?.id === 'ESC-03';
  const [full, setFull] = useState(!safety); // safety cases share a minimal summary; others the whole chat
  const [text, setText] = useState('');
  const st = useProtect((s) => s.cases[k.id]);
  const end = useRef<HTMLDivElement>(null);
  const lastCustomer = [...messages].reverse().find((m) => m.from === 'customer');
  const since = messages.findIndex((m) => m.from === 'system' && m.text?.includes('joined'));
  const visible = full ? messages : since >= 0 ? messages.slice(since) : [];
  const setStage = useApp((s) => s.setStage);
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }); }, [visible.length]);

  return (
    <div className="mt16">
      <div className="never">
        {safety ? <>
          <div className="strong small">Collections stopped by the Guardian</div>
          <div className="small">Pay Assist stopped mid-conversation, told {k.c.firstName} a specialist was coming, and passed only a minimal safety summary (ESC-03).</div>
        </> : <>
          <div className="strong small">Handed over from the chat ({k.esc?.id})</div>
          <div className="small">Pay Assist told {k.c.firstName} a person was coming and passed on the whole conversation.</div>
        </>}
        {lastCustomer && <div className="quote small mt4">“{lastCustomer.text}”</div>}
      </div>
      <div className="livechat mt12">
        <div className="row between lc-head">
          <span className="small strong">Live chat with {k.c.firstName}</span>
          <div className="row">
            <button className="btn small ghost" onClick={() => setFull((f) => !f)}>{full ? 'Hide earlier messages' : 'Show earlier messages'}</button>
            <button className="btn small ghost" onClick={() => setStage('resolve')}>See their phone</button>
          </div>
        </div>
        <div className="lc-body">
          {visible.map((m) => (
            <div key={m.id} className={`lc-msg ${m.from}`}>
              {m.from === 'system' ? <span className="tiny muted">{m.text}</span> : <><span className="tiny muted">{m.from === 'customer' ? k.c.firstName : m.from === 'human' ? m.name : 'Pay Assist'}</span><div className="small">{m.text}</div></>}
            </div>
          ))}
          {!joined && <div className="tiny muted">{safety ? 'Earlier messages are hidden by default. ' : ''}Join to take over the chat.</div>}
          <div ref={end} />
        </div>
        {!joined ? (
          <button className="btn primary mt8" onClick={() => specialistJoin(SPECIALIST)}>Join chat as {SPECIALIST}</button>
        ) : (
          <>
            <div className="tiny strong muted mt8">Copilot suggested replies</div>
            <div className="lc-sugg">{replies.map((r) => <button key={r} className="qr" onClick={() => specialistSay(r)}>{r}</button>)}</div>
            <form className="row mt8" onSubmit={(e) => { e.preventDefault(); specialistSay(text); setText(''); }}>
              <input className="search" style={{ flex: 1 }} value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a reply…" />
              <button className="btn">Send</button>
            </form>
          </>
        )}
      </div>
      {joined && st?.status !== 'logged' && (
        <button className="btn outline mt12" onClick={() => logCall(k, 'Safety handover completed', notes(`Actions: ${(st?.actions ?? []).join('; ') || 'none yet'}`))}>Save case notes</button>
      )}
      {st?.status === 'logged' && <div className="approved mt12"><div className="strong">Case notes saved</div><div className="small muted">{st.note}</div></div>}
    </div>
  );
}

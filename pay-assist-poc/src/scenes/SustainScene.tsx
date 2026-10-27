import { useEffect, useRef } from 'react';
import { RuleCode } from '../components/RuleBook';
import { format, parseISO } from 'date-fns';
import { dollars } from '../domain/money';
import { schedule } from '../domain/sustain';
import { useApp } from '../state/store';
import { AGENTS } from '../state/stages';
import { STEP_LABELS, fastForward, reply, restartSustain, sustainPlan, useSustain } from '../state/sustain';

export function SustainScene() {
  const s = useSustain();
  const p = sustainPlan();
  const dates = schedule(p);
  const setStage = useApp((x) => x.setStage);
  useEffect(() => { if (s.step === 0 && s.status.length !== dates.length) restartSustain(); }, [s.step, s.status.length, dates.length]);
  const paid = s.status.filter((x) => x === 'paid').length;
  const health = s.outcome === 'human' ? 'With a person' : s.status.includes('failed') ? 'At risk' : s.outcome === 'rescued' ? 'Rescued' : 'On track';
  const canAdvance = !s.awaitingReply && s.step < 5 && !(s.step === 4 && s.outcome !== 'rescued');

  return (
    <div className="journey-grid">
      <div className="phone-col"><SmsPhone /></div>
      <div className="side-col">
        <div className="card ff">
          <div>
            <div className="tiny strong muted">Simulated date</div>
            <div className="ff-now num">{s.now}</div>
            <ol className="ff-steps">
              {STEP_LABELS.map((l, i) => <li key={l} className={i < s.step ? 'past' : i === s.step ? 'on' : ''}>{l}</li>)}
            </ol>
          </div>
          <div className="row">
            {s.awaitingReply && <span className="tiny red strong">Waiting for Sarah's reply on the phone</span>}
            {canAdvance && <button className="btn primary big" onClick={fastForward}>Fast-forward ▸ {STEP_LABELS[s.step + 1]}</button>}
            {s.step === 5 && <button className="btn primary big" onClick={() => setStage('results')}>See the results ▸</button>}
            <button className="btn small ghost" onClick={restartSustain}>Restart</button>
          </div>
        </div>

        <div className="card mt16">
          <div className="row between">
            <div>
              <h3>Sarah's plan · {p.label}</h3>
              <div className="sub" style={{ marginBottom: 0 }}>{dollars(p.instalmentCents!)} {p.frequency}, {p.count} payments, {format(parseISO(dates[0]), 'd MMM yyyy')} to {format(parseISO(dates[dates.length - 1]), 'd MMM yyyy')} · Ref PA-2026-100815</div>
            </div>
            <span className={`health ${health.replace(/ /g, '-').toLowerCase()}`}>{health}</span>
          </div>
          <div className="tl mt12" aria-label="Payment timeline">
            {dates.map((d, i) => (
              <div key={d} className={`tl-pay ${s.status[i]}`} title={`${i + 1}. ${format(parseISO(d), 'EEE d MMM yyyy')}: ${s.status[i]}`}>
                <span className="tl-dot">{s.status[i] === 'paid' ? '✓' : s.status[i] === 'failed' ? '✕' : s.status[i] === 'moved' ? '↷' : ''}</span>
                {(i === 0 || i === dates.length - 1) && <span className="tl-date tiny">{format(parseISO(d), 'd MMM')}</span>}
              </div>
            ))}
          </div>
          {s.movedTo && <div className="tiny mt8"><b>Payment 2</b> moved from {format(parseISO(dates[1]), 'EEE d MMM')} to <b>{format(parseISO(s.movedTo), 'EEE d MMM')}</b>. Same amount, same end date.</div>}
          <div className="ph-stats mt12">
            <div><span className="tiny muted">Paid</span><b className="num">{paid} of {dates.length}</b></div>
            <div><span className="tiny muted">Amount paid</span><b className="num">{dollars(paid * p.instalmentCents!)}</b></div>
            <div><span className="tiny muted">Next payment</span><b>{format(parseISO(s.step >= 5 ? dates[2] : s.step >= 3 && s.movedTo ? s.movedTo : dates[Math.min(paid, dates.length - 1)]), 'EEE d MMM')}</b></div>
            <div><span className="tiny muted">Reminders</span><b>2 days before each payment</b></div>
          </div>
          {s.step === 5 && (
            <div className="compare mt12">
              <div><span className="tag solid">With Pay Assist</span><div className="small">Failure spotted in 5 minutes, new date agreed by SMS, plan kept, no person needed.</div></div>
              <div><span className="tag">Without</span><div className="small">The missed payment is found days later, the arrangement breaks and Sarah goes back into the collections queue.</div></div>
            </div>
          )}
          {s.checks && (
            <div className="mt12">
              <div className="tiny strong muted">Guardian checks on the new date</div>
              {s.checks.checks.map((c, i) => (
                <div key={i} className={`gcheck ${c.pass ? 'pass' : 'fail'}`}><span className="gmark">{c.pass ? '✓' : '✕'}</span><span className="small">{c.text}</span><RuleCode id={c.id} className="mono muted" /></div>
              ))}
              <div className="tiny muted mt4">BR-S01 is a proposed rescue rule for AGL to confirm (BRD open point: treatment when a promised payment fails).</div>
            </div>
          )}
        </div>

        <div className="card mt16 behind">
          <h3>Behind the scenes</h3>
          <div className="sub">The Sustain agent, the Plan agent and the Guardian working on Sarah's plan.</div>
          {s.events.length === 0 ? <div className="empty">Press Fast-forward to move through the next two weeks.</div> : (
            <div className="feed">
              {s.events.map((b) => (
                <div key={b.id} className={`fline sus ${b.verdict ?? ''}`}>
                  <span className="mono muted">{b.at.replace(' 2026,', '')}</span>
                  <span className="tag ai">{AGENTS.find((x) => x.id === b.agent)!.name}</span>
                  <div className="small">
                    {b.verdict && <span className={`tag ${b.verdict === 'block' ? 'solid' : ''}`}>{b.verdict === 'block' ? 'Stop' : 'Allow'}</span>} {b.text}
                    {b.tool && <div className="mono muted ftool">{b.tool}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SmsPhone() {
  const s = useSustain();
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [s.sms.length]);
  const time = s.now.split(', ')[1]?.replace(' am', '').replace(' pm', '') ?? '9:15';
  return (
    <div className="phone" aria-label="Sarah's phone">
      <div className="ph-notch" />
      <div className="ph-status"><span className="num">{time}</span><span className="ph-icons">●●● ▮</span></div>
      <div className="ph-screen">
        <div className="ph-app">
          <div className="ph-bar"><span className="ph-back">‹</span><div><div className="strong small">AGL</div><div className="tiny muted">Text message</div></div></div>
          <div className="ph-body sms-body">
            {s.sms.length === 0 && <div className="tiny muted" style={{ textAlign: 'center', marginTop: 40 }}>Sarah's plan started on 14 October.<br />Messages from the Sustain agent appear here.</div>}
            {s.sms.map((m) => (
              <div key={m.id} className={`bubble ${m.from === 'me' ? 'me' : 'in'}`}>
                {m.text}
                <div className="tiny bubble-at">{m.at.replace(' 2026,', ' ·')}</div>
              </div>
            ))}
            {s.awaitingReply && (
              <div className="replies">
                <button className="qr primary" onClick={() => reply('1')}>1</button>
                <button className="qr" onClick={() => reply('2')}>2</button>
                <button className="qr" onClick={() => reply('3')}>3</button>
              </div>
            )}
            <div ref={end} />
          </div>
        </div>
      </div>
      <div className="ph-home" />
    </div>
  );
}

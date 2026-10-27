import { totalOverdue } from '../../domain/customers';
import { dollars } from '../../domain/money';
import { PLAN_LABEL, decisionLabel } from '../../domain/morningRun';
import { assess } from '../../domain/rules';
import { DEMO_NOW } from '../../state/store';
import { AGENTS } from '../../state/stages';
import {
  OTP, customer, discloseDistress, restart, sendMessages, skipToChat, useJourney, type JourneyPersona,
} from '../../state/journey';
import { useApp } from '../../state/store';
import { useProtect } from '../../state/protect';
import { Phone } from './Phone';

const WHO: { id: JourneyPersona; label: string }[] = [
  { id: 'Sarah', label: 'Sarah Mitchell · VIC · $847.50' },
  { id: 'B', label: 'Liam Carter · NSW · $310.00' },
  { id: 'E', label: 'Tom Becker · QLD · $690.00 (96 days)' },
];

export function JourneyScene({ mode }: { mode: 'engage' | 'resolve' }) {
  const s = useJourney();
  const c = customer();
  const [y, m, d] = c.dob.split('-');

  return (
    <div className="journey-grid">
      <div className="phone-col">
        <Phone />
      </div>
      <div className="side-col">
        <div className="presenter card">
          <div className="tiny strong muted">Presenter controls</div>
          <select value={s.who} onChange={(e) => restart(e.target.value as JourneyPersona)} aria-label="Customer">
            {WHO.map((w) => <option key={w.id} value={w.id}>{w.label}</option>)}
          </select>
          <label className="tiny row" style={{ gap: 6 }}>
            <input type="checkbox" checked={s.failPayment} onChange={(e) => s.set({ failPayment: e.target.checked })} />
            First payment attempt fails
          </label>
          <div className="tiny muted">DOB {d}/{m}/{y} · code {OTP}</div>
          <div className="row">
            <button className="btn small" onClick={() => restart()}>Restart journey</button>
            {!s.verified && <button className="btn small ghost" onClick={skipToChat}>Skip to chat</button>}
            {mode === 'resolve' && !s.ctx.ended && <button className="btn small ghost" onClick={discloseDistress} title="Simulates the customer saying something that signals distress">Customer discloses distress</button>}
          </div>
        </div>
        {s.ctx.handoff && <HandoffBanner />}
        {mode === 'engage' ? <EngagePlan /> : <CustomerContext />}
        <BehindFeed />
      </div>
    </div>
  );
}

function EngagePlan() {
  const s = useJourney();
  const c = customer();
  const a = assess(c, DEMO_NOW);
  return (
    <div className="card">
      <div className="row between">
        <div>
          <h3>Engagement agent's plan for {c.firstName}</h3>
          <div className="sub" style={{ marginBottom: 0 }}>From the morning run: {decisionLabel(a)}, {a.reason}</div>
        </div>
        {!s.sent ? <button className="btn primary" onClick={sendMessages}>Send at 9:00 am</button> : <span className="tag ai">Sent 9:00 am</span>}
      </div>
      <div className="eplan mt12">
        <div><span className="tiny muted">Channel</span><b>SMS first, then email</b><span className="tiny muted">SMS has the higher open rate for reminders</span></div>
        <div><span className="tiny muted">When</span><b>9:00 am Wednesday</b><span className="tiny muted">Inside permitted contact hours</span></div>
        <div><span className="tiny muted">Message</span><b>Help-first, no balance</b><span className="tiny muted">Balance shown only after DOB + OTP</span></div>
        <div><span className="tiny muted">Login</span><b>Date of birth + one-time code</b><span className="tiny muted">3 attempts, then safe exit</span></div>
      </div>
      <ol className="guide tiny mt12">
        <li className={s.sent ? 'ok' : ''}>Send the messages</li>
        <li className={s.screen !== 'lock' || s.otpSent ? 'ok' : ''}>Open the SMS or email on the phone</li>
        <li className={s.otpSent ? 'ok' : ''}>Tap the secure link and enter the date of birth</li>
        <li className={s.verified ? 'ok' : ''}>Enter the one-time code</li>
        <li>Open Pay Assist (continues in Resolve)</li>
      </ol>
    </div>
  );
}

function CustomerContext() {
  const c = customer();
  const a = assess(c, DEMO_NOW);
  const chosen = useJourney((s) => s.ctx.chosen);
  return (
    <div className="card">
      <div className="row between"><h3>What Pay Assist already knows</h3><button className="btn small ghost" onClick={() => useApp.getState().openConsole('trace', { traceId: c.id })}>Full trace</button></div>
      <div className="sub">Loaded after verification from the morning assessment. The AI never re-calculates amounts itself.</div>
      <div className="ctx-grid">
        <div><span className="tiny muted">Customer</span><b>{c.name}</b><span className="tiny muted">{c.state} · {c.accounts.length > 1 ? 'Dual fuel' : c.accounts[0].fuel}</span></div>
        <div><span className="tiny muted">Overdue</span><b className="num">{dollars(totalOverdue(c))}</b><span className="tiny muted">{c.accounts.map((x) => `${x.fuel === 'gas' ? 'Gas' : 'Elec'} ${dollars(x.overdueCents)}`).join(' · ')}</span></div>
        <div><span className="tiny muted">Affordability</span><b>{a.affordability.band} ({a.affordability.index.toFixed(2)})</b><span className="tiny muted">Paid on time {c.payment.onTimeLast12}/12</span></div>
        <div><span className="tiny muted">Morning recommendation</span><b>{a.recommended ? PLAN_LABEL[a.recommended.type] : '–'}</b><span className="tiny muted">Eligible: {a.eligible.length}</span></div>
      </div>
      {chosen && (
        <div className="chosen mt12">
          <span className="tag solid">Current plan</span>
          <span className="small"><b>{chosen.label}</b>{chosen.instalmentCents ? ` · ${chosen.count} × ${dollars(chosen.instalmentCents)}` : ` · ${dollars(chosen.totalCents)}`}</span>
        </div>
      )}
    </div>
  );
}

function BehindFeed() {
  const behind = useJourney((s) => s.behind);
  return (
    <div className="card mt16 behind">
      <h3>Behind the scenes</h3>
      <div className="sub">Every agent action and Guardian check, live, as the customer moves through the journey.</div>
      {behind.length === 0 ? <div className="empty">Nothing yet. Actions appear here as the journey runs.</div> : (
        <div className="feed">
          {behind.map((b) => (
            <div key={b.id} className={`fline ${b.verdict ?? ''}`}>
              <span className="mono muted">{b.at}</span>
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
  );
}

function HandoffBanner() {
  const h = useJourney((s) => s.ctx.handoff)!;
  const setStage = useApp((s) => s.setStage);
  return (
    <div className="card handoff-banner">
      <div>
        <div className="strong">Handed to a person: {h.esc.routeTo}</div>
        <div className="small">{h.esc.trigger}. The Guardian stopped collections and the Handoff agent sent a case card.{h.joined ? ` ${h.joined} has joined the chat.` : ''}</div>
      </div>
      <button className="btn on-red" onClick={() => { useProtect.getState().select(`LIVE-${customer().id.slice(3)}`); setStage('protect'); }}>Open the specialist's view</button>
    </div>
  );
}

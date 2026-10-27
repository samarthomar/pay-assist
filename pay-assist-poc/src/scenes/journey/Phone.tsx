import { useEffect, useRef, useState, type ReactNode } from 'react';
import { format, parseISO } from 'date-fns';
import { totalOverdue } from '../../domain/customers';
import { cadence, nextDates, rankForBudget, WEEKDAYS } from '../../domain/conversation';
import { dollars } from '../../domain/money';
import type { Frequency, Plan } from '../../domain/types';
import { DEMO_NOW, useApp } from '../../state/store';
import {
  OTP, REF, authorise, budget, customer, openScreen, phoneTime, rate, startChat, submitDob, submitOtp, typed, useJourney, type Card, type Msg,
} from '../../state/journey';

const LINK = 'agl.com.au/pa/7Kx2q';

export function Phone() {
  const screen = useJourney((s) => s.screen);
  useJourney((s) => s.behind.length); // re-render the status-bar clock as the journey moves
  return (
    <div className="phone" aria-label="Customer's phone">
      <div className="ph-notch" />
      <div className="ph-status"><span className="num">{phoneTime()}</span><span className="ph-icons">●●● ▮</span></div>
      <div className="ph-screen">
        {screen === 'lock' && <Lock />}
        {screen === 'sms' && <Sms />}
        {screen === 'email' && <Email />}
        {screen === 'confirm-email' && <ConfirmEmail />}
        {screen === 'verify' && <Verify />}
        {screen === 'chat' && <Chat />}
      </div>
      <div className="ph-home" onClick={() => openScreen('lock')} title="Home" />
    </div>
  );
}

function AppBar({ title, sub, back = 'lock' as const, right }: { title: string; sub?: string; back?: 'lock' | 'chat'; right?: ReactNode }) {
  return (
    <div className="ph-bar">
      <button className="ph-back" onClick={() => openScreen(back)} aria-label="Back">‹</button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="strong small ellipsis">{title}</div>
        {sub && <div className="tiny muted ellipsis">{sub}</div>}
      </div>
      {right}
    </div>
  );
}

function Lock() {
  const sent = useJourney((s) => s.sent);
  const confirm = useJourney((s) => s.confirmEmail);
  const verified = useJourney((s) => s.verified);
  const c = customer();
  return (
    <div className="lock">
      <div className="lock-time num">{phoneTime()}</div>
      <div className="lock-date">{format(DEMO_NOW, 'EEEE d MMMM')}</div>
      <div className="notifs">
        {!sent && <div className="tiny muted" style={{ textAlign: 'center' }}>No notifications</div>}
        {confirm && <Notif app="Mail" from="AGL" text="Your payment plan is confirmed – Ref " bold={REF(c)} onClick={() => openScreen('confirm-email')} />}
        {sent && <Notif app="Messages" from="AGL" text={`Hi ${c.firstName}, it's AGL. You have flexible options to help with your energy account…`} onClick={() => openScreen('sms')} />}
        {sent && <Notif app="Mail" from="AGL" text="Let's find a payment option that works for you" onClick={() => openScreen('email')} />}
        {verified && <button className="btn small primary" onClick={startChat}>Return to Pay Assist chat</button>}
      </div>
    </div>
  );
}

function Notif({ app, from, text, bold, onClick }: { app: string; from: string; text: string; bold?: string; onClick: () => void }) {
  return (
    <button className="notif" onClick={onClick}>
      <div className="row between tiny"><span className="strong">{app}</span><span className="muted">now</span></div>
      <div className="small strong">{from}</div>
      <div className="small notif-text">{text}{bold && <b>{bold}</b>}</div>
    </button>
  );
}

function Sms() {
  const c = customer();
  return (
    <div className="ph-app">
      <AppBar title="AGL" sub="Text message" />
      <div className="ph-body sms-body">
        <div className="tiny muted" style={{ textAlign: 'center' }}>Today 9:00</div>
        <div className="bubble in">
          Hi {c.firstName}, it's AGL. You have flexible options to help with your energy account. View them securely here:{' '}
          <button className="linkish" onClick={() => openScreen('verify')}>{LINK}</button>. Reply STOP to opt out.
        </div>
        <div className="tiny muted guard-hint">No balance shown before verification</div>
      </div>
    </div>
  );
}

function Email() {
  const c = customer();
  return (
    <div className="ph-app">
      <AppBar title="Let's find a payment option that works for you" sub="AGL · 9:02 am" />
      <div className="ph-body mail">
        <p>Hi {c.firstName},</p>
        <p>We noticed there's a payment due on your AGL energy account. We understand things don't always go to plan, and we have flexible options to help, including paying over time.</p>
        <p>Select ‘View my options’ to chat with Pay Assist, our secure digital assistant. It takes about 3 minutes.</p>
        <button className="btn primary full" onClick={() => openScreen('verify')}>View my options</button>
        <p className="tiny muted mt12">If you're experiencing financial difficulty, you can also speak with our support team on 1800 000 000 (demo number).</p>
      </div>
    </div>
  );
}

function Verify() {
  const s = useJourney();
  const c = customer();
  const [dob, setDob] = useState('');
  const [otp, setOtp] = useState('');
  const setStage = useApp((x) => x.setStage);
  const failed = s.ctx.ended === 'failed-auth';
  return (
    <div className="ph-app">
      <div className="ph-url">🔒 {LINK}</div>
      {s.otpSent && !s.verified && !failed && (
        <button className="banner" onClick={() => setOtp(OTP)}>
          <span className="tiny strong">Messages · AGL</span>
          <span className="small">Your one-time code is <b className="num">{OTP}</b>. Tap to fill.</span>
        </button>
      )}
      <div className="ph-body verify">
        <div className="pa-mark-lg" aria-hidden="true">P</div>
        <h3>Let's make sure it's you</h3>
        <p className="small muted">For your security, we'll check a couple of details before showing anything about your account.</p>
        {failed ? (
          <div className="auth-err mt12">{s.authError}</div>
        ) : s.verified ? (
          <>
            <div className="verified mt12">✓ Verified. Your account is ready.</div>
            <button className="btn primary full mt12" onClick={() => { setStage('resolve'); startChat(); }}>Open Pay Assist</button>
          </>
        ) : !s.otpSent ? (
          <form onSubmit={(e) => { e.preventDefault(); submitDob(dob); }}>
            <label className="tiny strong">Date of birth</label>
            <input className="ph-input num" placeholder="DD/MM/YYYY" value={dob} onChange={(e) => setDob(e.target.value)} inputMode="numeric" />
            {s.authError && <div className="auth-err">{s.authError}</div>}
            <button className="btn primary full mt12" type="submit">Send me a code</button>
            <button type="button" className="hint" onClick={() => { const [y, m, d] = c.dob.split('-'); setDob(`${d}/${m}/${y}`); }}>Presenter: fill {c.firstName}'s date of birth</button>
          </form>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); submitOtp(otp); setOtp(''); }}>
            <label className="tiny strong">Code sent to mobile ending {c.contact.mobile?.slice(-3)}</label>
            <input className="ph-input otp num" placeholder="6-digit code" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} inputMode="numeric" />
            {s.authError && <div className="auth-err">{s.authError}</div>}
            <button className="btn primary full mt12" type="submit">Verify</button>
            <div className="tiny muted mt8">Up to 3 attempts. Try a wrong code to see the safe failure path.</div>
          </form>
        )}
      </div>
    </div>
  );
}

function Chat() {
  const s = useJourney();
  const end = useRef<HTMLDivElement>(null);
  const [text, setText] = useState('');
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [s.messages.length, s.typing, s.replies.length]);
  const lastSlider = [...s.messages].reverse().find((m) => m.card?.kind === 'slider')?.id;

  return (
    <div className="ph-app chat">
      <div className="ph-bar chat-head">
        <button className="ph-back" onClick={() => openScreen('lock')} aria-label="Back">‹</button>
        <div className="pa-mark" aria-hidden="true">P</div>
        <div style={{ flex: 1 }}>
          <div className="strong small">Pay Assist</div>
          <div className="tiny muted">🔒 Secure chat · Verified</div>
        </div>
      </div>
      <div className="ph-body chat-body">
        {s.messages.map((m) => <Message key={m.id} m={m} activeSlider={m.id === lastSlider && s.awaitBudget && !s.ctx.ended} />)}
        {s.typing && <div className="bubble ai typing"><i /><i /><i /></div>}
        {s.replies.length > 0 && (
          <div className="replies">
            {s.replies.map((r) => <button key={r.label} className={`qr ${r.primary ? 'primary' : ''}`} onClick={r.go}>{r.label}</button>)}
          </div>
        )}
        <div ref={end} />
      </div>
      <form className="chat-input" onSubmit={(e) => { e.preventDefault(); typed(text); setText(''); }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={s.ctx.ended && !s.ctx.handoff?.joined ? (s.ctx.ended === 'handoff' ? 'Waiting for the specialist…' : 'Chat ended') : s.placeholder || 'Type a message…'} disabled={(!!s.ctx.ended && !s.ctx.handoff?.joined) || s.input === 'none'} />
        <button className="send" disabled={!text.trim()} aria-label="Send">➤</button>
      </form>
    </div>
  );
}

function Message({ m, activeSlider }: { m: Msg; activeSlider: boolean }) {
  if (m.from === 'system') return <div className="sysmsg tiny">{m.text}</div>;
  if (m.from === 'human') return <div className="bubble ai human"><span className="tiny strong red">{m.name} · Specialist team</span><br />{m.text}</div>;
  return (
    <>
      {m.text && <div className={`bubble ${m.from === 'ai' ? 'ai' : 'me'}`}>{m.text}</div>}
      {m.card && <CardView card={m.card} active={activeSlider} />}
    </>
  );
}

function CardView({ card, active }: { card: Card; active: boolean }) {
  const c = customer();
  switch (card.kind) {
    case 'balance':
      return (
        <div className="ccard">
          {c.accounts.map((a) => (
            <div key={a.number} className="crow"><span>{a.fuel === 'gas' ? 'Gas' : 'Electricity'}</span><span className="num">{dollars(a.overdueCents)}</span></div>
          ))}
          <div className="crow total"><span>Total overdue</span><span className="num">{dollars(totalOverdue(c))}</span></div>
          <div className="tiny muted mt8">Electricity and gas are billed separately; payments are allocated to each account.</div>
        </div>
      );
    case 'options':
      return (
        <div className="opts">
          {card.plans.map((p, i) => (
            <div key={p.type} className="opt">
              <div className="row between"><span className="tiny strong red">Option {i + 1}</span>{p.type === 'bill_smoothing' && <span className="tag">Add-on</span>}</div>
              <div className="strong small">{p.label}</div>
              <div className="opt-amt num">{optionAmount(p)}</div>
              <div className="tiny muted">{p.explanation}</div>
            </div>
          ))}
          {card.notes.map((n) => <div key={n} className="tiny muted">ⓘ {n}</div>)}
        </div>
      );
    case 'plan':
      return (
        <div className="ccard hero">
          <div className="tiny strong">{card.plan.label}</div>
          <div className="hero-amt num">{card.title}</div>
          {card.lines.map((l) => <div key={l} className="small">{l}</div>)}
        </div>
      );
    case 'ranked':
      return (
        <div className="opts">
          {card.plans.map((p, i) => (
            <div key={p.months} className={`opt ${i === card.best ? 'best' : ''}`}>
              {i === card.best && <span className="tag solid">Recommended</span>}
              <div className="strong small">{p.months} months</div>
              <div className="opt-amt num">{dollars(p.instalmentCents!)} <span className="tiny muted">{cadence(p)}</span></div>
              <div className="tiny muted">Debt cleared by {format(parseISO(p.lastDate!), 'MMMM yyyy')}</div>
            </div>
          ))}
        </div>
      );
    case 'summary':
      return (
        <div className="ccard">
          <div className="tiny strong red">{card.plan.label}</div>
          {card.rows.map(([k, v]) => <div key={k} className="crow sum"><span>{k}</span><span className="num">{v}</span></div>)}
        </div>
      );
    case 'paypage':
      return <PayPage method={card.method} />;
    case 'done':
      return (
        <div className="ccard done">
          <div className="done-tick">✓</div>
          <div className="strong">Plan confirmed</div>
          <div className="mono">{card.ref}</div>
          {card.lines.map((l) => <div key={l} className="tiny muted">{l}</div>)}
        </div>
      );
    case 'rating':
      return <Rating />;
    case 'handoff':
      return (
        <div className="ccard handoff">
          <div className="row"><span className="spinner" /><span className="strong small">Connecting you to the {card.esc.routeTo.replace(' (priority)', '').toLowerCase()}</span></div>
          <div className="tiny muted mt8">{card.esc.priority ? 'Priority handover. ' : ''}{card.esc.context === 'minimal' ? "You won't need to explain anything again." : "They'll see this conversation, so you won't need to repeat anything."} Typical wait under 2 minutes.</div>
        </div>
      );
    case 'slider':
      return <BudgetCard active={active} />;
  }
}

function optionAmount(p: Plan) {
  if (p.type === 'full') return `${dollars(p.totalCents)} today`;
  if (p.type === 'part_extension') return `${dollars(p.upfrontCents!)} today + ${dollars(p.totalCents - p.upfrontCents!)} by ${format(parseISO(p.dueDate!), 'd MMM')}`;
  if (p.type === 'extension') return `${dollars(p.totalCents)} by ${format(parseISO(p.dueDate!), 'd MMM')}`;
  if (p.type === 'assist') return `From ${dollars(p.instalmentCents!)} per ${per(p.frequency!)} (${p.months} months)`;
  if (p.type === 'bill_smoothing') return `~${dollars(p.instalmentCents!)} per ${per(p.frequency!)} ongoing`;
  return `${dollars(p.instalmentCents!)} per ${per(p.frequency!)} × ${p.count}`;
}
const per = (f: Frequency) => (f === 'weekly' ? 'week' : f === 'monthly' ? 'month' : 'fortnight');

// The affordability slider: every movement re-runs the plan calculator.
function BudgetCard({ active }: { active: boolean }) {
  const c = customer();
  const ctx = useJourney((s) => s.ctx);
  const [freq, setFreq] = useState<Frequency>(ctx.freq ?? 'fortnightly');
  const [weekday, setWeekday] = useState(ctx.weekday ?? 4);
  const dates = nextDates(new Date(2026, 9, 14), weekday);
  const [first, setFirst] = useState(dates[0]);
  const [amount, setAmount] = useState(ctx.budgetCents ?? (freq === 'weekly' ? 6000 : freq === 'monthly' ? 26000 : 12000));
  const firstDate = dates.includes(first) ? first : dates[0];
  const r = rankForBudget(c, amount, freq, parseISO(firstDate));
  const range = freq === 'weekly' ? [2000, 15000] : freq === 'monthly' ? [8000, 60000] : [4000, 30000];

  return (
    <div className={`ccard budget ${active ? '' : 'inactive'}`}>
      <div className="tiny strong">Paid</div>
      <div className="seg">
        {(['weekly', 'fortnightly', 'monthly'] as Frequency[]).map((f) => (
          <button key={f} className={f === freq ? 'on' : ''} disabled={!active} onClick={() => { setFreq(f); setAmount(f === 'weekly' ? 6000 : f === 'monthly' ? 26000 : 12000); }}>{f}</button>
        ))}
      </div>
      <div className="tiny strong mt8">Payday</div>
      <div className="seg">
        {[1, 2, 3, 4, 5].map((d) => <button key={d} className={d === weekday ? 'on' : ''} disabled={!active} onClick={() => setWeekday(d)}>{WEEKDAYS[d].slice(0, 3)}</button>)}
      </div>
      <div className="tiny strong mt8">First payment</div>
      <div className="seg">
        {dates.map((d) => <button key={d} className={d === firstDate ? 'on' : ''} disabled={!active} onClick={() => setFirst(d)}>{format(parseISO(d), 'd MMM')}</button>)}
      </div>
      <div className="row between mt8"><span className="tiny strong">Comfortable amount</span><span className="strong num">{dollars(amount)}</span></div>
      <input type="range" min={range[0]} max={range[1]} step={100} value={amount} disabled={!active} onChange={(e) => setAmount(+e.target.value)} />
      <div className="calc tiny">
        {r.fit ? <>Plan calculator: <b>{r.fit.months} months at {dollars(r.fit.instalmentCents!)}</b> fits</> : <>Lowest available: {dollars(r.lowest.instalmentCents!)} over {r.lowest.months} months</>}
      </div>
      {active && <button className="btn primary full mt8 small" onClick={() => budget('', { freq, weekday, amountCents: amount, firstDate })}>Use these details</button>}
    </div>
  );
}

function PayPage({ method }: { method: 'newcard' | 'debit' | 'paypal' }) {
  const [done, setDone] = useState(false);
  return (
    <div className="ccard paypage">
      <div className="pp-head tiny"><span>🔒 Secure payment page</span><span>PCI DSS · hosted by payment provider</span></div>
      {method === 'paypal' ? (
        <div className="small mt8">You'll confirm the payment agreement in PayPal, then return here.</div>
      ) : method === 'debit' ? (
        <>
          <Field label="Account name" value="S MITCHELL" /><Field label="BSB" value="•••-•••" /><Field label="Account number" value="•••• •312" />
        </>
      ) : (
        <>
          <Field label="Card number" value="•••• •••• •••• 1111" /><div className="row"><Field label="Expiry" value="••/••" /><Field label="CVV" value="•••" /></div>
          <div className="tiny muted">Demo values. Real card details are entered only on the provider's page.</div>
        </>
      )}
      <button className="btn primary full mt8 small" disabled={done} onClick={() => { setDone(true); authorise(method); }}>
        {method === 'paypal' ? 'Continue with PayPal' : 'Save and authorise'}
      </button>
    </div>
  );
}

const Field = ({ label, value }: { label: string; value: string }) => (
  <div className="pp-field"><span className="tiny muted">{label}</span><span className="mono">{value}</span></div>
);

function Rating() {
  const ended = useJourney((s) => s.ctx.rating);
  const [stars, setStars] = useState(0);
  const [easy, setEasy] = useState<boolean | null>(null);
  const [comment, setComment] = useState('');
  if (ended) return null;
  return (
    <div className="ccard rating">
      <div className="stars">
        {[1, 2, 3, 4, 5].map((n) => <button key={n} className={n <= stars ? 'on' : ''} onClick={() => setStars(n)} aria-label={`${n} stars`}>★</button>)}
      </div>
      <div className="tiny strong mt8">Was this easy to do?</div>
      <div className="seg">
        <button className={easy === true ? 'on' : ''} onClick={() => setEasy(true)}>Yes</button>
        <button className={easy === false ? 'on' : ''} onClick={() => setEasy(false)}>No</button>
      </div>
      <input className="ph-input mt8" placeholder="Optional comment" value={comment} onChange={(e) => setComment(e.target.value)} />
      <button className="hint" onClick={() => { setStars(5); setEasy(true); setComment("Quick and easy, didn't feel judged."); }}>Presenter: fill the sample feedback</button>
      <button className="btn primary full small mt8" disabled={!stars || easy === null} onClick={() => rate(stars, !!easy, comment)}>Send feedback</button>
    </div>
  );
}

function ConfirmEmail() {
  const c = customer();
  const p = useJourney((s) => s.ctx.chosen);
  const ref = REF(c);
  const rows = p?.count && p.firstDate ? Array.from({ length: p.count }, (_, k) => k) : [];
  return (
    <div className="ph-app">
      <AppBar title={`Your payment plan is confirmed – Ref ${ref}`} sub="AGL · just now" />
      <div className="ph-body mail">
        <p>Hi {c.firstName}, thanks for setting up your plan with Pay Assist.</p>
        {p && (
          <div className="ccard">
            <div className="crow sum"><span>Plan</span><span>{p.label}</span></div>
            {p.instalmentCents && <div className="crow sum"><span>Payment</span><span className="num">{dollars(p.instalmentCents)} {cadence(p)}</span></div>}
            {p.firstDate && p.lastDate && <div className="crow sum"><span>Dates</span><span>{format(parseISO(p.firstDate), 'd MMM yyyy')} – {format(parseISO(p.lastDate), 'd MMM yyyy')}</span></div>}
            <div className="crow sum"><span>Accounts covered</span><span>{c.accounts.map((a) => (a.fuel === 'gas' ? 'Gas' : 'Electricity')).join(' + ')}</span></div>
            {c.contact.storedCard && <div className="crow sum"><span>Payment method</span><span>{c.contact.storedCard.brand} •••• {c.contact.storedCard.last4}</span></div>}
          </div>
        )}
        {rows.length > 0 && (
          <details className="mt8">
            <summary className="small strong">Full payment schedule ({rows.length} payments)</summary>
            <table className="t sched">
              <tbody>
                {rows.map((k) => {
                  const d = new Date(parseISO(p!.firstDate!).getTime());
                  if (p!.frequency === 'monthly') d.setMonth(d.getMonth() + k); else d.setDate(d.getDate() + k * (p!.frequency === 'weekly' ? 7 : 14));
                  return <tr key={k}><td className="num">{k + 1}</td><td>{format(d, 'EEE d MMM yyyy')}</td><td className="r num">{dollars(k === rows.length - 1 ? p!.lastInstalmentCents! : p!.instalmentCents!)}</td></tr>;
                })}
              </tbody>
            </table>
          </details>
        )}
        <p className="small mt12"><b>If a payment is missed:</b> we'll message you the same day and help you reschedule. You can change your plan any time in the chat.</p>
        <p className="tiny muted">Need more support? Hardship assistance and concession information: 1800 000 000 (demo number).</p>
      </div>
    </div>
  );
}

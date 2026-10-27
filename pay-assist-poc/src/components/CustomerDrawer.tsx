import { avgMonthlyBill, fuelLabel } from '../domain/customers';
import { RuleCode } from './RuleBook';
import { checkPlan } from '../domain/guardian';
import { dollars } from '../domain/money';
import { PLAN_LABEL, decisionLabel, type Row } from '../domain/morningRun';
import { DEMO_NOW, useApp } from '../state/store';
import { Drawer } from './Drawer';
import { format, parseISO } from 'date-fns';

const nice = (d: string) => format(parseISO(d), 'd MMM yyyy');

// Per-customer drill-down: data used, rules applied, plan, and the Guardian's checks (traceability).
export function CustomerDrawer({ row, onClose }: { row: Row; onClose: () => void }) {
  const { c, a, overdueCents } = row;
  const plan = a.recommended ?? a.draftForHuman;
  const checks = plan ? checkPlan(c, plan, DEMO_NOW) : null;
  const flags = [
    c.flags.lifeSupport && 'Life support', c.flags.hardship && 'Hardship', c.flags.vulnerability && 'Vulnerable',
    c.flags.concession && 'Concession', c.flags.doNotContact && 'Do not contact', c.flags.dunningStage && `Dunning stage ${c.flags.dunningStage}`,
  ].filter(Boolean) as string[];

  return (
    <Drawer title={c.name} onClose={onClose}>
      <div className="row">
        <span className="mono muted">{c.id}</span>
        <span className="tag">{c.state}</span>
        <span className="tag">{fuelLabel(c)}</span>
        {c.persona && <span className="tag ai">Demo customer</span>}
        <button className="btn small outline" style={{ marginLeft: 'auto' }} onClick={() => { onClose(); useApp.getState().openConsole('trace', { traceId: c.id }); }}>Full trace</button>
      </div>

      <div className={`verdict mt12 ${a.decision}`}>
        <div className="tiny strong">Decision</div>
        <div className="strong">{decisionLabel(a)}</div>
        <div className="small mt8">{a.reason}</div>
        <div className="tiny muted mt8">Segment: {a.segment} · Reason code {a.reasonCode}</div>
      </div>

      <h4 className="dsec">Overdue accounts</h4>
      <table className="t">
        <thead><tr><th>Account</th><th>Fuel</th><th className="r">Overdue</th><th className="r">Days</th></tr></thead>
        <tbody>
          {c.accounts.map((x) => (
            <tr key={x.number}><td className="mono">{x.number}</td><td>{x.fuel === 'gas' ? 'Gas' : 'Electricity'}</td>
              <td className="r num">{dollars(x.overdueCents)}</td><td className="r num">{x.oldestInvoiceDays}</td></tr>
          ))}
          {c.accounts.length > 1 && <tr><td colSpan={2} className="strong">Total</td><td className="r num strong">{dollars(overdueCents)}</td><td /></tr>}
        </tbody>
      </table>

      <h4 className="dsec">What the Assessment agent looked at</h4>
      <dl className="facts">
        <dt>Paid on time</dt><dd>{c.payment.onTimeLast12} of last 12 bills</dd>
        <dt>Average payment</dt><dd className="num">{dollars(c.payment.avgPaymentCents)}</dd>
        <dt>Average monthly bill</dt><dd className="num">{dollars(avgMonthlyBill(c))}</dd>
        <dt>Affordability index</dt><dd className="num">{a.affordability.index.toFixed(2)} ({a.affordability.band})</dd>
        <dt>Broken plans (6 months)</dt><dd>{c.arrangements.brokenLast6Months}</dd>
        <dt>Payment in transit</dt><dd>{c.payment.inTransit ? `${dollars(c.payment.inTransit.cents)} by ${c.payment.inTransit.method}` : 'None'}</dd>
        <dt>Flags</dt><dd>{flags.length ? flags.join(', ') : 'None'}</dd>
        <dt>Preferred contact</dt><dd>{c.contact.preferred === 'sms+email' ? 'SMS and email' : c.contact.preferred.toUpperCase()}</dd>
      </dl>

      <h4 className="dsec">Rules applied</h4>
      {a.rules.map((r) => (
        <div key={r.id} className="rule"><RuleCode id={r.id} className="mono red" /><span className="small">{r.text}</span></div>
      ))}

      {plan && (
        <>
          <h4 className="dsec">{a.recommended ? 'Recommended plan' : 'Plan drafted for the human team'}</h4>
          <div className="card tint">
            <div className="strong">{plan.label}</div>
            <div className="small mt8">{plan.explanation}</div>
            {plan.firstDate && plan.lastDate && <div className="tiny muted mt8">From {nice(plan.firstDate)} to {nice(plan.lastDate)}</div>}
          </div>
          {a.eligible.length > 0 && (
            <div className="tiny muted mt8">Eligible options: {a.eligible.map((e) => PLAN_LABEL[e]).join(', ')}</div>
          )}
        </>
      )}

      {checks && (
        <>
          <h4 className="dsec">Guardian checks</h4>
          {checks.checks.map((k, i) => (
            <div key={i} className={`gcheck ${k.pass ? 'pass' : 'fail'}`}>
              <span className="gmark">{k.pass ? '✓' : '✕'}</span>
              <span className="small">{k.text}</span>
              <RuleCode id={k.id} className="mono muted" />
            </div>
          ))}
          <div className="small mt8">
            {checks.allowed
              ? <b>Allowed: the AI may offer this plan.</b>
              : <b className="red">Not allowed for AI: a person must approve this plan.</b>}
          </div>
        </>
      )}

      <h4 className="dsec">Next step</h4>
      <div className="small">
        {a.decision === 'ai' && `SMS${c.contact.preferred === 'sms+email' ? ' and email' : ''} at 9:00 am with a secure link. No balance is shown until the customer verifies.`}
        {a.decision === 'human' && `Case card sent to the ${a.route} queue${a.priority ? ' as priority' : ''}. No automated collection messages.`}
        {a.decision === 'none' && 'No contact today. Re-assessed in tomorrow\'s run.'}
      </div>
    </Drawer>
  );
}

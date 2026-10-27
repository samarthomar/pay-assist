import { format } from 'date-fns';
import logo from '../assets/techm-logo.png';
import { DEMO_NOW, useApp } from '../state/store';
import { resetAll } from '../state/scenes';

function ProductMark() {
  return (
    <div className="product">
      <svg className="pmark" viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="var(--red)" />
        <path d="M9 23V9h7.5a4.5 4.5 0 0 1 0 9H13" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="22.5" cy="22.5" r="3" fill="#fff" />
      </svg>
      <div>
        <div className="pname">Pay Assist</div>
        <div className="ptag">Agentic collections · prepared for AGL</div>
      </div>
    </div>
  );
}

export function Header() {
  const audit = useApp((s) => s.audit);
  const setAuditOpen = useApp((s) => s.setAuditOpen);
  const reset = useApp((s) => s.reset);
  const openRuleBook = useApp((s) => s.openRuleBook);
  return (
    <header className="top">
      <img className="logo" src={logo} alt="Tech Mahindra" />
      <div className="sep" />
      <ProductMark />
      <div className="spacer" />
      <span className="clock num" title="Demo clock">
        <span className="dot" />
        {format(DEMO_NOW, 'EEE d MMM · HH:mm')}
      </span>
      <span className="badge">Synthetic data</span>
      <button className="btn" onClick={() => setAuditOpen(true)}>
        Audit log<span className="count num">{audit.length}</span>
      </button>
      <button className="btn primary" onClick={() => openRuleBook()}>Rule book</button>
      <button className="btn ghost" onClick={() => { reset(); resetAll(); }} title="Reset the demo">Reset</button>
    </header>
  );
}

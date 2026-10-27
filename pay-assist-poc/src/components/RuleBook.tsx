import { useEffect, useMemo, useRef, useState } from 'react';
import { RULE_GROUPS } from '../domain/ruleBook';
import { useApp } from '../state/store';
import { Drawer } from './Drawer';

// Plain-English reference for every rule code shown in the demo. Opens on a rule when a code is clicked.
export function RuleBook() {
  const focus = useApp((s) => s.ruleFocus);
  const close = useApp((s) => s.closeRuleBook);
  const [q, setQ] = useState('');
  const body = useRef<HTMLDivElement>(null);

  const groups = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return RULE_GROUPS;
    return RULE_GROUPS.map((g) => ({ ...g, rules: g.rules.filter((r) => `${r.id} ${r.name} ${r.simple} ${r.example} ${r.where}`.toLowerCase().includes(t)) }))
      .filter((g) => g.rules.length);
  }, [q]);
  const count = groups.reduce((s, g) => s + g.rules.length, 0);

  useEffect(() => {
    if (focus) body.current?.querySelector(`[data-rule="${focus}"]`)?.scrollIntoView({ block: 'center' });
  }, [focus]);

  return (
    <Drawer title="Rule book" onClose={close}>
      <div ref={body}>
        <p className="small muted" style={{ marginTop: 0 }}>
          Every rule code you see in the demo, in plain words. The Guardian checks these before anything reaches a customer.
        </p>
        <input className="search full" placeholder="Search, e.g. 2,000 or Victoria or BR-T05" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="tiny muted mt8">{count} rule{count === 1 ? '' : 's'}</div>
        {groups.map((g) => (
          <section key={g.title} className="rb-group">
            <h4 className="dsec">{g.title}</h4>
            <div className="tiny muted">{g.intro}</div>
            {g.rules.map((r) => (
              <article key={r.id} data-rule={r.id} className={`rb-rule ${focus === r.id ? 'on' : ''} ${r.source.startsWith('Proposed') ? 'proposed' : ''}`}>
                <div className="row between">
                  <span className="row" style={{ gap: 8 }}><span className="mono red strong">{r.id}</span><span className="strong small">{r.name}</span></span>
                  {r.source.startsWith('Proposed') && <span className="tag solid">Proposed</span>}
                </div>
                <div className="small mt4">{r.simple}</div>
                <dl className="rb-meta">
                  <dt>Example</dt><dd>{r.example}</dd>
                  <dt>Where you see it</dt><dd>{r.where}</dd>
                  <dt>Source</dt><dd>{r.source}</dd>
                </dl>
              </article>
            ))}
          </section>
        ))}
        {count === 0 && <div className="empty">No rule matches “{q}”.</div>}
      </div>
    </Drawer>
  );
}

// A rule code anywhere in the demo: click it to open the rule book on that rule.
export function RuleCode({ id, className = 'tag red' }: { id: string; className?: string }) {
  const open = useApp((s) => s.openRuleBook);
  return <button type="button" className={`${className} rule-link`} title="Open in the rule book" onClick={(e) => { e.stopPropagation(); open(id); }}>{id}</button>;
}

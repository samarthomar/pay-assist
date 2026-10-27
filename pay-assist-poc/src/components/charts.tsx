// Small SVG charts in the Pay Assist palette (red, white, cream). No chart library needed.

const SHADES = ['var(--red)', 'var(--red-deep)', 'var(--red-soft)', 'var(--cream-2)', 'var(--ink-2)', 'var(--muted)'];

export function LineChart({ values, target, fmt = (v: number) => String(v), label, lowerIsBetter }: {
  values: number[]; target?: number; fmt?: (v: number) => string; label: string; lowerIsBetter?: boolean;
}) {
  const w = 420, h = 140, pad = 28;
  const all = target !== undefined ? [...values, target] : values;
  const min = Math.min(...all), max = Math.max(...all);
  const span = max - min || 1;
  const x = (i: number) => pad + (i * (w - pad * 2)) / (values.length - 1);
  const y = (v: number) => h - pad - ((v - min) / span) * (h - pad * 2);
  const path = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return (
    <figure className="chart">
      <figcaption className="tiny strong muted">{label}</figcaption>
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`${label}: latest ${fmt(values[values.length - 1])}`}>
        {target !== undefined && (
          <>
            <line x1={pad} x2={w - pad} y1={y(target)} y2={y(target)} stroke="var(--ink-2)" strokeDasharray="4 4" strokeWidth="1" />
            <text x={w - pad} y={y(target) - 4} textAnchor="end" fontSize="10" fill="var(--ink-2)">target {fmt(target)}{lowerIsBetter ? ' (max)' : ''}</text>
          </>
        )}
        <path d={`${path} L${x(values.length - 1)},${h - pad} L${x(0)},${h - pad} Z`} fill="var(--red-tint)" />
        <path d={path} fill="none" stroke="var(--red)" strokeWidth="2.2" strokeLinejoin="round" />
        <circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r="4" fill="var(--red)" />
        <text x={x(values.length - 1)} y={y(values[values.length - 1]) - 8} textAnchor="end" fontSize="11" fontWeight="700" fill="var(--ink)">{fmt(values[values.length - 1])}</text>
        <text x={pad} y={h - 8} fontSize="10" fill="var(--muted)">14 days ago</text>
        <text x={w - pad} y={h - 8} textAnchor="end" fontSize="10" fill="var(--muted)">today</text>
      </svg>
    </figure>
  );
}

export function BarList({ items, fmt = (v: number) => v.toLocaleString('en-AU'), label, max }: {
  items: [string, number][]; fmt?: (v: number) => string; label: string; max?: number;
}) {
  const top = max ?? Math.max(...items.map(([, v]) => v), 1);
  return (
    <figure className="chart">
      <figcaption className="tiny strong muted">{label}</figcaption>
      {items.map(([k, v], i) => (
        <div key={k} className="bl-row">
          <span className="small">{k}</span>
          <span className="bl-bar"><span style={{ width: `${(v / top) * 100}%`, background: i === 0 ? 'var(--red)' : 'var(--red-soft)' }} /></span>
          <span className="small num strong">{fmt(v)}</span>
        </div>
      ))}
    </figure>
  );
}

export function Funnel({ steps, label }: { steps: [string, number][]; label: string }) {
  const first = steps[0][1];
  return (
    <figure className="chart">
      <figcaption className="tiny strong muted">{label}</figcaption>
      <div className="funnel">
        {steps.map(([k, v], i) => (
          <div key={k} className="fn-step">
            <div className="fn-bar" style={{ width: `${Math.max(14, (v / first) * 100)}%`, opacity: 1 - i * 0.1 }}><span className="num">{v.toLocaleString('en-AU')}</span></div>
            <span className="small">{k}{i > 0 && <span className="tiny muted"> · {Math.round((v / steps[i - 1][1]) * 100)}% of previous</span>}</span>
          </div>
        ))}
      </div>
    </figure>
  );
}

export function Donut({ items, label, centre }: { items: [string, number][]; label: string; centre: string }) {
  const total = items.reduce((s, [, v]) => s + v, 0);
  let acc = 0;
  const r = 52, c = 2 * Math.PI * r;
  return (
    <figure className="chart">
      <figcaption className="tiny strong muted">{label}</figcaption>
      <div className="donut">
        <svg viewBox="0 0 140 140" role="img" aria-label={label}>
          {items.map(([k, v], i) => {
            const len = (v / total) * c;
            const el = <circle key={k} cx="70" cy="70" r={r} fill="none" stroke={SHADES[i % SHADES.length]} strokeWidth="20" strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-acc} transform="rotate(-90 70 70)" />;
            acc += len;
            return el;
          })}
          <text x="70" y="68" textAnchor="middle" fontSize="18" fontWeight="700" fill="var(--ink)">{centre}</text>
          <text x="70" y="84" textAnchor="middle" fontSize="10" fill="var(--muted)">total</text>
        </svg>
        <div className="legend-list">
          {items.map(([k, v], i) => (
            <div key={k} className="small"><i style={{ background: SHADES[i % SHADES.length] }} />{k} <b className="num">{v.toLocaleString('en-AU')}</b> <span className="tiny muted">{Math.round((v / total) * 100)}%</span></div>
          ))}
        </div>
      </div>
    </figure>
  );
}

export function Paired({ items, label, a, b, fmt }: { items: { label: string; before: number; after: number }[]; label: string; a: string; b: string; fmt: (v: number) => string }) {
  const max = Math.max(...items.map((i) => i.before));
  return (
    <figure className="chart">
      <figcaption className="tiny strong muted">{label}</figcaption>
      <div className="row tiny"><span className="legend"><i style={{ background: 'var(--cream-2)' }} />{a}</span><span className="legend"><i style={{ background: 'var(--red)' }} />{b}</span></div>
      {items.map((i) => (
        <div key={i.label} className="pair">
          <span className="small">{i.label}</span>
          <div>
            <div className="pbar before" style={{ width: `${(i.before / max) * 100}%` }}><span className="tiny num">{fmt(i.before)}</span></div>
            <div className="pbar after" style={{ width: `${(i.after / max) * 100}%` }}><span className="tiny num">{fmt(i.after)}</span></div>
          </div>
        </div>
      ))}
    </figure>
  );
}

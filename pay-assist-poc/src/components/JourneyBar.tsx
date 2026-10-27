import { useApp } from '../state/store';
import { STAGES } from '../state/stages';

// Navigation as a journey: each stage is a step the customer's account moves through.
export function JourneyBar() {
  const stage = useApp((s) => s.stage);
  const setStage = useApp((s) => s.setStage);
  const current = STAGES.findIndex((s) => s.id === stage);

  return (
    <nav className="journey" aria-label="Pay Assist journey">
      <ol>
        {STAGES.map((s, i) => (
          <li key={s.id} className={i === current ? 'on' : i < current ? 'past' : ''}>
            <button onClick={() => setStage(s.id)} aria-current={i === current ? 'step' : undefined}>
              <span className="jn">{s.n}</span>
              <span className="jt">
                <span className="jname">{s.name}</span>
                <span className="jwhat">{s.what}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}

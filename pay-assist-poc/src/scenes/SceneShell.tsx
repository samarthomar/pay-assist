import type { ReactNode } from 'react';
import { AGENTS, type StageDef } from '../state/stages';

export function StageHeader({ stage, actions }: { stage: StageDef; actions?: ReactNode }) {
  return (
    <div className="stage-head">
      <div className="sh-num" aria-hidden="true">{String(stage.n).padStart(2, '0')}</div>
      <div className="sh-main">
        <div className="sh-kicker">Stage {stage.n} of 6 · {stage.name}</div>
        <h1>{stage.title}</h1>
        <p className="lede">{stage.lede}</p>
      </div>
      <div className="sh-side">
        <div className="tiny muted">Agents at work</div>
        <div className="row mt8">
          {stage.agents.map((id) => (
            <span key={id} className="tag ai">{AGENTS.find((a) => a.id === id)!.name}</span>
          ))}
        </div>
        {actions && <div className="row mt12">{actions}</div>}
      </div>
    </div>
  );
}

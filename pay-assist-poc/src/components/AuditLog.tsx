import { format } from 'date-fns';
import { useApp, type AuditKind } from '../state/store';
import { Drawer } from './Drawer';

const KIND_TAG: Record<AuditKind, string> = {
  system: 'tag',
  agent: 'tag ai',
  guardian: 'tag red',
  human: 'tag',
  customer: 'tag',
};

export function AuditLog() {
  const audit = useApp((s) => s.audit);
  const setAuditOpen = useApp((s) => s.setAuditOpen);
  return (
    <Drawer title="Audit log" onClose={() => setAuditOpen(false)}>
      {audit.length === 0 ? (
        <div className="empty">No events yet. Agent decisions, Guardian checks and human actions will appear here.</div>
      ) : (
        audit.map((e) => (
          <div className="event" key={e.id}>
            <div className="row between">
              <span className={KIND_TAG[e.kind]}>{e.actor}</span>
              <span className="when num">{format(e.at, 'HH:mm:ss')}</span>
            </div>
            <div className="small mt8">{e.text}</div>
          </div>
        ))
      )}
    </Drawer>
  );
}

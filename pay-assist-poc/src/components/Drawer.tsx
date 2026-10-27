import { useEffect, type ReactNode } from 'react';

export function Drawer({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label={title}>
        <div className="dh">
          <h3>{title}</h3>
          <button className="btn small" onClick={onClose}>Close</button>
        </div>
        <div className="db">{children}</div>
      </aside>
    </>
  );
}

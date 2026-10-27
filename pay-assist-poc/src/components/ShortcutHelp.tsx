import { useEffect } from 'react';
import { useApp } from '../state/store';

export const SHORTCUTS: [string, string][] = [
  ['1 – 6', 'Go to a screen: Assess, Engage, Resolve, Protect, Sustain, Results'],
  ['B', 'Rule book'],
  ['A', 'Agent console'],
  ['L', 'Audit log'],
  ['Shift + R', 'Reset the whole demo'],
  ['?', 'This list'],
  ['Esc', 'Close any panel'],
];

export function ShortcutHelp() {
  const setHelp = useApp((s) => s.setHelpOpen);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setHelp(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [setHelp]);
  return (
    <>
      <div className="scrim" onClick={() => setHelp(false)} />
      <div className="help card" role="dialog" aria-label="Keyboard shortcuts">
        <div className="row between"><h3>Keyboard shortcuts</h3><button className="btn small" onClick={() => setHelp(false)}>Close</button></div>
        <table className="t mt8"><tbody>{SHORTCUTS.map(([k, v]) => <tr key={k}><td><kbd>{k}</kbd></td><td className="small">{v}</td></tr>)}</tbody></table>
        <div className="tiny muted mt8">Shortcuts are ignored while you are typing in a field.</div>
      </div>
    </>
  );
}

import { useEffect } from 'react';
import { resetAll } from './scenes';
import { STAGES } from './stages';
import { useApp } from './store';

// Presenter keyboard shortcuts. Ignored while typing, and when a modifier key is held (except Shift+R).
export function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target instanceof Element ? e.target : null;
      if (el?.closest('input, textarea, select, [contenteditable="true"]') || e.ctrlKey || e.metaKey || e.altKey) return;
      const app = useApp.getState();
      if (/^[1-6]$/.test(e.key)) { app.setStage(STAGES[Number(e.key) - 1].id); window.scrollTo({ top: 0 }); }
      else if (e.key === 'b') app.ruleBookOpen ? app.closeRuleBook() : app.openRuleBook();
      else if (e.key === 'a') app.consoleOpen ? app.setConsoleOpen(false) : app.openConsole('map');
      else if (e.key === 'l') app.setAuditOpen(!app.auditOpen);
      else if (e.key === '?') app.setHelpOpen(!app.helpOpen);
      else if (e.key === 'R' && e.shiftKey) { app.reset(); resetAll(); }
      else return;
      e.preventDefault();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
}

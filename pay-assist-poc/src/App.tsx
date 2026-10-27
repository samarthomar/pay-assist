import { Header } from './components/Header';
import { JourneyBar } from './components/JourneyBar';
import { AgentStrip } from './components/AgentStrip';
import { AgentConsole } from './components/AgentConsole';
import { AuditLog } from './components/AuditLog';
import { RuleBook } from './components/RuleBook';
import { ShortcutHelp } from './components/ShortcutHelp';
import { StageHeader } from './scenes/SceneShell';
import { AssessScene } from './scenes/AssessScene';
import { JourneyScene } from './scenes/journey/JourneyScene';
import { ProtectScene } from './scenes/ProtectScene';
import { SustainScene } from './scenes/SustainScene';
import { ResultsScene } from './scenes/ResultsScene';
import { useShortcuts } from './state/shortcuts';
import { useApp } from './state/store';
import { STAGES } from './state/stages';

export default function App() {
  const stage = useApp((s) => s.stage);
  const auditOpen = useApp((s) => s.auditOpen);
  const consoleOpen = useApp((s) => s.consoleOpen);
  const helpOpen = useApp((s) => s.helpOpen);
  const ruleBookOpen = useApp((s) => s.ruleBookOpen);
  useShortcuts();
  const def = STAGES.find((s) => s.id === stage)!;

  return (
    <>
      <div className="chrome">
        <Header />
        <JourneyBar />
        <AgentStrip />
      </div>
      <main>
        <StageHeader stage={def} />
        {stage === 'assess' && <AssessScene />}
        {(stage === 'engage' || stage === 'resolve') && <JourneyScene mode={stage} />}
        {stage === 'protect' && <ProtectScene />}
        {stage === 'sustain' && <SustainScene />}
        {stage === 'results' && <ResultsScene />}
      </main>
      <footer>
        <span>Pay Assist POC · Tech Mahindra for AGL · All customer data, amounts and KPI values are synthetic and illustrative</span>
        <span>v1.1 · Simulated agents · press <kbd>?</kbd> for shortcuts</span>
      </footer>
      {consoleOpen && <AgentConsole />}
      {auditOpen && <AuditLog />}
      {ruleBookOpen && <RuleBook />}
      {helpOpen && <ShortcutHelp />}
    </>
  );
}

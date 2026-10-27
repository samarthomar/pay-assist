import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/georama/latin-400.css';
import '@fontsource/georama/latin-500.css';
import '@fontsource/georama/latin-600.css';
import '@fontsource/georama/latin-700.css';
import './theme/theme.css';
import './theme/assess.css';
import './theme/journey.css';
import './theme/protect.css';
import './theme/console.css';
import './theme/sustain.css';
import './theme/results.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

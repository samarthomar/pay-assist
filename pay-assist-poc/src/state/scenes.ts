import { restart } from './journey';
import { useProtect } from './protect';
import { restartSustain } from './sustain';

// Reset every screen's own state (the shared store resets itself).
export function resetAll() {
  restart('Sarah');
  useProtect.getState().reset();
  restartSustain();
}

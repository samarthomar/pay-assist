import { format } from 'date-fns';

// The demo's "today". Every date in the app is worked out from this one value, so changing it here moves
// the whole demo (file name, messages, plan dates, Sustain timeline) together.
export const DEMO_NOW = new Date(2026, 10, 13, 7, 30); // Fri 13 Nov 2026, 07:30, before the business day
export const DEMO_TODAY = new Date(DEMO_NOW.getFullYear(), DEMO_NOW.getMonth(), DEMO_NOW.getDate());
export const DEMO_DAY = format(DEMO_NOW, 'yyyy-MM-dd');
export const OVERDUE_FILE = `AGL_overdue_residential_${DEMO_DAY}.csv`;

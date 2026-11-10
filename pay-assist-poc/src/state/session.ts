// The hosted demo sits behind a password (see middleware.ts); local and offline copies do not.
export const hosted = /^https?:$/.test(location.protocol) && !['localhost', '127.0.0.1'].includes(location.hostname);

const KEY = 'pa_visit';
const SIGNED_IN = '#signed-in';

// Ask for the password on every new visit. The login redirect lands with #signed-in, which marks this tab
// as signed in. A refresh keeps the mark; a new tab or a reopened browser does not, so it goes back to login.
// Returns false when the page is leaving for the login screen.
export function checkVisit(): boolean {
  if (!hosted) return true;
  try {
    if (location.hash === SIGNED_IN) {
      sessionStorage.setItem(KEY, '1');
      history.replaceState(null, '', location.pathname + location.search);
      return true;
    }
    if (sessionStorage.getItem(KEY)) return true;
  } catch {
    return true; // storage blocked: the server-side cookie still protects the site
  }
  location.replace('/login');
  return false;
}

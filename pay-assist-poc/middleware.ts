import { next } from '@vercel/functions';

// Password gate for the hosted demo (Vercel Routing Middleware). Runs on Vercel's servers before
// any page is served, so the password never reaches the browser. Set it in Vercel as DEMO_PASSWORD.
// Local dev and the offline HTML file are not affected.

export const config = { matcher: '/((?!favicon.ico).*)' };

const COOKIE = 'pa_session';

async function tokenFor(password: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`pay-assist:${password}`));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
}

const readCookie = (req: Request, name: string) =>
  req.headers.get('cookie')?.split(';').map((c) => c.trim().split('=')).find(([k]) => k === name)?.[1];

const safeNext = (to: string | null) => (to && to.startsWith('/') && !to.startsWith('//') ? to : '/');

const redirect = (to: string, cookie?: string) =>
  new Response(null, { status: 303, headers: { Location: to, 'Cache-Control': 'no-store', ...(cookie ? { 'Set-Cookie': cookie } : {}) } });

export default async function middleware(req: Request) {
  const url = new URL(req.url);
  const password = process.env.DEMO_PASSWORD;

  if (url.pathname === '/logout') return redirect('/login', `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`);

  if (!password) return loginPage({ notice: 'The demo password has not been set up yet.' }, 503);

  const expected = await tokenFor(password);

  if (url.pathname === '/login') {
    const to = safeNext(url.searchParams.get('next'));
    if (req.method === 'POST') {
      const form = await req.formData();
      const tried = String(form.get('password') ?? '');
      if ((await tokenFor(tried)) === expected) {
        // Session cookie (no Max-Age): it ends when the browser closes. The app also asks again in every new tab (src/state/session.ts).
        return redirect(`${to}#signed-in`, `${COOKIE}=${expected}; Path=/; HttpOnly; Secure; SameSite=Lax`);
      }
      await new Promise((r) => setTimeout(r, 700)); // slow down guessing
      return loginPage({ error: 'That password is not right. Please try again.', to }, 401);
    }
    return loginPage({ to });
  }

  if (readCookie(req, COOKIE) === expected) return next();

  const back = url.pathname + url.search;
  return redirect(back === '/' ? '/login' : `/login?next=${encodeURIComponent(back)}`);
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function loginPage({ error, notice, to = '/' }: { error?: string; notice?: string; to?: string }, status = 200) {
  const action = to === '/' ? '/login' : `/login?next=${encodeURIComponent(to)}`;
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Sign in · Pay Assist</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Georama:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  :root { --red:#E31837; --red-hover:#C9142F; --red-deep:#5F0229; --red-soft:#F8B4A3; --red-tint:#FDEEEF;
    --ink:#29251D; --ink-2:#4A453D; --muted:#7A746A; --cream:#F6F2EA; --cream-2:#E5DFD3; --line:#E9E4DA; --white:#FFFFFF; }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px 16px;
    font-family: "Georama", "Segoe UI", system-ui, Arial, sans-serif; color: var(--ink); background: var(--cream); }
  .card { width: 100%; max-width: 400px; background: var(--white); border: 1px solid var(--line); border-top: 4px solid var(--red);
    border-radius: 12px; padding: 32px 28px; box-shadow: 0 1px 2px rgba(41,37,29,.06), 0 8px 28px rgba(41,37,29,.08); }
  .brand { display: flex; align-items: center; gap: 12px; }
  .brand svg { width: 44px; height: 44px; flex-shrink: 0; }
  .name { font-size: 22px; font-weight: 700; line-height: 1.1; }
  .tag { font-size: 13px; color: var(--muted); }
  h1 { font-size: 18px; font-weight: 600; margin: 28px 0 4px; }
  p { margin: 0; font-size: 14px; color: var(--ink-2); }
  label { display: block; font-size: 13px; font-weight: 600; margin: 20px 0 6px; }
  input { width: 100%; font: inherit; font-size: 15px; padding: 11px 12px; border: 1px solid var(--cream-2); border-radius: 8px; color: var(--ink); }
  input:focus { outline: none; border-color: var(--red); box-shadow: 0 0 0 3px var(--red-tint); }
  button { width: 100%; margin-top: 16px; font: inherit; font-size: 15px; font-weight: 600; padding: 11px; border: 0; border-radius: 8px;
    background: var(--red); color: var(--white); cursor: pointer; }
  button:hover { background: var(--red-hover); }
  .msg { margin-top: 16px; font-size: 13px; padding: 9px 12px; border-radius: 8px; background: var(--red-tint); color: var(--red-deep); border: 1px solid var(--red-soft); }
  .foot { margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--line); font-size: 12px; color: var(--muted); display: flex; justify-content: space-between; gap: 8px; }
</style>
</head>
<body>
<main class="card">
  <div class="brand">
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#E31837"/>
      <path d="M9 23V9h7.5a4.5 4.5 0 0 1 0 9H13" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="22.5" cy="22.5" r="3" fill="#fff"/>
    </svg>
    <div><div class="name">Pay Assist</div><div class="tag">Agentic collections · prepared for AGL</div></div>
  </div>
  <h1>Sign in to the demo</h1>
  <p>Enter the password you were given.</p>
  ${notice ? `<div class="msg">${esc(notice)}</div>` : `
  <form method="post" action="${esc(action)}">
    <label for="password">Password</label>
    <input id="password" name="password" type="password" autocomplete="current-password" required autofocus>
    ${error ? `<div class="msg" role="alert">${esc(error)}</div>` : ''}
    <button type="submit">Sign in</button>
  </form>`}
  <div class="foot"><span>Tech Mahindra</span><span>Synthetic data only</span></div>
</main>
</body>
</html>`;
  return new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

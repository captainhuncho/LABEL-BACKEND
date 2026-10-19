// Sign out after 3 hours without real interaction (ops and the artist portal).
// Supabase's own inactivity timeout counts token refreshes, which an open tab
// keeps doing on its own, so the app tracks what the person actually does:
// pointer, keys, wheel and touch. The time is shared by every tab of the browser
// (localStorage) and tied to the signed-in session, so a fresh sign-in starts a
// fresh clock. Checked every 30 s and the moment a tab wakes up or regains focus
// (timers sleep with the tab, so the check on resume is what counts). When one
// tab times out, the others sign out too. The server backstop is
// private.end_idle_sessions(); the app reports activity to it every few minutes.

export const IDLE_LIMIT_MS = 3 * 60 * 60 * 1000;
export const IDLE_KEY = 'imss:last-active';
export const IDLE_OUT_KEY = 'imss:idle-signout';
const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'];
const WRITE_EVERY_MS = 15 * 1000; // pointermove fires constantly; record at most this often

function read(storage) {
  try { const v = JSON.parse(storage.getItem(IDLE_KEY) || 'null'); return v && typeof v.t === 'number' ? v : null; } catch { return null; }
}

// Starts watching; returns stop(). onTimeout runs once, when the limit is reached
// here or in another tab. onActive(t) runs on each recorded interaction (the
// caller throttles its own server report).
export function startIdleSignOut({ sessionId, onTimeout, onActive = () => {}, win = window, storage = win.localStorage,
  now = () => Date.now(), limit = IDLE_LIMIT_MS, checkEvery = 30 * 1000 }) {
  let stopped = false, lastWrite = 0, timer = null;
  const finish = () => {
    if (stopped) return;
    stop();
    try { storage.setItem(IDLE_OUT_KEY, JSON.stringify({ sid: sessionId, t: now() })); } catch { /* storage blocked */ }
    onTimeout();
  };
  const record = force => {
    const t = now();
    if (!force && t - lastWrite < WRITE_EVERY_MS) return;
    lastWrite = t;
    try { storage.setItem(IDLE_KEY, JSON.stringify({ sid: sessionId, t })); } catch { /* storage blocked */ }
    onActive(t);
  };
  const check = () => {
    if (stopped) return;
    const v = read(storage);
    // Another session's clock (an earlier sign-in) doesn't count against this one.
    if (!v || v.sid !== sessionId) { record(true); return; }
    if (now() - v.t >= limit) finish();
  };
  const onActivity = () => {
    // Coming back after the limit: the first touch must not count as activity.
    const v = read(storage);
    if (v && v.sid === sessionId && now() - v.t >= limit) { finish(); return; }
    record(false);
  };
  const onStorage = e => {
    if (e.key !== IDLE_OUT_KEY || !e.newValue) return;
    try { if (JSON.parse(e.newValue).sid === sessionId) finish(); } catch { /* ignore */ }
  };
  const onWake = () => { if (!win.document || win.document.visibilityState !== 'hidden') check(); };

  for (const ev of ACTIVITY_EVENTS) win.addEventListener(ev, onActivity, { passive: true, capture: true });
  win.addEventListener('storage', onStorage);
  win.addEventListener('focus', onWake);
  win.addEventListener('pageshow', onWake);
  if (win.document) win.document.addEventListener('visibilitychange', onWake);
  timer = win.setInterval(check, checkEvery);
  check(); // after setup, so an already-expired clock (app reopened later) can stop cleanly


  function stop() {
    if (stopped) return;
    stopped = true;
    if (timer !== null) win.clearInterval(timer);
    for (const ev of ACTIVITY_EVENTS) win.removeEventListener(ev, onActivity, { capture: true });
    win.removeEventListener('storage', onStorage);
    win.removeEventListener('focus', onWake);
    win.removeEventListener('pageshow', onWake);
    if (win.document) win.document.removeEventListener('visibilitychange', onWake);
  }
  return stop;
}

// The session id inside a Supabase access token (its session_id claim).
export function sessionIdOf(accessToken) {
  try { return JSON.parse(atob(String(accessToken).split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).session_id || null; } catch { return null; }
}

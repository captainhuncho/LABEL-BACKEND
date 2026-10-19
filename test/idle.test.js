// Idle sign-out (src/idleSignOut.js): a fake clock, fake timers and two "tabs"
// that share one localStorage, the way a browser's tabs do.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IDLE_KEY, IDLE_LIMIT_MS, sessionIdOf, startIdleSignOut } from '../src/idleSignOut.js';

const MIN = 60 * 1000;
function world() {
  let clock = 1_800_000_000_000;
  const data = new Map();
  const tabs = [];
  const storage = {
    getItem: k => (data.has(k) ? data.get(k) : null),
    // Like a browser: other tabs get a "storage" event, the writing tab doesn't.
    setItem: (k, v) => { data.set(k, String(v)); for (const t of tabs) if (t !== storage.writer) t.fire('storage', { key: k, newValue: String(v) }, 'win', false); },
  };
  function tab() {
    const listeners = new Map();
    const timers = [];
    const on = (e, f, where = 'win') => { const k = where + ':' + e; listeners.set(k, [...(listeners.get(k) || []), f]); };
    const off = (e, f, where = 'win') => { const k = where + ':' + e; listeners.set(k, (listeners.get(k) || []).filter(x => x !== f)); };
    const doc = { visibilityState: 'visible', addEventListener: (e, f) => on(e, f, 'doc'), removeEventListener: (e, f) => off(e, f, 'doc') };
    const t = {
      document: doc,
      addEventListener: (e, f) => on(e, f), removeEventListener: (e, f) => off(e, f),
      setInterval: (f, ms) => { timers.push({ f, ms, due: clock + ms }); return timers.length; },
      clearInterval: id => { timers[id - 1] = null; },
      fire: (e, ev = {}, where = 'win', asWriter = true) => {
        const prev = storage.writer; if (asWriter) storage.writer = t;
        for (const f of listeners.get(where + ':' + e) || []) f(ev);
        storage.writer = prev;
      },
      // Timers run only while the tab is awake.
      runTimers: () => { for (const x of timers) if (x && clock >= x.due) { x.due = clock + x.ms; const prev = storage.writer; storage.writer = t; x.f(); storage.writer = prev; } },
      sleep: () => { doc.visibilityState = 'hidden'; t.fire('visibilitychange', {}, 'doc'); },
      wake: () => { doc.visibilityState = 'visible'; t.fire('visibilitychange', {}, 'doc'); },
    };
    tabs.push(t);
    return t;
  }
  const advance = (ms, awake = []) => { const end = clock + ms; while (clock < end) { clock = Math.min(end, clock + 30 * 1000); for (const t of awake) t.runTimers(); } };
  return { tab, advance, now: () => clock, storage };
}
function start(w, win, sessionId = 's1') {
  const out = { timedOut: 0, reports: 0 };
  const prev = w.storage.writer; w.storage.writer = win;
  out.stop = startIdleSignOut({ sessionId, win, storage: w.storage, now: w.now, onTimeout: () => { out.timedOut++; }, onActive: () => { out.reports++; } });
  w.storage.writer = prev;
  return out;
}

test('signs out after exactly 3 hours with no interaction, not before', () => {
  const w = world(); const a = w.tab(); const s = start(w, a);
  w.advance(IDLE_LIMIT_MS - MIN, [a]);
  assert.equal(s.timedOut, 0);
  w.advance(MIN, [a]);
  assert.equal(s.timedOut, 1);
});

test('real interaction resets the clock; time passing alone does not', () => {
  const w = world(); const a = w.tab(); const s = start(w, a);
  w.advance(2 * 60 * MIN, [a]);
  a.fire('keydown');
  w.advance(2 * 60 * MIN, [a]);
  assert.equal(s.timedOut, 0, 'only 2 h since the key press');
  w.advance(60 * MIN, [a]);
  assert.equal(s.timedOut, 1);
});

test('a sleeping tab signs out the moment it wakes, and the first touch after does not save it', () => {
  const w = world(); const a = w.tab(); const s = start(w, a);
  a.sleep();
  w.advance(4 * 60 * MIN, []); // timers don't run while asleep
  assert.equal(s.timedOut, 0);
  a.fire('pointerdown'); // touched before the wake check runs
  assert.equal(s.timedOut, 1);
  const w2 = world(); const b = w2.tab(); const s2 = start(w2, b);
  b.sleep(); w2.advance(4 * 60 * MIN, []); b.wake();
  assert.equal(s2.timedOut, 1, 'wake check signs out');
});

test('activity in one tab keeps every tab signed in', () => {
  const w = world(); const a = w.tab(); const b = w.tab();
  const sa = start(w, a); const sb = start(w, b);
  for (let i = 0; i < 4; i++) { w.advance(60 * MIN, [a, b]); a.fire('pointermove'); }
  assert.equal(sa.timedOut + sb.timedOut, 0, '4 h open, active in tab A every hour');
});

test('when one tab times out, the other signs out too', () => {
  const w = world(); const a = w.tab(); const b = w.tab();
  const sa = start(w, a); const sb = start(w, b);
  b.sleep();
  w.advance(IDLE_LIMIT_MS, [a]); // only A's timer runs
  assert.equal(sa.timedOut, 1);
  assert.equal(sb.timedOut, 1, 'B heard A through storage');
});

test('a new sign-in starts a fresh clock even if an old one expired', () => {
  const w = world(); const a = w.tab();
  w.storage.setItem(IDLE_KEY, JSON.stringify({ sid: 'old', t: w.now() - 10 * 60 * MIN }));
  const s = start(w, a, 'new');
  assert.equal(s.timedOut, 0);
  w.advance(IDLE_LIMIT_MS - MIN, [a]);
  assert.equal(s.timedOut, 0);
});

test('reopening the app after 3 h away signs out straight away', () => {
  const w = world(); const a = w.tab(); const s1 = start(w, a); s1.stop();
  w.advance(3 * 60 * MIN + MIN, []); // browser closed
  const b = w.tab(); const s2 = start(w, b);
  assert.equal(s2.timedOut, 1);
});

test('activity is reported to the server, throttled by pointermove bursts', () => {
  const w = world(); const a = w.tab(); const s = start(w, a);
  w.advance(MIN, [a]); a.fire('pointermove');
  const after = s.reports;
  for (let i = 0; i < 50; i++) a.fire('pointermove');
  assert.equal(s.reports, after, 'same instant: no extra writes');
  w.advance(MIN, [a]); a.fire('pointermove');
  assert.equal(s.reports, after + 1);
});

test('sessionIdOf reads the session_id claim', () => {
  const payload = Buffer.from(JSON.stringify({ session_id: 'abc-123' })).toString('base64url');
  assert.equal(sessionIdOf('h.' + payload + '.sig'), 'abc-123');
  assert.equal(sessionIdOf('garbage'), null);
});

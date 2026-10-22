// Delivery test for supabase/functions/notify/index.ts: runs the real function
// with the database and Resend replaced in-process (no network, no live data).
//   npx deno run --allow-env --allow-read --allow-net=registry.npmjs.org test/notify-delivery.deno.ts
// One batch holds an earnings event (3 artists), a notice (3 artists) and a
// statement (1 artist), then a release-week run. Resend fails for b@x.com on
// each first attempt only.
// Expected: attempt 1 sends the 4 emails to a@ and c@ and leaves all 3 events
// open (status "retry"); attempt 2 sends only b@'s 3 emails (status "done");
// no email and no bell notice is ever sent twice.

Deno.env.set('SUPABASE_URL', 'http://mock.local');
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test');
Deno.env.set('RESEND_API_KEY', 'test');

type Row = Record<string, any>;
const data: Record<string, unknown> = {
  staff: [],
  labelSettings: {},
  roster: [
    { id: 'A', name: 'Ann', email: 'a@x.com' },
    { id: 'B', name: 'Bo', email: 'b@x.com' },
    { id: 'C', name: 'Cy', email: 'c@x.com' },
  ],
  revenuePublish: [{ id: 'p1', status: 'Published', items: [{ artistId: 'A', month: '2026-08' }, { artistId: 'B', month: '2026-08' }, { artistId: 'C', month: '2026-08' }] }],
  notices: [{ id: 'n1', title: 'Hello', message: 'Hi all', audience: 'all' }],
  payouts: [{ id: 's1', artistSlug: 'bo', periodStart: '2026-08', periodEnd: '2026-08', artistShare: 5 }],
};
// Mirrors private.email_deliveries and the delivery_* functions.
const deliveries = new Map<number, Row>();
const delivery: Row = {
  id: 1, status: 'pending', attempts: 0, done: [] as number[], sent: [] as string[], last_error: null,
  events: [{ type: 'earnings', key: 'revenuePublish', id: 'p1' }, { type: 'notice', key: 'notices', id: 'n1' }, { type: 'statement', key: 'payouts', id: 's1' }],
};
deliveries.set(1, delivery);
const emails: { to: string; subject: string }[] = [];
const bells: { to: string; subject: string }[] = [];
const failing = new Set(['b@x.com']);
const lostReply = new Set<string>();
const accepted = new Map<string, unknown>();
const keysSeen: (string | null)[] = [];

const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { 'Content-Type': 'application/json' } });
const rpc: Record<string, (a: Row) => unknown> = {
  notify_secret_ok: () => true,
  delivery_create: a => { const id = deliveries.size + 1; deliveries.set(id, { id, status: 'pending', attempts: 0, done: [], sent: [], events: a.events }); return id; },
  delivery_claim: a => {
    const d = deliveries.get(a.delivery_id)!;
    if (!['pending', 'retry'].includes(d.status)) return null;
    d.status = 'sending'; d.attempts++;
    return { events: d.events, done: d.done, sent: d.sent, attempts: d.attempts };
  },
  delivery_event_done: a => { const d = deliveries.get(a.delivery_id)!; if (!d.done.includes(a.idx)) d.done.push(a.idx); return null; },
  delivery_recipient_sent: a => { const d = deliveries.get(a.delivery_id)!; if (!d.sent.includes(a.sent_key)) d.sent.push(a.sent_key); return null; },
  delivery_finish: a => {
    const d = deliveries.get(a.delivery_id)!;
    d.status = d.done.length >= d.events.length ? 'done' : d.attempts >= 5 ? 'failed' : 'retry';
    d.last_error = a.err; return d.status;
  },
};

const realFetch = globalThis.fetch;
globalThis.fetch = async (input: Request | URL | string, init?: RequestInit) => {
  const req = new Request(input, init);
  const url = new URL(req.url);
  const body = req.method === 'GET' ? null : await req.text();
  if (url.host === 'api.resend.com') {
    const msg = JSON.parse(body || '{}');
    const to = msg.to[0];
    const key = req.headers.get('Idempotency-Key');
    keysSeen.push(key);
    // Like Resend: a key it has already accepted returns the first result, no new email.
    if (key && accepted.has(key)) return json(accepted.get(key));
    if (failing.has(to)) return json({ message: 'simulated outage' }, 500);
    emails.push({ to, subject: msg.subject });
    const result = { id: 'email_' + emails.length };
    if (key) accepted.set(key, result);
    // Resend took it but the reply never arrived (the function's timeout fires).
    if (lostReply.has(to)) { lostReply.delete(to); throw new DOMException('The signal has been aborted', 'TimeoutError'); }
    return json(result);
  }
  if (url.host !== 'mock.local') return realFetch(input, init);
  const path = url.pathname.replace('/rest/v1/', '');
  if (path.startsWith('rpc/')) return json(rpc[path.slice(4)](JSON.parse(body || '{}')));
  if (path === 'app_data' && req.method === 'GET') {
    const key = (url.searchParams.get('key') || '').replace(/^eq\./, '');
    const row = key in data ? { value: data[key] } : null;
    return (req.headers.get('Accept') || '').includes('vnd.pgrst.object') ? json(row) : json(row ? [row] : []);
  }
  if (path === 'notifications') { for (const n of JSON.parse(body || '[]')) bells.push({ to: n.recipient_email, subject: n.title }); return new Response(null, { status: 201 }); }
  if (path === 'audit_log') return new Response(null, { status: 201 });
  throw new Error('unexpected request ' + req.method + ' ' + url.pathname);
};

let handler: (req: Request) => Promise<Response> = () => { throw new Error('no handler'); };
// @ts-ignore: capture the function's handler instead of opening a port
Deno.serve = (h: typeof handler) => { handler = h; return { finished: Promise.resolve(), shutdown: async () => {} }; };
await import('../supabase/functions/notify/index.ts');

const call = async (body: Row) => (await handler(new Request('http://fn/notify', {
  method: 'POST', headers: { 'x-notify-secret': 's' }, body: JSON.stringify(body),
}))).json();
const post = () => call({ action: 'events', events: delivery.events, delivery: delivery.id });

let failures = 0;
const check = (label: string, ok: boolean, got?: unknown) => { console.log((ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + JSON.stringify(got))); if (!ok) failures++; };
const sorted = (xs: { to: string; subject: string }[]) => xs.map(e => e.to + ' ' + e.subject).sort();

const r1 = await post();
check('attempt 1: status retry', delivery.status === 'retry', delivery.status);
check('attempt 1: 4 emails (a@ and c@ for earnings and notice), none to b@', emails.length === 4 && !emails.some(e => e.to === 'b@x.com'), sorted(emails));
check('attempt 1: no event marked done', delivery.done.length === 0, delivery.done);
check('attempt 1: 4 recipients recorded as sent', delivery.sent.length === 4, delivery.sent);
check('attempt 1: bell notices only for sent emails', bells.length === 4, sorted(bells));

failing.clear();
const r2 = await post();
check('attempt 2: status done', delivery.status === 'done', { status: delivery.status, r2 });
check('attempt 2: only b@ got its 3 emails', emails.length === 7 && emails.slice(4).every(e => e.to === 'b@x.com'), sorted(emails.slice(4)));
check('all 3 events done', [...delivery.done].sort().join() === '0,1,2', delivery.done);
const dup = (xs: { to: string; subject: string }[]) => new Set(sorted(xs)).size !== xs.length;
check('no email sent twice', !dup(emails), sorted(emails));
check('no bell notice twice', !dup(bells) && bells.length === 7, sorted(bells));

const r3 = await post();
check('a post after done sends nothing', emails.length === 7 && (r3 as Row).skipped !== undefined, r3);

// Release week (Monday cron): goes through a recorded delivery too.
const today = new Date().toISOString().slice(0, 10);
data.catalog = [{ id: 'r1', title: 'Song A', artistId: 'A', releaseDate: today }, { id: 'r2', title: 'Song B', artistId: 'B', releaseDate: today }];
failing.add('b@x.com');
const before = emails.length;
await call({ action: 'releaseWeek' });
const week = deliveries.get(2)!;
check('release week: recorded as delivery 2, status retry', !!week && week.status === 'retry', week);
check('release week: a@ emailed, b@ failed', emails.length === before + 1 && emails[emails.length - 1].to === 'a@x.com', sorted(emails.slice(before)));
failing.clear();
await call({ action: 'events', events: week.events, delivery: 2 });
check('release week retry: only b@ emailed, status done', emails.length === before + 2 && emails[emails.length - 1].to === 'b@x.com' && week.status === 'done', { week, new: sorted(emails.slice(before)) });

check('every delivery email carried an Idempotency-Key', keysSeen.length > 0 && keysSeen.every(k => !!k && k.length <= 256), keysSeen);

// Resend accepts c@'s email but the reply is lost (timeout): the event stays
// open, and the retry reuses the key, so c@ still gets one email.
data.notices = [...(data.notices as Row[]), { id: 'n2', title: 'Second', message: 'Again', audience: 'all' }];
deliveries.set(3, { id: 3, status: 'pending', attempts: 0, done: [], sent: [], events: [{ type: 'notice', key: 'notices', id: 'n2' }] });
lostReply.add('c@x.com');
const beforeLost = emails.length;
await call({ action: 'events', events: deliveries.get(3)!.events, delivery: 3 });
check('lost reply: delivery 3 left for retry', deliveries.get(3)!.status === 'retry', deliveries.get(3));
await call({ action: 'events', events: deliveries.get(3)!.events, delivery: 3 });
const lostNew = emails.slice(beforeLost);
check('lost reply: retry done, c@ emailed once, a@ and b@ once each', deliveries.get(3)!.status === 'done' && lostNew.length === 3 && new Set(lostNew.map(e => e.to)).size === 3, { d: deliveries.get(3), lostNew });

console.log(failures ? `${failures} check(s) failed` : 'all checks passed');
if (failures) { console.log(JSON.stringify({ r1, r2 }, null, 1).slice(0, 3000)); Deno.exit(1); }
Deno.exit(0);

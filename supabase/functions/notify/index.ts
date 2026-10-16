// IMSS Records email: notifications out through Resend, replies back in.
//
// Called by three things:
//  - the app_data trigger (x-notify-secret header): { action: 'events', events: [...] }
//  - pg_cron every 10 minutes (x-notify-secret header): { action: 'due' }
//  - Resend's "email.received" webhook (svix-* signature headers)
//
// Secrets (Supabase → Edge Functions → Secrets): RESEND_API_KEY (full access),
// RESEND_WEBHOOK_SECRET (whsec_…), RECEIVE_DOMAIN (e.g. reply.imssrecords.com).
// Optional: APP_URL, MAIL_FROM.
import { createClient } from 'npm:@supabase/supabase-js@2';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const RESEND_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const WEBHOOK_SECRET = Deno.env.get('RESEND_WEBHOOK_SECRET') ?? '';
const RECEIVE_DOMAIN = Deno.env.get('RECEIVE_DOMAIN') ?? '';
const APP_URL = Deno.env.get('APP_URL') ?? 'https://ops.imssrecords.com';
const MAIL_FROM = Deno.env.get('MAIL_FROM') ?? 'IMSS Records <noreply@imssrecords.com>';

type Item = Record<string, any>;
type Event = { type: 'new' | 'message' | 'statement' | 'stage' | 'earnings'; key: string; id: string };

// ---------- data ----------
async function section(key: string): Promise<Item[]> {
  const { data } = await db.from('app_data').select('value').eq('key', key).maybeSingle();
  return Array.isArray(data?.value) ? data!.value : [];
}
async function saveSection(key: string, value: Item[]) {
  const { error } = await db.from('app_data').update({ value, updated_at: new Date().toISOString() }).eq('key', key);
  if (error) throw error;
}
const slug = (s: string) => String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const lower = (s: string) => String(s || '').trim().toLowerCase();

// The artist's PM and A&R (by name on their Roster entry) plus every Admin.
async function teamFor(artist: Item | undefined): Promise<string[]> {
  const staff = await section('staff');
  const assigned = [artist?.productManager, artist?.anr].filter(Boolean).map(lower);
  const emails = staff
    .filter(s => (s.status || 'Active') !== 'Inactive')
    .filter(s => s.role === 'Admin' || assigned.includes(lower(s.name)))
    .map(s => String(s.email || '').trim())
    .filter(e => e.includes('@'));
  return [...new Set(emails.map(lower))];
}

// Invoice queues: PM Approval → the artist's PM; the rest → people an Admin
// assigned in labelSettings.invoiceWorkflow. Falls back to Admins.
const STAGE_KEY: Record<string, string> = { 'Finance Queue': 'finance', 'LH Queue': 'lh', 'DP Queue': 'dp', 'Pay Approved': 'pay' };
async function stageReviewers(status: string, artist: Item | undefined): Promise<string[]> {
  const staff = await section('staff');
  const active = staff.filter(m => (m.status || 'Active') !== 'Inactive');
  let people: Item[] = [];
  if (status === 'PM Approval' || status === 'Pending') {
    // The PM and every Admin: either can approve, so neither waits on the other.
    people = active.filter(m => m.role === 'Admin' || (artist?.productManager && lower(m.name) === lower(artist.productManager)));
  } else if (STAGE_KEY[status]) {
    const { data } = await db.from('app_data').select('value').eq('key', 'labelSettings').maybeSingle();
    const ids: string[] = (data?.value?.invoiceWorkflow || {})[STAGE_KEY[status]] || [];
    people = active.filter(m => ids.includes(m.id));
  }
  if (!people.length) people = active.filter(m => m.role === 'Admin');
  return [...new Set(people.map(m => lower(m.email)).filter(e => e.includes('@')))];
}

// ---------- mail ----------
const esc = (s: string) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
function page(title: string, lines: string[], cta: { label: string; url: string }, quote?: string) {
  return `<!doctype html><html><body style="margin:0;background:#14171A;padding:24px;font-family:Helvetica,Arial,sans-serif;color:#EEEAE2">
<table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#1B1F23;border:1px solid #2E3337;border-radius:14px"><tr><td style="padding:28px">
<div style="font-weight:700;letter-spacing:.04em;font-size:13px;color:#E7A23D">IMSS RECORDS</div>
<h1 style="font-size:20px;line-height:1.3;margin:14px 0 12px;color:#EEEAE2">${esc(title)}</h1>
${lines.map(l => `<p style="margin:0 0 10px;font-size:15px;line-height:1.55;color:#C9CDCC">${l}</p>`).join('')}
${quote ? `<div style="margin:16px 0;padding:12px 14px;border-left:3px solid #E7A23D;background:#22272B;border-radius:0 8px 8px 0;font-size:15px;line-height:1.55;color:#EEEAE2;white-space:pre-wrap">${esc(quote)}</div>` : ''}
<p style="margin:20px 0 0"><a href="${cta.url}" style="display:inline-block;background:#E7A23D;color:#1A1500;text-decoration:none;font-weight:600;padding:10px 18px;border-radius:12px">${esc(cta.label)}</a></p>
<!--REPLY_NOTE-->
</td></tr></table></body></html>`;
}

async function send(to: string[], subject: string, html: string, replyKey?: string) {
  const recipients = [...new Set(to.filter(e => e && e.includes('@')))];
  if (!recipients.length || !RESEND_KEY) return { skipped: !RESEND_KEY ? 'no RESEND_API_KEY' : 'no recipients' };
  // Only emails with a reply address (submissions, requests, invoices) say replies work.
  const replyable = Boolean(replyKey && RECEIVE_DOMAIN);
  const note = replyable ? '<p style="margin:18px 0 0;font-size:13px;color:#9BA1A1">You can reply to this email; your reply is added to the conversation in the app.</p>' : '';
  const body: Record<string, unknown> = { from: MAIL_FROM, to: recipients, subject, html: html.replace('<!--REPLY_NOTE-->', note) };
  if (replyable) body.reply_to = `reply-${replyKey}@${RECEIVE_DOMAIN}`;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.text() };
}

const KEY_CODE: Record<string, string> = { releaseSubmissions: 's', artistRequests: 'q', invoices: 'i' };
const CODE_KEY: Record<string, string> = { s: 'releaseSubmissions', q: 'artistRequests', i: 'invoices' };

// ---------- outgoing ----------
async function handleEvent(ev: Event) {
  const items = await section(ev.key);
  const item = items.find(x => x.id === ev.id);
  if (!item) return { skipped: 'not found' };
  const roster = await section('roster');

  // Earnings published: one email per artist, naming their months.
  if (ev.type === 'earnings') {
    const byArtist: Record<string, string[]> = {};
    for (const i of (item.items || [])) if (i.artistId) (byArtist[i.artistId] = byArtist[i.artistId] || []).push(i.month);
    const results = [];
    for (const [artistId, months] of Object.entries(byArtist)) {
      const a = roster.find(r => r.id === artistId);
      const email = String(a?.email || '').trim();
      if (!email) { results.push({ skipped: 'no email for ' + artistId }); continue; }
      const names = [...new Set(months)].sort().map(m => new Date(m + '-01T00:00:00Z').toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }));
      const list = names.length > 1 ? names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1] : names[0];
      results.push(await send([email], `Your IMSS Records earnings for ${list} are ready`,
        page('New earnings in your portal', [`Hi ${esc(a.name)},`, `Your earnings for <b>${esc(list)}</b> are now in your IMSS Records portal, with the breakdown by song, platform and country.`],
          { label: 'See your earnings', url: `${APP_URL}/` })));
    }
    return results;
  }

  const artist = ev.key === 'payouts'
    ? roster.find(a => slug(a.name) === item.artistSlug)
    : roster.find(a => a.id === item.artistId);
  const artistName = artist?.name || 'An artist';
  const artistEmail = String(artist?.email || '').trim();
  const replyKey = KEY_CODE[ev.key] ? `${KEY_CODE[ev.key]}-${item.id}` : undefined;

  if (ev.type === 'statement') {
    const period = item.periodStart === item.periodEnd ? item.periodStart : `${item.periodStart} to ${item.periodEnd}`;
    return send([artistEmail], `Your IMSS Records statement is ready (${period})`,
      page('Your royalty statement is ready', [`Hi ${esc(artistName)},`, `Your statement for <b>${esc(period)}</b> is ready in your IMSS Records portal.`, `Your earnings for this period: <b>$${Number(item.artistShare || 0).toFixed(2)}</b>.`],
        { label: 'View your statement', url: `${APP_URL}/` }));
  }

  if (ev.type === 'new') {
    const team = await teamFor(artist);
    if (ev.key === 'releaseSubmissions') {
      return send(team, `New release submission: “${item.title}” from ${artistName}`,
        page(`${artistName} submitted “${item.title}”`, [`A new ${esc(item.type || 'release')} is waiting for review${item.proposedDate ? `, proposed for <b>${esc(item.proposedDate)}</b>` : ''}.`, 'Check it’s complete, then accept it into Catalog or ask for more information.'],
          { label: 'Review in Submissions', url: `${APP_URL}/` }, item.notes || undefined), replyKey);
    }
    if (ev.key === 'artistRequests') {
      return send(team, `New request from ${artistName}: ${item.title || item.category}`,
        page(`${artistName} sent a request`, [`Category: <b>${esc(item.category || 'Other')}</b>`, `Title: <b>${esc(item.title || '')}</b>`],
          { label: 'Open Artist Requests', url: `${APP_URL}/` }, item.message || undefined), replyKey);
    }
    if (ev.key === 'invoices') {
      const kind = item.kind === 'expense' ? 'expense claim' : 'service invoice';
      return send(await stageReviewers('PM Approval', artist), `PM Approval: ${kind} from ${artistName}, $${Number(item.amount || 0).toFixed(2)}`,
        page(`${artistName} submitted an ${kind}`, [`<b>${esc(item.title || '')}</b> · $${Number(item.amount || 0).toFixed(2)}`, 'It’s waiting for PM Approval in Invoices.'],
          { label: 'Open Invoices', url: `${APP_URL}/` }, item.details || undefined), replyKey);
    }
  }

  if (ev.type === 'stage' && ev.key === 'invoices') {
    const amount = `$${Number(item.amount || 0).toFixed(2)}`;
    const last = (Array.isArray(item.history) ? item.history : []).slice(-1)[0] || {};
    if (item.status === 'Rejected') {
      return send([artistEmail], `Your invoice “${item.title}” wasn’t approved`,
        page('Your invoice wasn’t approved', [`Hi ${esc(artistName)}, your invoice <b>${esc(item.title)}</b> (${amount}) wasn’t approved.`],
          { label: 'Open your portal', url: `${APP_URL}/` }, item.reviewNote || last.note || undefined), replyKey);
    }
    if (item.status === 'Paid') {
      return send([artistEmail], `Paid: your invoice “${item.title}” (${amount})`,
        page('Your invoice has been paid', [`Hi ${esc(artistName)}, <b>${esc(item.title)}</b> for <b>${amount}</b> has been paid.`], { label: 'Open your portal', url: `${APP_URL}/` }), replyKey);
    }
    const reviewers = await stageReviewers(item.status, artist);
    const back = last.action === 'sent back', moved = last.action === 'moved by Admin';
    return send(reviewers, `${back ? 'Sent back' : 'Ready'} for ${item.status}: ${artistName}, ${amount}`,
      page(`${item.status}: ${artistName}`, [`<b>${esc(item.title)}</b> · ${amount}`, back ? `${esc(last.by || 'Someone')} sent it back from ${esc(last.from || 'the next queue')}.` : moved ? `${esc(last.by || 'An Admin')} moved it here from ${esc(last.from || 'another queue')}; it’s now waiting for you.` : `${esc(last.by || 'It')} approved it at ${esc(last.from || 'the previous queue')}; it’s now waiting for you.`],
        { label: 'Open Invoices', url: `${APP_URL}/` }, last.note || undefined), replyKey);
  }

  if (ev.type === 'message') {
    const msgs: Item[] = Array.isArray(item.messages) ? item.messages : [];
    const last = msgs[msgs.length - 1];
    const what = ev.key === 'releaseSubmissions' ? `your release “${item.title}”` : ev.key === 'invoices' ? `your invoice “${item.title}”` : `your request “${item.title || item.category}”`;
    // A label response on a request (the older single-response field) counts as a label message.
    const labelText = last && last.from === 'label' ? last.text : (ev.key === 'artistRequests' && item.response && (!last || last.from !== 'artist') ? item.response : null);
    if (labelText) {
      return send([artistEmail], `IMSS Records replied about ${what.replace('your ', '')}`,
        page('The label replied', [`Hi ${esc(artistName)}, here’s a message about ${esc(what)}:`],
          { label: 'Open your portal', url: `${APP_URL}/` }, labelText), replyKey);
    }
    if (last && last.from === 'artist') {
      // Invoice replies go to whoever holds the invoice now, plus Admins.
      const team = ev.key === 'invoices' ? [...new Set([...(await stageReviewers(item.status, artist)), ...(await teamFor(undefined))])] : await teamFor(artist);
      const label = ev.key === 'releaseSubmissions' ? `“${item.title}”` : ev.key === 'invoices' ? `invoice “${item.title}”` : `request “${item.title || item.category}”`;
      return send(team, `${artistName} replied about ${label}`,
        page(`${artistName} replied`, [`About ${esc(label)}:`], { label: 'Open in the app', url: `${APP_URL}/` }, last.text), replyKey);
    }
  }
  return { skipped: 'no email for this event' };
}

// Scheduled statements whose time has come: stamp sentAt; the trigger then emails.
async function sendDueStatements() {
  const payouts = await section('payouts');
  const now = Date.now();
  let changed = 0;
  const next = payouts.map(p => {
    if (!p.sentAt && p.scheduledFor && Date.parse(p.scheduledFor) <= now) { changed++; return { ...p, sentAt: new Date().toISOString() }; }
    return p;
  });
  if (changed) await saveSection('payouts', next);
  return { sent: changed };
}

// ---------- incoming ----------
async function verifySvix(req: Request, raw: string) {
  const id = req.headers.get('svix-id'), ts = req.headers.get('svix-timestamp'), sig = req.headers.get('svix-signature');
  if (!id || !ts || !sig || !WEBHOOK_SECRET) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const secret = Uint8Array.from(atob(WEBHOOK_SECRET.replace(/^whsec_/, '')), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('raw', secret, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${id}.${ts}.${raw}`));
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));
  return sig.split(' ').some(part => part.split(',')[1] === expected);
}

// Keep only the new text of a reply, not the quoted original underneath.
function replyText(text: string) {
  const lines = String(text || '').replace(/\r/g, '').split('\n');
  const out: string[] = [];
  for (const line of lines) {
    if (/^On .+wrote:\s*$/i.test(line) || /^-{2,}\s*Original Message/i.test(line) || /^From: /i.test(line) || line.startsWith('>')) break;
    out.push(line);
  }
  return out.join('\n').trim().slice(0, 5000);
}
const addressOf = (s: string) => lower((String(s).match(/<([^>]+)>/) || [, s])[1] as string);

async function handleInbound(data: Item) {
  const emailId = data.email_id || data.id;
  const res = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, { headers: { Authorization: `Bearer ${RESEND_KEY}` } });
  if (!res.ok) return { skipped: 'could not fetch email ' + res.status };
  const email = await res.json();
  const toList: string[] = [].concat(email.to || data.to || []).map(addressOf);
  const target = toList.map(t => t.match(/^reply-([sqi])-([^@]+)@/)).find(Boolean);
  if (!target) return { skipped: 'not a reply address' };
  const key = CODE_KEY[target[1]], id = target[2];
  const from = addressOf(email.from || data.from || '');
  const text = replyText(email.text || String(email.html || '').replace(/<[^>]+>/g, ' '));
  if (!text) return { skipped: 'empty reply' };

  const [items, roster, staff] = await Promise.all([section(key), section('roster'), section('staff')]);
  const item = items.find(x => x.id === id);
  if (!item) return { skipped: 'thread not found' };
  const artist = roster.find(a => a.id === item.artistId);
  const member = staff.find(s => lower(s.email) === from);
  let msg: Item;
  if (artist && lower(artist.email) === from) msg = { from: 'artist', by: artist.name, at: new Date().toISOString(), text, via: 'email' };
  else if (member) msg = { from: 'label', by: member.name, at: new Date().toISOString(), text, via: 'email' };
  else return { skipped: 'sender is not the artist or a team member' };

  const next = items.map(x => x.id !== id ? x : {
    ...x,
    messages: [...(Array.isArray(x.messages) ? x.messages : []), msg],
    ...(key === 'releaseSubmissions' && msg.from === 'artist' && x.status === 'Needs info' ? { status: 'Pending' } : {}),
  });
  await saveSection(key, next);
  return { added: msg.from };
}

// ---------- entry ----------
Deno.serve(async req => {
  if (req.method !== 'POST') return new Response('ok');
  const raw = await req.text();
  try {
    if (req.headers.get('svix-id')) {
      if (!(await verifySvix(req, raw))) return new Response('bad signature', { status: 401 });
      const ev = JSON.parse(raw);
      const result = ev.type === 'email.received' ? await handleInbound(ev.data || {}) : { skipped: ev.type };
      return Response.json(result);
    }
    const { data: ok } = await db.rpc('notify_secret_ok', { candidate: req.headers.get('x-notify-secret') || '' });
    if (!ok) return new Response('forbidden', { status: 403 });
    const body = JSON.parse(raw || '{}');
    if (body.action === 'due') return Response.json(await sendDueStatements());
    if (body.action === 'events') {
      const results = [];
      for (const ev of (body.events || []) as Event[]) results.push(await handleEvent(ev).catch(e => ({ error: String(e) })));
      return Response.json(results);
    }
    return new Response('unknown action', { status: 400 });
  } catch (e) {
    return new Response(String(e), { status: 500 });
  }
});

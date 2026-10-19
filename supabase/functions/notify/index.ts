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
import { AsyncLocalStorage } from 'node:async_hooks';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const RESEND_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const WEBHOOK_SECRET = Deno.env.get('RESEND_WEBHOOK_SECRET') ?? '';
const RECEIVE_DOMAIN = Deno.env.get('RECEIVE_DOMAIN') ?? '';
const APP_URL = Deno.env.get('APP_URL') ?? 'https://ops.imssrecords.com';
// Artists use their own address; emails to them link there.
const ARTIST_URL = Deno.env.get('ARTIST_URL') ?? 'https://artist.imssrecords.com';
// Same wording as REPORTING_LAG_NOTE in src/constants.js.
const LAG_NOTE = 'Royalty reports have a lag of about 60 days or more from our distribution partners, so the latest months take time to appear.';
const MAIL_FROM = Deno.env.get('MAIL_FROM') ?? 'IMSS Records <noreply@imssrecords.com>';
// A real mailbox the team reads; emails without a thread reply address reply here.
const REPLY_TO = Deno.env.get('REPLY_TO') ?? '';

type Item = Record<string, any>;
type Event = { type: 'new' | 'message' | 'statement' | 'stage' | 'earnings' | 'deal' | 'dealSent' | 'notice' | 'repRelease' | 'repInvoice' | 'budgetSent'; key: string; id: string };

// ---------- data ----------
async function section(key: string): Promise<Item[]> {
  const { data } = await db.from('app_data').select('value').eq('key', key).maybeSingle();
  return Array.isArray(data?.value) ? data!.value : [];
}
// Change a section without overwriting someone's save made at the same moment:
// write only over the version just read, and re-read and retry if it moved on.
// change() returns null when there is nothing to save.
async function changeSection(key: string, change: (items: Item[]) => Item[] | null): Promise<boolean> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error: readError } = await db.from('app_data').select('value, updated_at').eq('key', key).maybeSingle();
    if (readError) throw readError;
    if (!data) throw new Error('section missing: ' + key);
    const next = change(Array.isArray(data.value) ? data.value : []);
    if (!next) return false;
    const { data: saved, error } = await db.from('app_data').update({ value: next }).eq('key', key).eq('updated_at', data.updated_at).select('key');
    if (error) throw error;
    if (saved && saved.length) return true;
  }
  throw new Error('section kept changing: ' + key);
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
  // Apple-style: soft grey ground, white card, system type, amber pill. Dark in mail apps that support it.
  const font = "-apple-system,BlinkMacSystemFont,'SF Pro Text','Helvetica Neue',Helvetica,Arial,sans-serif";
  return `<!doctype html><html><head><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark">
<style>@media (prefers-color-scheme: dark){.bg{background:#000!important}.card{background:#1c1c1e!important}.t{color:#f5f5f7!important}.t2{color:#a1a1a6!important}.q{background:#2c2c2e!important;color:#f5f5f7!important}.lg-l{display:none!important}.lg-d{display:block!important;max-height:none!important}}</style></head>
<body class="bg" style="margin:0;background:#f5f5f7;padding:32px 16px;font-family:${font};color:#1d1d1f;-webkit-font-smoothing:antialiased">
<table role="presentation" width="100%" style="max-width:560px;margin:0 auto"><tr><td>
<div style="padding:0 4px 18px"><img class="lg-l" src="${APP_URL}/email-logo-dark.png" width="88" height="40" alt="IMSS Records" style="display:block;border:0;height:40px;width:auto"><!--[if !mso]><!--><img class="lg-d" src="${APP_URL}/email-logo-light.png" width="88" height="40" alt="" style="display:none;border:0;height:40px;width:auto;max-height:0;overflow:hidden"><!--<![endif]--></div>
<table role="presentation" width="100%" class="card" style="background:#ffffff;border-radius:18px"><tr><td style="padding:32px 28px">
<h1 class="t" style="font-size:28px;line-height:1.15;letter-spacing:-0.025em;font-weight:700;margin:0 0 16px;color:#1d1d1f">${esc(title)}</h1>
${lines.map(l => `<p class="t2" style="margin:0 0 12px;font-size:17px;line-height:1.5;color:#424245">${l}</p>`).join('')}
${quote ? `<div class="q" style="margin:18px 0;padding:14px 16px;background:#f5f5f7;border-radius:14px;font-size:17px;line-height:1.5;color:#1d1d1f;white-space:pre-wrap">${esc(quote)}</div>` : ''}
<p style="margin:24px 0 0"><a href="${cta.url}" style="display:inline-block;background:#E7A23D;color:#1d1d1f;text-decoration:none;font-weight:600;font-size:17px;padding:12px 22px;border-radius:980px">${esc(cta.label)}</a></p>
<!--REPLY_NOTE-->
</td></tr></table>
<p class="t2" style="margin:18px 4px 0;font-size:12px;line-height:1.5;color:#6e6e73">© IMSS Records. Confidential: this email is for the named recipient only.</p>
</td></tr></table></body></html>`;
}

// Every email is also an in-app notification. The topic lets each side open the right screen.
function topicOf(subject: string) {
  const s = subject.toLowerCase();
  return s.includes('budget') ? 'budget' : s.includes('notice') ? 'notice' : s.includes('deal') ? 'deal' : s.includes('earnings') ? 'earnings' : s.includes('statement') ? 'statement'
    : s.includes('invoice') || s.includes('claim') ? 'invoice' : s.includes('submission') || s.includes('release') ? 'submission' : s.includes('request') ? 'request' : '';
}
async function notifyInApp(recipients: string[], subject: string) {
  const { error } = await db.from('notifications').insert(recipients.map(r => ({ recipient_email: r, title: subject, tab: topicOf(subject) })));
  return error ? String(error.message) : null;
}
// Artists get emails only about royalties, invoices, statements and payouts.
// Everything else reaches them in the portal: a bell notification, no email.
async function inAppOnly(to: string[], subject: string) {
  const recipients = [...new Set(to.filter(e => e && e.includes('@')).map(e => e.trim().toLowerCase()))];
  if (!recipients.length) return { skipped: 'no recipients' };
  return { inApp: await notifyInApp(recipients, subject) || 'ok' };
}
async function audit(action: string, detail: string, artistId: string | null = null) {
  await db.from('audit_log').insert({ actor_email: 'system', actor_name: 'Scheduler', actor_kind: 'system', action, detail, artist_id: artistId });
}

// Safety lock: artists are emailed only about royalties, statements (payouts),
// invoices, noticeboard posts, new sign-in notices, release week, and the portal welcome an Admin sends. Any other email to an address on the roster is dropped and logged,
// whatever the calling code asked for.
// Email addresses never appear in full in an email body: ma•••@g•••.com.
const maskEmail = (e: string) => e.replace(/^([^@]{1,2})[^@]*@([^.@])[^@]*?(\.[a-z]{2,})$/i, '$1•••@$2•••$3');
const maskEmails = (html: string) => html.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, maskEmail);
// Plain-text twin of the HTML (mail apps, and Gmail sorting, expect both).
function toText(html: string) {
  const body = html.replace(/[\s\S]*<body[^>]*>/i, '').replace(/<style[\s\S]*?<\/style>/gi, '');
  return body
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, '$2: $1')
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|h1|div|tr)>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&')
    .replace(/[ \t]+/g, ' ').replace(/\n[ \t]+/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
const ARTIST_EMAIL_TOPICS = ['earnings', 'statement', 'invoice', 'welcome', 'notice', 'security', 'release'];
// Admin's On/Off switches (labelSettings.emailSwitches; same keys as
// EMAIL_SWITCHES in src/constants.js). A switched-off email isn't sent; the
// bell notification still is. Each request keeps its own state (several can run
// at once in one worker): which email it is handling, and the switches it read.
// delivery: set while handling one event of a recorded batch (see handleEvents).
type Delivery = { id: number; event: number; sent: Set<string>; failed: boolean };
type RequestState = { switchKey: string; switches: Record<string, boolean> | null; delivery?: Delivery };
const requestState = new AsyncLocalStorage<RequestState>();
const state = () => requestState.getStore() || { switchKey: '', switches: null };
const setSwitch = (key: string) => { state().switchKey = key; };
async function switchedOff(key: string) {
  if (!key) return false;
  const st = state();
  if (!st.switches) {
    const { data } = await db.from('app_data').select('value').eq('key', 'labelSettings').maybeSingle();
    st.switches = (data?.value && data.value.emailSwitches) || {};
  }
  return st.switches![key] === false;
}
async function send(to: string[], subject: string, html: string, replyKey?: string, artistTopic?: string, bell = true, attachments?: { filename: string; content: string }[]) {
  let recipients = [...new Set(to.filter(e => e && e.includes('@')).map(e => e.trim().toLowerCase()))];
  if (!ARTIST_EMAIL_TOPICS.includes(artistTopic || '')) {
    const artists = new Set((await section('roster')).map(a => lower(a.email)).filter(e => e.includes('@')));
    const blocked = recipients.filter(r => artists.has(r));
    if (blocked.length) {
      recipients = recipients.filter(r => !artists.has(r));
      await audit('blocked an artist email', `"${subject}" not sent to ${blocked.join(', ')}: artists only get royalty, statement and invoice emails`);
    }
  }
  if (!recipients.length) return { skipped: 'no recipients' };
  if (await switchedOff(state().switchKey)) {
    const inAppOff = bell ? await notifyInApp(recipients, subject) : null;
    return { skipped: 'email switched off: ' + state().switchKey, inApp: inAppOff };
  }
  if (artistTopic) html = html.split(APP_URL).join(ARTIST_URL);
  html = maskEmails(html);
  if (!RESEND_KEY) return { skipped: 'no RESEND_API_KEY', inApp: bell ? await notifyInApp(recipients, subject) : null };
  // Only emails with a reply address (submissions, requests, invoices) say replies work.
  const replyable = Boolean(replyKey && RECEIVE_DOMAIN);
  const note = replyable ? '<p class="t2" style="margin:20px 0 0;font-size:14px;color:#6e6e73">You can reply to this email; your reply is added to the conversation in the app.</p>' : '';
  const finalHtml = html.replace('<!--REPLY_NOTE-->', note);
  const body: Record<string, unknown> = { from: MAIL_FROM, to: recipients, subject, html: finalHtml, text: toText(finalHtml) };
  if (attachments && attachments.length) body.attachments = attachments;
  if (replyable) body.reply_to = `reply-${replyKey}@${RECEIVE_DOMAIN}`;
  else if (REPLY_TO) body.reply_to = REPLY_TO;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const resBody = await res.text();
  // A failed send throws, so the delivery is retried; the bell notice is added
  // only once the email went, so a retry doesn't add it twice.
  if (!res.ok) throw new Error(`Resend ${res.status}: ${resBody.slice(0, 300)}`);
  const inApp = bell ? await notifyInApp(recipients, subject) : null;
  return { status: res.status, body: resBody, inApp };
}

// In loops that email many people one by one, one failed address must not stop
// the rest. Inside a recorded delivery, each email that went is recorded, so a
// retry sends only the ones that failed, and a failure leaves the event open
// (not done) so it is retried. Outside a delivery (release week) it is logged.
async function sendOne(...args: Parameters<typeof send>) {
  const d = state().delivery;
  const key = `${d ? d.event : ''}|${args[1]}|${args[0].map(lower).sort().join(',')}`;
  if (d && d.sent.has(key)) return { skipped: 'already sent' };
  let result;
  try { result = await send(...args); }
  catch (e) {
    await audit('could not send an email', `"${args[1]}" to ${args[0].join(', ')}: ${String(e).slice(0, 300)}`);
    if (d) d.failed = true;
    return { error: String(e) };
  }
  if (d) {
    // If this record fails, the event errors and is retried; that one email may then go twice.
    const { error } = await db.rpc('delivery_recipient_sent', { delivery_id: d.id, sent_key: key });
    if (error) throw error;
    d.sent.add(key);
  }
  return result;
}

const KEY_CODE: Record<string, string> = { releaseSubmissions: 's', artistRequests: 'q', invoices: 'i' };
const CODE_KEY: Record<string, string> = { s: 'releaseSubmissions', q: 'artistRequests', i: 'invoices' };

// Legal keeps the record: every approved deal or license change (including an
// Admin's own, which need no approval) is sent to everyone with the Legal role.
function describeChange(c: Item, catalog: Item[]) {
  const title = (id: string) => (catalog.find(s => s.id === id) || {}).title || 'a song';
  const p = c.patch || {};
  const pct = (x: unknown) => Math.round(Number(x) * 10000) / 100 + '%';
  switch (c.kind) {
    case 'contract': return `Contract terms: ${p.contractType === '2026' ? '2026 Distribution Agreement' : p.contractType === 'earlier' ? 'Earlier agreement' : 'not set'}, ${p.licenseYears} yr license${p.effectiveDate ? ', effective ' + p.effectiveDate : ''}, ${p.reportingPeriod} reporting, $${p.payoutThreshold} threshold${p.noExtension ? ', no unrecouped extension' : ''}`;
    case 'songLicense': return 'License details: ' + (c.songs || []).map((x: Item) => `${title(x.releaseId)} (${x.licenseYears} yr from ${x.availableFrom})`).join(', ');
    case 'termination': return `Termination notice ${c.noticeDate}: ${c.releaseId ? title(c.releaseId) : 'whole agreement'}`;
    case 'recouped': return `Account recouped in the quarter ending ${c.quarterEnd}`;
    case 'rightsReturned': return `Rights returned on ${c.date}: ` + (c.releaseIds || []).map(title).join(', ');
    case 'licenseOverride': return `${c.endDate ? 'License end overridden to ' + c.endDate : 'License end override removed'} for ${title(c.releaseId)}. Reason: ${c.note}`;
    case 'undo': return `Undid: ${c.what}. Reason: ${c.note}`;
    case 'licenseNotice': return `License notice sent to the artist: ${title(c.releaseId)} until ${c.end}`;
    default: return `Deal from ${c.from}: artist share ${pct(c.artistPct)}${c.was && c.was.artistPct != null ? ' (was ' + pct(c.was.artistPct) + ')' : ''}, ${c.fundingTier || 'Non-Funded'}${c.dealType ? ' · ' + c.dealType : ''}. ${c.reason || ''}`;
  }
}
async function recordForLegal(item: Item, artist: Item | undefined) {
  const staff = await section('staff');
  const to = staff.filter(m => m.role === 'Legal' && (m.status || 'Active') !== 'Inactive').map(m => String(m.email || '').trim());
  if (!to.length) return { skipped: 'no Legal staff' };
  const what = describeChange(item, await section('catalog'));
  const who = item.requestedBy === item.approvedBy ? `Recorded and applied by ${esc(item.approvedBy || 'an Admin')}` : `Recorded by ${esc(item.requestedBy || 'Legal')}, approved by ${esc(item.approvedBy || 'an Admin')}`;
  return send(to, `For your records: ${artist?.name || 'an artist'}'s deal or license updated`,
    page(`${artist?.name || 'An artist'}: deal or license updated`, [esc(what), `${who} on ${esc(String(item.approvedAt || '').slice(0, 10))}.`, 'It’s in Deal changes and the Activity log.'],
      { label: 'Open Deal changes', url: `${APP_URL}/` }));
}

// ---------- outgoing ----------
async function handleEvent(ev: Event) {
  const items = await section(ev.key);
  const item = items.find(x => x.id === ev.id);
  if (!item) return { skipped: 'not found' };
  const roster = await section('roster');
  setSwitch(ev.type === 'earnings' ? 'earnings' : ev.type === 'notice' ? 'notice' : ev.type === 'deal' ? 'dealLegal'
    : ev.type === 'repRelease' || ev.type === 'repInvoice' ? 'rep' : ev.type === 'statement' ? 'statement'
    : ev.key === 'invoices' ? (ev.type === 'stage' && ['Rejected', 'Needs changes', 'Paid'].includes(item.status) ? 'invoiceArtist' : 'invoiceTeam')
    : 'submissions');

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
      results.push(await sendOne([email], `Your IMSS Records earnings for ${list} are ready`,
        page('New earnings in your portal', [`Hi ${esc(a.name)},`, `Your earnings for <b>${esc(list)}</b> are now in your IMSS Records portal, with the breakdown by song, platform and country.`, LAG_NOTE],
          { label: 'See your earnings', url: `${APP_URL}/` }), undefined, 'earnings'));
    }
    return results;
  }

  // A noticeboard post: each person in its audience gets their own email (no
  // shared To: line) and a bell notification.
  if (ev.type === 'notice') {
    const staff = await section('staff');
    const aud = item.audience;
    const artists = roster.filter(a => a.status !== 'Archived' && (aud === 'all' || a.id === aud));
    const team = staff.filter(m => (m.status || 'Active') !== 'Inactive' && m.status !== 'Archived' && (aud === 'all-team' || m.id === aud));
    const results = [];
    for (const a of artists) {
      const email = lower(a.email);
      if (!email.includes('@')) continue;
      results.push(await sendOne([email], `Notice from IMSS Records: ${item.title}`,
        page(item.title || 'Notice from IMSS Records', [`Hi ${esc(a.name)},`, esc(item.message || '').replace(/\n/g, '<br>')], { label: 'Open your portal', url: `${APP_URL}/` }), undefined, 'notice'));
    }
    for (const m of team) {
      const email = lower(m.email);
      if (!email.includes('@')) continue;
      results.push(await sendOne([email], `Notice: ${item.title}`,
        page(item.title || 'Notice', [esc(item.message || '').replace(/\n/g, '<br>')], { label: 'Open the dashboard', url: `${APP_URL}/` })));
    }
    await audit('sent a notice', `"${item.title}" to ${artists.length + team.length} ${artists.length + team.length === 1 ? 'person' : 'people'}`);
    return results.length ? results : { skipped: 'no one in the audience has an email' };
  }

  // Admin or Legal sent a budget to the artist's dashboard: a bell notification, no email.
  if (ev.type === 'budgetSent') {
    if (item.kind !== 'artist') return { skipped: 'label budget' };
    const a = roster.find(r => r.id === item.artistId);
    const email = lower(a?.email);
    if (!email.includes('@')) return { skipped: 'no artist email' };
    return inAppOnly([email], `Your budget for ${item.title} is in your dashboard`);
  }

  // A PM confirmed a release for, or sent an invoice to, the artist's label rep.
  if (ev.type === 'repRelease' || ev.type === 'repInvoice') {
    const a = roster.find(r => r.id === item.artistId);
    const rep = (await section('staff')).find(m => a && m.id === a.labelRep && m.role === 'Label Rep' && m.status !== 'Archived');
    if (!rep || !lower(rep.email).includes('@')) return { skipped: 'no label rep' };
    const updated = ev.type === 'repRelease' && item.repFirstConfirmedAt && item.repFirstConfirmedAt !== item.repConfirmedAt;
    return ev.type === 'repRelease'
      ? send([lower(rep.email)], `${updated ? 'Release updated' : 'Release confirmed'}: “${item.title}” by ${a.name}`,
          page(`${updated ? 'Updated' : 'Confirmed'}: ${item.title}`, [`Hi ${esc(rep.name)},`, `IMSS Records ${updated ? 'updated the details of' : 'confirmed'} <b>${esc(item.title)}</b> by ${esc(a.name)}${item.releaseDate ? ', releasing <b>' + esc(item.releaseDate) + '</b>' : ''}.`, 'The full release sheet is in your Release schedule, ready to download.'], { label: 'Open Release schedule', url: `${APP_URL}/release-schedule` }))
      : send([lower(rep.email)], `Invoice sent to the partner: “${item.title}” (${a.name}, $${Number(item.amount || 0).toFixed(2)})`,
          page('An invoice for your records', [`Hi ${esc(rep.name)},`, `IMSS Records sent <b>${esc(item.title)}</b> for ${esc(a.name)}, <b>$${Number(item.amount || 0).toFixed(2)}</b>, to the partner.`, 'You can view it and download it in Invoices.'], { label: 'Open Invoices', url: `${APP_URL}/invoices` }));
  }

  // A deal or license change approved: Legal gets the record. Nothing goes to the artist.
  if (ev.type === 'deal') return recordForLegal(item, roster.find(r => r.id === item.artistId));

  // Admin or Legal pressed "Send to artist's dashboard": a portal notification, never an email.
  if (ev.type === 'dealSent') {
    const a = roster.find(r => r.id === item.artistId);
    const email = String(a?.email || '').trim();
    if (!email) return { skipped: 'no email for ' + item.artistId };
    const catalog = await section('catalog');
    const titles = (ids: string[]) => ids.map(id => (catalog.find(s => s.id === id) || {}).title).filter(Boolean).join(', ') || 'your songs';
    if (item.kind === 'rightsReturned') return inAppOnly([email], `Your rights to ${titles(item.releaseIds || [])} have returned to you from ${item.date}`);
    if (item.kind === 'licenseNotice') return inAppOnly([email], `License notice: ${titles([item.releaseId])} is licensed to IMSS Records until ${item.end}`);
    if (item.kind) return { skipped: 'not artist-facing' };
    const month = new Date(item.from + '-01T00:00:00Z').toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    return inAppOnly([email], `Your IMSS Records deal has been updated from ${month}`);
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
      page('Your royalty statement is ready', [`Hi ${esc(artistName)},`, `Your statement for <b>${esc(period)}</b> is ready in your IMSS Records portal.`, `Your earnings for this period: <b>$${Number(item.artistShare || 0).toFixed(2)}</b>.`, LAG_NOTE],
        { label: 'View your statement', url: `${APP_URL}/` }), undefined, 'statement');
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
          { label: 'Open your portal', url: `${APP_URL}/` }, item.reviewNote || last.note || undefined), replyKey, 'invoice');
    }
    if (item.status === 'Needs changes') {
      return send([artistEmail], `Your invoice “${item.title}” needs changes`,
        page('Your invoice needs changes', [`Hi ${esc(artistName)}, the label returned <b>${esc(item.title)}</b> (${amount}) so you can fix it.`, 'Open it in your portal, make the change and press Resubmit.'],
          { label: 'Open your portal', url: `${APP_URL}/invoices` }, item.reviewNote || last.note || undefined), replyKey, 'invoice');
    }
    if (item.status === 'Paid') {
      return send([artistEmail], `Paid: your invoice “${item.title}” (${amount})`,
        page('Your invoice has been paid', [`Hi ${esc(artistName)}, <b>${esc(item.title)}</b> for <b>${amount}</b> has been paid.`], { label: 'Open your portal', url: `${APP_URL}/` }), replyKey, 'invoice');
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
    if (labelText && ev.key !== 'invoices') return inAppOnly([artistEmail], `IMSS Records replied about ${what.replace('your ', '')}`);
    if (labelText) {
      setSwitch('invoiceArtist');
      return send([artistEmail], `IMSS Records replied about ${what.replace('your ', '')}`,
        page('The label replied', [`Hi ${esc(artistName)}, here’s a message about ${esc(what)}:`],
          { label: 'Open your portal', url: `${APP_URL}/` }, labelText), replyKey, 'invoice');
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
  const now = Date.now();
  let changed = 0;
  await changeSection('payouts', payouts => {
    changed = 0;
    const next = payouts.map(p => {
      if (!p.sentAt && p.scheduledFor && Date.parse(p.scheduledFor) <= now) { changed++; return { ...p, sentAt: new Date().toISOString() }; }
      return p;
    });
    return changed ? next : null;
  });
  if (changed) { await audit('sent statements (scheduled)', changed + ' statement' + (changed === 1 ? '' : 's') + ' reached their send time'); }

  // Scheduled publishes to artists: swap in the rows saved when it was scheduled.
  // Marking it Published fires the trigger that emails the artists.
  const { data: publishSections, error: readError } = await db.from('app_data')
    .select('key, value, updated_at').in('key', ['publishedRevenue', 'revenuePublish']);
  if (readError) throw readError;
  const logSection = publishSections?.find(s => s.key === 'revenuePublish');
  const revenueSection = publishSections?.find(s => s.key === 'publishedRevenue');
  if (!logSection || !revenueSection) throw new Error('Publish sections are missing');
  const log: Item[] = Array.isArray(logSection.value) ? logSection.value : [];
  const due = log.filter(e => e.status === 'Scheduled' && e.scheduledFor && Date.parse(e.scheduledFor) <= now);
  if (due.length) {
    const at = new Date().toISOString();
    let published: Item[] = Array.isArray(revenueSection.value) ? revenueSection.value : [];
    for (const e of due) {
      const keys = new Set((e.items || []).map((i: Item) => i.key));
      published = [...published.filter(r => !keys.has(r.artistSlug + '|' + r.month)), ...(e.rows || []).map((r: Item) => ({ ...r, publishedAt: at }))];
    }
    const ids = new Set(due.map(e => e.id));
    const { error: saveError } = await db.rpc('save_app_data_pair', {
      first_key: 'publishedRevenue', first_value: published, first_version: revenueSection.updated_at,
      second_key: 'revenuePublish', second_value: log.map(e => ids.has(e.id) ? { ...e, status: 'Published', approvedAt: e.approvedAt || at, publishedAt: at, rows: undefined } : e),
      second_version: logSection.updated_at,
    });
    if (saveError) throw saveError;
    for (const e of due) await audit('published to artists (scheduled)', (e.items || []).map((i: Item) => i.artist + ' ' + i.month).join(', '));
  }
  return { sent: changed, published: due.length };
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

  await changeSection(key, latest => latest.map(x => x.id !== id ? x : {
    ...x,
    messages: [...(Array.isArray(x.messages) ? x.messages : []), msg],
    ...(key === 'releaseSubmissions' && msg.from === 'artist' && x.status === 'Needs info' ? { status: 'Pending' } : {}),
  }));
  return { added: msg.from };
}

// Monday of release week (cron "release-week"): every release out this week
// (Monday to Sunday, UTC) gets an email to the artist to check everything is
// ready, and one to their PM to keep tabs on it.
async function sendReleaseWeek() {
  const [catalog, roster, staff] = await Promise.all([section('catalog'), section('roster'), section('staff')]);
  const now = new Date();
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - ((now.getUTCDay() + 6) % 7)));
  const sunday = new Date(monday.getTime() + 6 * 86400000);
  const from = monday.toISOString().slice(0, 10), to = sunday.toISOString().slice(0, 10);
  const due = catalog.filter(r => r.releaseDate && r.releaseDate >= from && r.releaseDate <= to && r.status !== 'Archived');
  const day = (d: string) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
  const results = [];
  for (const r of due) {
    const a = roster.find(x => x.id === r.artistId && x.status !== 'Archived');
    if (!a) { results.push({ skipped: 'no artist for ' + r.id }); continue; }
    const pm = staff.find(m => a.productManager && lower(m.name) === lower(a.productManager) && m.status !== 'Archived');
    const list = Array.isArray(r.checklist) ? r.checklist : [];
    const open = list.filter((t: Item) => !t.done).map((t: Item) => esc(t.label || t.task || ''));
    const checklist = list.length ? (open.length ? `Still open on the release checklist: ${open.slice(0, 6).join(', ')}${open.length > 6 ? '…' : ''}.` : 'Everything on the release checklist is ticked.') : '';
    const when = day(r.releaseDate);
    if (lower(a.email).includes('@')) {
      results.push(await sendOne([lower(a.email)], `Release week: “${r.title}” is out ${when}`,
        page(`“${r.title}” is out this week`, [
          `Hi ${esc(a.name)},`,
          `Your release <b>${esc(r.title)}</b> is out on <b>${esc(when)}</b>. Please check everything is ready: artwork, credits, links and anything you're posting.`,
          ...(checklist ? [checklist] : []),
          pm ? `Keep in touch with your Product Manager, <b>${esc(pm.name)}</b>, this week about anything that's not ready.` : 'Reply to the label this week about anything that\'s not ready.',
        ], { label: 'Open your portal', url: `${APP_URL}/releases` }), undefined, 'release'));
    }
    if (pm && lower(pm.email).includes('@')) {
      results.push(await sendOne([lower(pm.email)], `Release week: “${r.title}” by ${a.name}, ${when}`,
        page(`Release week: ${r.title}`, [`<b>${esc(r.title)}</b> by ${esc(a.name)} is out on <b>${esc(when)}</b>. ${esc(a.name)} has been asked to check everything is ready and keep in touch with you.`, ...(checklist ? [checklist] : [])],
          { label: 'Open the release', url: `${APP_URL}/catalog` })));
    }
  }
  if (due.length) await audit('sent release-week emails', due.map(r => r.title + ' (' + r.releaseDate + ')').join(', '));
  return { week: from + ' to ' + to, releases: due.length, results };
}

// A label rep asked for release sheets by email (rep_email_releases, which
// checks the releases are theirs). Only ever sent to that rep's own address.
const SHEET_HEADERS = ['Song Title', 'Primary Artist(s)', 'Featured Artist(s)', 'Release Type', 'Release Date', 'ISRC', 'UPC', 'Label', '℗ Line', 'Genre', 'Explicit/Clean', 'Duration', 'Written By (Songwriters)', 'Produced By', 'Collaborators & Splits', 'Recording Engineer', 'Mixing Engineer', 'Mastering Engineer', 'Dolby Atmos', 'Dolby Atmos Engineer', 'Lyrics', 'Music Video', 'Status', 'Primary Market', 'Secondary Market'];
function sheetRow(r: Item, artist: Item = {}) {
  const cr = r.credits || {}, collabs: Item[] = r.collaborators || [], label = r.label || 'IMSS Records';
  return [
    r.title, [artist.name, ...(r.primaryArtists || [])].filter(Boolean).join(' & '),
    collabs.filter(c => c.role === 'Feature').map(c => c.name).join(', '),
    r.type || '', r.releaseDate || '', r.isrc || '', r.upc || '', label,
    r.releaseDate ? '℗ ' + String(r.releaseDate).slice(0, 4) + ' ' + label : '',
    r.genre || artist.genre || '', r.explicit && r.explicit !== 'Not Set' ? r.explicit : '', r.duration || '',
    cr.writtenBy || '', cr.producedBy || collabs.filter(c => c.role === 'Producer').map(c => c.name).join(', '),
    collabs.map(c => c.name + ' (' + c.role + ', ' + c.splitPercent + '%)').join('; '),
    cr.recordingEngineer || '', cr.mixingEngineer || '', cr.masteringEngineer || '',
    r.dolbyAtmos ? 'Yes' : 'No', cr.dolbyEngineer || '', r.lyrics || '', r.hasVideo ? 'Yes' : 'No',
    r.status || '', r.primaryMarket || '', r.secondaryMarket || '',
  ].map(v => String(v ?? ''));
}
const b64 = (text: string) => { const bytes = new TextEncoder().encode(text); let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(bin); };
async function sendReleaseSheet(repId: string, ids: string[]) {
  const [staff, roster, catalog] = await Promise.all([section('staff'), section('roster'), section('catalog')]);
  const rep = staff.find(m => m.id === repId && m.role === 'Label Rep' && m.status !== 'Archived');
  if (!rep || !lower(rep.email).includes('@')) return { skipped: 'no rep email' };
  const mine = new Set(roster.filter(a => a.labelRep === repId).map(a => a.id));
  const rels = catalog.filter(r => ids.includes(r.id) && mine.has(r.artistId) && r.repConfirmedAt);
  if (!rels.length) return { skipped: 'no releases' };
  const rows = rels.map(r => sheetRow(r, roster.find(a => a.id === r.artistId) || {}));
  const tables = rows.map(v => `<p style="margin:18px 0 6px;font-weight:700;font-size:17px;color:#1d1d1f">${esc(v[0])} · ${esc(v[1])}</p><table role="presentation" style="border-collapse:collapse;width:100%;font-size:14px">${SHEET_HEADERS.map((h, i) => v[i] ? `<tr><td style="padding:5px 8px 5px 0;color:#6e6e73;vertical-align:top;width:40%">${esc(h)}</td><td style="padding:5px 0;color:#1d1d1f;vertical-align:top">${esc(v[i]).replace(/\n/g, '<br>')}</td></tr>` : '').join('')}</table>`).join('');
  const doc = `<html><head><meta charset="utf-8"><title>IMSS Records releases</title></head><body style="font-family:Arial"><img src="${APP_URL}/email-logo-dark.png" width="88" height="40" alt="IMSS Records" style="display:block;margin:0 0 12pt">${rows.map(v => `<h2>${esc(v[0])}</h2><table style="border-collapse:collapse;width:100%">${SHEET_HEADERS.map((h, i) => v[i] ? `<tr><td style="border:1px solid #ccc;padding:4pt 6pt;width:34%;color:#555">${esc(h)}</td><td style="border:1px solid #ccc;padding:4pt 6pt">${esc(v[i])}</td></tr>` : '').join('')}</table>`).join('')}</body></html>`;
  const csvCell = (x: string) => /[",\n]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x;
  const csv = [SHEET_HEADERS, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n');
  const date = new Date().toISOString().slice(0, 10);
  const subject = rels.length === 1 ? `Release sheet: “${rels[0].title}”` : `Release sheets: ${rels.length} releases`;
  const html = page(subject, [`Hi ${esc(rep.name)},`, `Here ${rels.length === 1 ? 'is the release you asked for' : 'are the ' + rels.length + ' releases you asked for'}. The release sheet is attached as a Word file and a CSV (opens in Excel).`, tables], { label: 'Open Release schedule', url: `${APP_URL}/release-schedule` });
  return await send([lower(rep.email)], subject, html, undefined, undefined, false, [
    { filename: `imss-releases-${date}.doc`, content: b64('\ufeff' + doc) },
    { filename: `imss-releases-${date}.csv`, content: b64('\ufeff' + csv) },
  ]);
}

// Admin pressed "Send welcome email" on the artist's page (send_portal_welcome).
async function sendWelcome(artistId: string) {
  const a = (await section('roster')).find(x => x.id === artistId);
  const email = lower(a?.email);
  if (!a || a.status === 'Archived' || !email.includes('@')) return { skipped: 'no artist email' };
  const html = page('Your artist portal is ready', [
    `Hi ${esc(a.name)},`,
    'Your IMSS Records artist portal is where you see your royalties, statements, releases and invoices.',
    `Sign in at <b>artist.imssrecords.com</b> with this email address (${esc(email)}): continue with Google, or ask for a sign-in code by email.`,
    'For the best experience, use a desktop or laptop. Your phone works too for quick checks.',
  ], { label: 'Open your portal', url: ARTIST_URL });
  return await send([email], 'Welcome to your IMSS Records artist portal', html, undefined, 'welcome');
}

// Admin pressed "Send welcome email" for a team member or label rep (send_team_welcome).
async function sendTeamWelcome(staffId: string) {
  const m = (await section('staff')).find(x => x.id === staffId);
  const email = lower(m?.email);
  if (!m || m.status === 'Archived' || !email.includes('@')) return { skipped: 'no email' };
  const rep = m.role === 'Label Rep';
  const html = page(rep ? 'You’re invited to IMSS Records' : 'Welcome to the IMSS Records team', [
    `Hi ${esc(m.name)},`,
    rep ? 'IMSS Records has set you up as a label rep. You’ll see the release schedule for your artists, with release sheets to download, and the invoices we send you to settle.'
        : `You’ve been added to the IMSS Records label dashboard as <b>${esc(m.role || 'a team member')}</b>.`,
    `Sign in at <b>ops.imssrecords.com</b> with this email address (${esc(email)}): continue with Google, or ask for a sign-in code by email. The first time, you’ll add a passkey or an authenticator app for a second step.`,
  ], { label: 'Sign in', url: `${APP_URL}/` });
  return await send([email], rep ? 'You’re invited to IMSS Records' : 'Welcome to the IMSS Records team', html);
}

// "New sign-in" email to the person who just signed in (private.signin_alert).
// Only people on the Team list or a Roster entry; nobody else can sign in anyway.
function deviceName(ua: string) {
  const os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Mac OS X|Macintosh/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : '';
  const browser = /Edg\//.test(ua) ? 'Edge' : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /FxiOS|Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : '';
  return [browser, os].filter(Boolean).join(' on ') || 'an unknown device';
}
async function sendSigninNotice(email: string, ua: string) {
  if (!email.includes('@')) return { skipped: 'no email' };
  const [staff, roster] = await Promise.all([section('staff'), section('roster')]);
  const member = staff.find(m => lower(m.email) === email && m.status !== 'Archived');
  const artist = !member && roster.find(a => lower(a.email) === email && a.status !== 'Archived');
  if (!member && !artist) return { skipped: 'not on the Team list or Roster' };
  const when = new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }) + ' UTC';
  const who = member ? member.name : (artist as Item).name;
  const help = member ? 'tell an Admin straight away so they can sign you out everywhere and secure your account.' : 'contact your Product Manager straight away so they can sign you out everywhere and secure your account.';
  const html = page('New sign-in to IMSS Records', [
    `Hi ${esc(who)},`,
    `Your account was signed in on <b>${esc(when)}</b> from <b>${esc(deviceName(ua))}</b>.`,
    `If this was you, there's nothing to do. <b>If it wasn't you</b>, ${help} Also change the password of the email account you sign in with.`,
  ], { label: member ? 'Open the dashboard' : 'Open your portal', url: `${APP_URL}/` });
  return await send([email], 'New sign-in to your IMSS Records account', html, undefined, artist ? 'security' : undefined, false);
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
    return await requestState.run({ switchKey: '', switches: null }, () => handleAction(body));
  } catch (e) {
    return new Response(String(e), { status: 500 });
  }
});

async function handleAction(body: Item): Promise<Response> {
  {
    setSwitch(({ releaseWeek: 'releaseWeek', welcome: 'welcome', teamWelcome: 'welcome', signinNotice: 'signin', signinAlert: 'signinAlert' } as Record<string, string>)[body.action] || '');
    if (body.action === 'due') return Response.json(await sendDueStatements());
    if (body.action === 'signinNotice') return Response.json(await sendSigninNotice(lower(body.email), String(body.device || '')));
    if (body.action === 'signinAlert') {
      // A watched account signed in (private.signin_alert): tell every Admin.
      const admins = (await section('staff')).filter(m => m.role === 'Admin' && m.status !== 'Archived').map(m => lower(m.email)).filter(e => e.includes('@'));
      const label = String(body.label || 'A watched account').slice(0, 120);
      const when = new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }) + ' UTC';
      return Response.json(await send(admins, `${label} signed in`, page(`${label} signed in`, [`They signed in to IMSS Records at <b>${esc(when)}</b>.`, 'You asked to be told when this account signs in.'], { label: 'Open the dashboard', url: `${APP_URL}/` })));
    }
    if (body.action === 'releaseWeek') return Response.json(await sendReleaseWeek());
    if (body.action === 'repReleaseSheet') return Response.json(await sendReleaseSheet(String(body.repId || ''), Array.isArray(body.ids) ? body.ids.map(String) : []));
    if (body.action === 'teamWelcome') return Response.json(await sendTeamWelcome(String(body.staffId || '')));
    if (body.action === 'welcome') return Response.json(await sendWelcome(String(body.artistId || '')));
    if (body.action === 'events') return Response.json(await handleEvents(body));
    return new Response('unknown action', { status: 400 });
  }
}

// A batch of change events from the database. With a delivery id (recorded in
// private.email_deliveries) each event is done once: the batch is claimed so two
// posts can't both send it, finished events are marked, and the rest are retried.
async function handleEvents(body: Item) {
  const events = (body.events || []) as Event[];
  if (!body.delivery) {
    const results = [];
    for (const ev of events) results.push(await handleEvent(ev).catch(e => ({ error: String(e) })));
    return results;
  }
  const id = Number(body.delivery);
  const { data: claim, error: claimError } = await db.rpc('delivery_claim', { delivery_id: id });
  if (claimError) throw claimError;
  if (!claim) return { skipped: 'delivery already handled or in progress' };
  const done = new Set<number>((claim.done || []) as number[]);
  const sent = new Set<string>((claim.sent || []) as string[]);
  const results: unknown[] = [];
  const errors: string[] = [];
  for (let i = 0; i < events.length; i++) {
    if (done.has(i)) { results.push({ skipped: 'already sent' }); continue; }
    setSwitch('');
    const d: Delivery = { id, event: i, sent, failed: false };
    state().delivery = d;
    try {
      const r = await handleEvent(events[i]);
      results.push(r);
      // Some of its emails failed (the rest were recorded): keep it open for a retry.
      if (d.failed) { errors.push(`event ${i}: some emails failed`); continue; }
      const { error } = await db.rpc('delivery_event_done', { delivery_id: id, idx: i });
      if (error) throw error;
    } catch (e) {
      errors.push(`event ${i}: ${String(e)}`);
      results.push({ error: String(e) });
    } finally {
      state().delivery = undefined;
    }
  }
  const { data: status } = await db.rpc('delivery_finish', { delivery_id: id, err: errors.join('; ').slice(0, 1000) || null });
  if (status === 'failed') await audit('gave up sending an email', errors.join('; ').slice(0, 300));
  return { delivery: id, status, results };
}

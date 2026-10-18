import { CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Eye, FileText, MessageSquare, Send, UserCog, Wallet } from 'lucide-react';
import { logActivity } from '../audit.js';
import { BUDGET_TYPES, catLabel, categoryChoices } from './Budget.jsx';
import React, { useState } from 'react';
import { formatCents, formatCurrency, formatDate } from '../constants.js';
import { C, MONO_FONT } from '../theme.js';
import { Badge, Btn, EmptyState, Field, KPICard, SectionHeader, Select, Td, TextArea, Th, DocLink } from '../ui.jsx';

export const INVOICE_KINDS = { expense: 'Expense claim', service: 'Services / fee' };
// Invoice approval pipeline: Submitted → PM Approval → Finance Queue → LH Queue →
// DP Queue → Pay Approved → Paid. Each waiting status names who reviews it.
export const INVOICE_STAGES = [
  { status: 'PM Approval', who: 'pm', approve: 'Approve' },
  { status: 'Finance Queue', who: 'finance', approve: 'Approve' },
  { status: 'LH Queue', who: 'lh', approve: 'Approve' },
  { status: 'DP Queue', who: 'dp', approve: 'Approve for payment' },
  { status: 'Pay Approved', who: 'pay', approve: 'Mark paid' },
];
export const INVOICE_FLOW = ['Submitted', ...INVOICE_STAGES.map(st => st.status), 'Paid'];
export const WORKFLOW_ROLES = [
  { key: 'finance', label: 'Finance Queue' },
  { key: 'lh', label: 'LH Queue' },
  { key: 'dp', label: 'DP Queue' },
  { key: 'pay', label: 'Pay Approved', hint: 'pays the artist and marks it paid' },
];
// Older invoices used Pending / Approved.
export function invoiceStatus(inv) {
  if (inv.status === 'Pending') return 'PM Approval';
  if (inv.status === 'Approved') return 'Pay Approved';
  return inv.status;
}
export const invoiceStage = inv => INVOICE_STAGES.find(st => st.status === invoiceStatus(inv)) || null;
export function invoiceReviewers(inv, roster, staff, workflow) {
  const stage = invoiceStage(inv);
  if (!stage) return [];
  if (stage.who === 'pm') {
    const pm = String((roster.find(a => a.id === inv.artistId) || {}).productManager || '').trim().toLowerCase();
    return staff.filter(m => pm && m.name.trim().toLowerCase() === pm);
  }
  const ids = (workflow || {})[stage.who] || [];
  return staff.filter(m => ids.includes(m.id));
}
// What the artist sees: progress, not internal queue names.
export function artistInvoiceStatus(inv) {
  const st = invoiceStatus(inv);
  if (st === 'Paid' || st === 'Rejected') return st;
  if (st === 'Needs changes') return 'Needs your changes';
  if (st === 'Pay Approved') return 'Approved for payment';
  const step = INVOICE_FLOW.indexOf(st);
  return step > 0 ? 'In review · step ' + (step + 1) + ' of ' + INVOICE_FLOW.length : 'Submitted';
}
export const INVOICE_TONES = { 'PM Approval': 'amber', 'Finance Queue': 'amber', 'LH Queue': 'amber', 'DP Queue': 'amber', 'Pay Approved': 'teal', Paid: 'teal', Rejected: 'red', 'Needs changes': 'red', Pending: 'amber', Approved: 'teal' };

// Messages between the label and the artist on one invoice (in app or by email).
export function InvoiceThread({ inv, artistLabel }) {
  const msgs = inv.messages || [];
  if (!msgs.length) return <div className="text-sm" style={{ color: C.textDim }}>No messages yet.</div>;
  return (
    <ol className="imss-thread">
      {msgs.map((m, i) => (
        <li key={i} className={m.from === 'artist' ? 'is-artist' : 'is-label'}>
          <div className="imss-thread-meta">{m.from === 'artist' ? (m.by || artistLabel) : (m.by || 'Label')} · {formatDate(String(m.at || '').slice(0, 10))}{m.via === 'email' ? ' · by email' : ''}</div>
          <div style={{ whiteSpace: 'pre-wrap' }}>{m.text}</div>
        </li>
      ))}
    </ol>
  );
}

export function InvoicesSection({ invoices, update, roster, staff = [], labelSettings = {}, updateLabelSettings, canEdit = true, session = {}, pmScope = null, overheads = [], ledger = [], approver = false }) {
  const workflow = labelSettings.invoiceWorkflow || {};
  const isAdmin = session.role === 'Admin';
  const me = staff.find(m => m.name === session.name);
  const assignedSomewhere = !!me && Object.values(workflow).some(ids => (ids || []).includes(me.id));
  const [tab, setTab] = useState('all');
  const [openId, setOpenId] = useState(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [showWorkflow, setShowWorkflow] = useState(false);
  const [message, setMessage] = useState('');
  const [moveTo, setMoveTo] = useState('');
  const [returnNote, setReturnNote] = useState('');
  const [fixing, setFixing] = useState(null); // { id, ...fields } while correcting an invoice
  // The artist's PM corrects or returns an invoice up to Pay Approved; an Admin at any stage before Paid.
  const canFix = inv => canEdit && !['Paid', 'Rejected', 'Needs changes'].includes(invoiceStatus(inv))
    && (isAdmin || (pmOf(inv) && pmOf(inv) === session.name && invoiceStatus(inv) !== 'Pay Approved'));
  const FIX_FIELDS = [['budgetCategory', 'What it’s for'], ['title', 'Description'], ['amount', 'Amount'], ['invoiceDate', 'Invoice date'], ['invoiceNumber', 'Invoice number'], ['payTo', 'Pay to'], ['details', 'Details']];
  function saveFix(inv) {
    const amount = Math.round(parseFloat(fixing.amount) * 100) / 100;
    if (!String(fixing.title).trim()) { setError('The description can’t be empty.'); return; }
    if (!(amount > 0)) { setError('Enter a valid amount.'); return; }
    const [bt, bn] = String(fixing.budgetCategory || '').split('|');
    const next = { ...fixing, amount, title: String(fixing.title).trim(), category: !fixing.budgetCategory ? (inv.category || '') : bt === 'Other' ? 'Other' : bt + ' · ' + bn };
    const diffs = FIX_FIELDS.filter(([k]) => String(inv[k] ?? '') !== String(next[k] ?? '')).map(([k, label]) => label + (k === 'amount' ? ' $' + Number(inv.amount || 0).toFixed(2) + ' → $' + amount.toFixed(2) : ' changed'));
    if (!diffs.length) { setFixing(null); return; }
    const entry = { at: new Date().toISOString(), by: session.name, action: 'corrected', from: invoiceStatus(inv), to: invoiceStatus(inv), note: diffs.join('; ') + (fixing.why ? ' (' + fixing.why + ')' : '') };
    logActivity('corrected an invoice', inv.title + ': ' + entry.note, inv.artistId);
    update(invoices.map(i => i.id !== inv.id ? i : { ...i, ...Object.fromEntries(FIX_FIELDS.map(([k]) => [k, next[k]])), category: next.category, correctedNote: entry.note, history: [...(i.history || []), entry] }));
    setFixing(null); setError('');
  }
  function returnToArtist(inv) {
    const text = returnNote.trim();
    if (!text) { setError('Say what the artist needs to fix. They see this.'); return; }
    const entry = { at: new Date().toISOString(), by: session.name, action: 'returned to artist', from: invoiceStatus(inv), to: 'Needs changes', note: text };
    logActivity('returned an invoice to the artist', inv.title + ': ' + text, inv.artistId);
    update(invoices.map(i => i.id !== inv.id ? i : { ...i, status: 'Needs changes', reviewNote: text, history: [...(i.history || []), entry] }));
    setReturnNote(''); setError('');
  }
  const artistName = id => (roster.find(a => a.id === id) || {}).name || 'Unknown artist';
  const scoped = invoices.filter(i => !pmScope || assignedSomewhere || (roster.find(a => a.id === i.artistId) || {}).productManager === pmScope);
  const pmOf = inv => (roster.find(a => a.id === inv.artistId) || {}).productManager || '';
  const reviewersOf = inv => invoiceReviewers(inv, roster, staff, workflow);
  const canAct = inv => canEdit && !!invoiceStage(inv) && (isAdmin || reviewersOf(inv).some(m => me && m.id === me.id));
  // Admins can approve at PM Approval too, so those also sit in an Admin's queue.
  const mine = scoped.filter(i => invoiceStage(i) && me && (reviewersOf(i).some(m => m.id === me.id) || (isAdmin && invoiceStage(i).who === 'pm')));
  const shown = (tab === 'mine' ? mine : tab === 'all' ? scoped : scoped.filter(i => invoiceStatus(i) === tab))
    .sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''));
  const sumBy = st => scoped.filter(i => invoiceStatus(i) === st).reduce((t, i) => t + (Number(i.amount) || 0), 0);
  const inReview = scoped.filter(i => invoiceStage(i) && invoiceStatus(i) !== 'Pay Approved');

  function move(inv, action) {
    const from = invoiceStatus(inv);
    const idx = INVOICE_STAGES.findIndex(st => st.status === from);
    const text = note.trim();
    if ((action === 'back' || action === 'reject') && !text) { setError(action === 'reject' ? 'Say why it’s rejected. The artist sees this.' : 'Say what needs changing before it comes back.'); return; }
    const to = action === 'approve' ? (INVOICE_STAGES[idx + 1] ? INVOICE_STAGES[idx + 1].status : 'Paid') : action === 'back' ? INVOICE_STAGES[idx - 1].status : 'Rejected';
    const stamp = new Date().toISOString();
    const entry = { at: stamp, by: session.name, action: action === 'approve' ? (to === 'Paid' ? 'paid' : 'approved') : action === 'back' ? 'sent back' : 'rejected', from, to, note: text };
    logActivity('invoice ' + entry.action, inv.title + ' · ' + from + ' → ' + to, inv.artistId);
    update(invoices.map(i => i.id !== inv.id ? i : {
      ...i, status: to, history: [...(i.history || []), entry],
      reviewedBy: session.name, reviewedAt: stamp,
      ...(action === 'reject' ? { reviewNote: text } : {}),
      ...(to === 'Paid' ? { paidAt: stamp } : {}),
    }));
    setNote(''); setError('');
  }
  // Admin override: put an invoice straight into any queue when the people
  // assigned to it aren't available. Logged in history like any other move.
  function adminMove(inv) {
    const from = invoiceStatus(inv);
    if (!moveTo || moveTo === from) return;
    const stamp = new Date().toISOString();
    const entry = { at: stamp, by: session.name, action: 'moved by Admin', from, to: moveTo, note: note.trim() };
    logActivity('invoice moved by Admin', inv.title + ' · ' + from + ' → ' + moveTo, inv.artistId);
    update(invoices.map(i => i.id !== inv.id ? i : {
      ...i, status: moveTo, history: [...(i.history || []), entry], reviewedBy: session.name, reviewedAt: stamp,
      ...(moveTo === 'Paid' ? { paidAt: stamp } : {}),
    }));
    setMoveTo(''); setNote(''); setError('');
  }
  function sendMessage(inv) {
    const text = message.trim();
    if (!text) return;
    update(invoices.map(i => i.id !== inv.id ? i : { ...i, messages: [...(i.messages || []), { from: 'label', by: session.name, at: new Date().toISOString(), text }] }));
    setMessage('');
  }
  function toggleAssignee(key, id) {
    const cur = workflow[key] || [];
    const next = { ...workflow, [key]: cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id] };
    updateLabelSettings({ ...labelSettings, invoiceWorkflow: next });
  }
  const tabs = [['all', 'All', scoped.length], ['mine', 'My queue', mine.length], ...INVOICE_STAGES.map(st => [st.status, st.status, scoped.filter(i => invoiceStatus(i) === st.status).length]), ['Needs changes', 'Needs changes', scoped.filter(i => i.status === 'Needs changes').length], ['Paid', 'Paid', 0], ['Rejected', 'Rejected', 0]];
  const activeStaff = staff.filter(m => (m.status || 'Active') !== 'Inactive');

  return (
    <div>
      <SectionHeader title="Invoices" artistNote="their own invoices with simple progress (In review, Approved for payment, Paid, Rejected), the rejection reason, and messages. Never the internal queue names or who holds it." description="Artist expense claims and service invoices move through PM Approval, Finance, LH and DP before they’re approved for payment and paid."
        action={isAdmin && <Btn variant="ghost" onClick={() => setShowWorkflow(v => !v)}><UserCog size={14} /> {showWorkflow ? 'Close workflow' : 'Workflow'}</Btn>} />

      {isAdmin && showWorkflow && (
        <section aria-labelledby="wf-h" className="rounded border p-4 mb-6" style={{ background: C.panel, borderColor: C.borderLight }}>
          <h2 id="wf-h" style={{ fontWeight: 600, fontSize: 15 }}>Who handles each queue</h2>
          <p className="text-xs mt-1 mb-4" style={{ color: C.textDim }}>PM Approval goes to the artist’s Product Manager (set on the Roster) and to Admins, so either can approve it. Pick one or more people for the other queues; they get an email when an invoice reaches them. Admins can act on any queue.</p>
          <div className="imss-wf-grid">
            {WORKFLOW_ROLES.map(r => (
              <fieldset key={r.key} className="rounded border p-3" style={{ borderColor: C.border }}>
                <legend className="text-sm px-1" style={{ fontWeight: 600 }}>{r.label}</legend>
                {r.hint && <div className="text-xs mb-2" style={{ color: C.textDim }}>{r.hint}</div>}
                <div className="flex flex-col gap-1.5">
                  {activeStaff.map(m => (
                    <label key={m.id} className="flex items-center gap-2 text-sm" style={{ cursor: 'pointer' }}>
                      <input type="checkbox" checked={(workflow[r.key] || []).includes(m.id)} onChange={() => toggleAssignee(r.key, m.id)} style={{ accentColor: C.amber }} />
                      {m.name} <span className="text-xs" style={{ color: C.textDim }}>{m.role}</span>
                    </label>
                  ))}
                </div>
                {!(workflow[r.key] || []).length && <div className="text-xs mt-2" style={{ color: C.amber }}>No one assigned yet. Only Admins can move invoices on.</div>}
              </fieldset>
            ))}
          </div>
        </section>
      )}

      <div className="flex flex-wrap gap-3 mb-6">
        <KPICard icon={FileText} label="In review" value={formatCurrency(inReview.reduce((t, i) => t + (Number(i.amount) || 0), 0))} tone="amber" sub={inReview.length + ' invoice' + (inReview.length === 1 ? '' : 's')} />
        <KPICard icon={Wallet} label="Approved, not yet paid" value={formatCurrency(sumBy('Pay Approved'))} />
        <KPICard icon={CheckCircle2} label="Paid" value={formatCurrency(sumBy('Paid'))} tone="teal" />
      </div>

      <div className="flex gap-1 mb-4 flex-wrap" role="tablist" aria-label="Queues">
        {tabs.map(([id, label, n]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => { setTab(id); setOpenId(null); }} className="text-sm px-3 py-1.5 rounded inline-flex items-center gap-1.5"
            style={{ background: tab === id ? C.amberSoft : 'transparent', color: tab === id ? C.amber : C.textDim, border: '1px solid ' + (tab === id ? 'transparent' : C.border), fontWeight: tab === id ? 600 : 500 }}>
            {label}{n > 0 && <span style={{ fontFamily: MONO_FONT, fontSize: 12 }}>{n}</span>}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <EmptyState icon={FileText} title={tab === 'mine' ? 'Nothing waiting for you' : 'Nothing here'} description={tab === 'mine' ? 'Invoices assigned to you show up here when they reach your queue.' : 'When artists submit expense claims or service invoices, they move through these queues.'} />
      ) : (
        <div className="rounded border overflow-x-auto" style={{ borderColor: C.border, background: C.panel }}>
          <table className="w-full" style={{ minWidth: 860 }}>
            <thead><tr><Th>Submitted</Th><Th>Artist</Th><Th>PM</Th><Th>Type</Th><Th>Description</Th><Th align="right">Amount</Th><Th>Stage</Th><Th>With</Th><Th align="right"><span className="sr-only">Actions</span></Th></tr></thead>
            <tbody>
              {shown.map(inv => {
                const st = invoiceStatus(inv), stage = invoiceStage(inv), reviewers = reviewersOf(inv), isOpen = openId === inv.id, idx = INVOICE_STAGES.findIndex(x => x.status === st);
                return (
                  <React.Fragment key={inv.id}>
                    <tr data-focus={inv.id}>
                      <Td mono>{formatDate((inv.submittedAt || '').slice(0, 10))}</Td>
                      <Td>{artistName(inv.artistId)}</Td>
                      <Td>{pmOf(inv) || <span style={{ color: C.amber }}>No PM set</span>}</Td>
                      <Td>{INVOICE_KINDS[inv.kind] || inv.kind}</Td>
                      <Td>{inv.title}{inv.category ? <div className="text-xs mt-0.5" style={{ color: C.textDim }}>{inv.category}</div> : null}</Td>
                      <Td align="right" mono>{formatCents(inv.amount)}</Td>
                      <Td><Badge tone={INVOICE_TONES[st]}>{st}</Badge></Td>
                      <Td>{stage ? (reviewers.length ? reviewers.map(m => m.name).join(', ') : <span style={{ color: C.amber }}>Unassigned</span>) : '—'}</Td>
                      <Td align="right"><Btn variant={!isOpen && canAct(inv) ? 'primary' : 'ghost'} onClick={() => { setOpenId(isOpen ? null : inv.id); setNote(''); setMessage(''); setMoveTo(''); setError(''); }}>{isOpen ? <><ChevronDown size={14} /> Close</> : canAct(inv) ? <><CheckCircle2 size={14} /> Review</> : <><Eye size={14} /> View</>}</Btn></Td>
                    </tr>
                    {isOpen && (
                      <tr><td colSpan={9} style={{ padding: 0, borderBottom: '1px solid ' + C.border }}>
                        <div className="imss-sub-review">
                          <section className="imss-sub-wide" style={{ borderTop: 'none', paddingTop: 0 }}>
                            <ol className="imss-steps" aria-label="Approval progress">
                              {INVOICE_FLOW.map((step, i) => {
                                const cur = INVOICE_FLOW.indexOf(st);
                                const state = st === 'Rejected' ? (i === 0 ? 'done' : 'todo') : i < cur || st === 'Paid' ? 'done' : i === cur ? 'current' : 'todo';
                                return <li key={step} className={'is-' + state} aria-current={state === 'current' ? 'step' : undefined}><span className="imss-step-dot" aria-hidden="true">{state === 'done' ? <CheckCircle2 size={14} /> : i + 1}</span><span>{step}</span></li>;
                              })}
                            </ol>
                            {st === 'Rejected' && <div className="text-sm mt-2" style={{ color: C.red }}>Rejected{inv.reviewedBy ? ' by ' + inv.reviewedBy : ''}: {inv.reviewNote}</div>}
                          </section>
                          <section>
                            <h3 className="imss-sub-h">Invoice</h3>
                            <dl className="imss-sub-dl">
                              <dt>Artist</dt><dd>{artistName(inv.artistId)}</dd>
                              <dt>Product Manager</dt><dd>{pmOf(inv) || <span style={{ color: C.amber }}>None set on the Roster</span>}</dd>
                              <dt>Type</dt><dd>{INVOICE_KINDS[inv.kind] || inv.kind}</dd>
                              <dt>Amount</dt><dd style={{ fontFamily: MONO_FONT }}>{formatCents(inv.amount)}</dd>
                              <dt>Invoice date</dt><dd>{formatDate(inv.invoiceDate)}</dd>
                              <dt>Invoice no.</dt><dd>{inv.invoiceNumber || '—'}</dd>
                              <dt>Pay to</dt><dd>{inv.payTo || '—'}</dd>
                              <dt>Details</dt><dd style={{ whiteSpace: 'pre-wrap' }}>{inv.details || '—'}</dd>
                              <dt>File</dt><dd>{inv.attachment ? <DocLink value={inv.attachment} name={inv.attachmentName || 'invoice'}>Download {inv.attachmentName || 'file'}</DocLink> : '—'}</dd>
                            </dl>
                          </section>
                          <section>
                            <h3 className="imss-sub-h">History</h3>
                            <ol className="imss-history">
                              <li><b>Submitted</b> by {artistName(inv.artistId)} · {formatDate((inv.submittedAt || '').slice(0, 10))}</li>
                              {(inv.history || []).map((h, i) => (
                                <li key={i}><b style={{ textTransform: 'capitalize' }}>{h.action}</b> by {h.by} · {formatDate(String(h.at).slice(0, 10))} <span style={{ color: C.textDim }}>({h.from} → {h.to})</span>{h.note && <div style={{ color: C.textDim, whiteSpace: 'pre-wrap' }}>“{h.note}”</div>}</li>
                              ))}
                            </ol>
                          </section>
                          {isAdmin && canEdit && st !== 'Rejected' && (
                            <section className="imss-sub-wide">
                              <h3 className="imss-sub-h">Admin: move to a queue</h3>
                              <p className="text-xs mb-2" style={{ color: C.textDim }}>Use this when the people on the current queue aren’t available. It skips the normal order; the move is kept in History and whoever holds the new queue is emailed.</p>
                              <div className="flex gap-2 flex-wrap items-center">
                                <Select value={moveTo} onChange={e => setMoveTo(e.target.value)} aria-label="Move invoice to" style={{ maxWidth: 240 }}>
                                  <option value="">Choose a queue…</option>
                                  {[...INVOICE_STAGES.map(x => x.status), 'Paid'].filter(x => x !== st).map(x => <option key={x} value={x}>{x}</option>)}
                                </Select>
                                <Btn variant="ghost" onClick={() => adminMove(inv)} disabled={!moveTo}><ChevronRight size={14} /> Move{moveTo ? ' to ' + moveTo : ''}</Btn>
                              </div>
                            </section>
                          )}
                          <section className="imss-sub-wide">
                            <h3 className="imss-sub-h">Messages with the artist</h3>
                            <InvoiceThread inv={inv} artistLabel={artistName(inv.artistId)} />
                            {canEdit && (
                              <div className="mt-3">
                                <Field label="Message to the artist">
                                  <TextArea rows={2} value={message} onChange={e => setMessage(e.target.value)} placeholder="e.g. Can you send the receipt for the studio deposit?" />
                                </Field>
                                <div className="mt-2"><Btn variant="ghost" onClick={() => sendMessage(inv)} disabled={!message.trim()}><MessageSquare size={14} /> Send message</Btn></div>
                                <div className="text-xs mt-1" style={{ color: C.textDim }}>The artist gets it by email and can reply to that email.</div>
                              </div>
                            )}
                          </section>
                          {canFix(inv) && (
                            <section className="imss-sub-wide">
                              <h3 className="imss-sub-h">Correct or return</h3>
                              {fixing && fixing.id === inv.id ? (
                                <div className="imss-form-grid gap-3">
                                  {FIX_FIELDS.map(([k, label]) => <Field key={k} label={label} full={k === 'details' || k === 'title'}>{k === 'budgetCategory' ? <Select value={fixing[k] || ''} onChange={e => setFixing({ ...fixing, [k]: e.target.value })}><option value="">Not set</option>{Object.entries(BUDGET_TYPES).map(([t, names]) => <optgroup key={t} label={t}>{names.map(n => <option key={n} value={t + '|' + n}>{n}</option>)}</optgroup>)}<option value="Other|Other">Something else</option></Select> : k === 'details' ? <TextArea rows={2} value={fixing[k] || ''} onChange={e => setFixing({ ...fixing, [k]: e.target.value })} /> : <input className="w-full" type={k === 'invoiceDate' ? 'date' : 'text'} inputMode={k === 'amount' ? 'decimal' : undefined} value={fixing[k] ?? ''} onChange={e => setFixing({ ...fixing, [k]: e.target.value })} style={{ background: 'var(--field)', color: C.text, border: '1px solid var(--field-line)', borderRadius: 12, padding: '10px 12px' }} />}</Field>)}
                                  <Field label="Why (shown in the history)" full><input className="w-full" value={fixing.why || ''} onChange={e => setFixing({ ...fixing, why: e.target.value })} placeholder="e.g. Receipt total is $120" style={{ background: 'var(--field)', color: C.text, border: '1px solid var(--field-line)', borderRadius: 12, padding: '10px 12px' }} /></Field>
                                  <div className="imss-span-2 flex gap-2"><Btn variant="primary" onClick={() => saveFix(inv)}>Save correction</Btn><Btn variant="ghost" onClick={() => setFixing(null)}>Cancel</Btn></div>
                                </div>
                              ) : (
                                <>
                                  <div className="flex gap-2 flex-wrap"><Btn variant="ghost" onClick={() => { setFixing({ id: inv.id, ...Object.fromEntries(FIX_FIELDS.map(([k]) => [k, inv[k] ?? ''])), amount: String(inv.amount ?? ''), why: '' }); setError(''); }}>Edit details</Btn></div>
                                  <div className="text-xs mt-2 mb-3" style={{ color: C.textDim }}>Edits are logged in the history and the artist sees what changed. The invoice carries on through the queues as usual.</div>
                                  <Field label="Return to the artist: what needs fixing?"><TextArea rows={2} value={returnNote} onChange={e => { setReturnNote(e.target.value); setError(''); }} placeholder="e.g. Receipt missing, or the amount doesn’t match it" /></Field>
                                  <div className="mt-2"><Btn variant="danger" onClick={() => returnToArtist(inv)}>Return to artist</Btn></div>
                                  <div className="text-xs mt-1" style={{ color: C.textDim }}>They get an email, fix it in their portal and resubmit. It comes back to PM Approval.</div>
                                </>
                              )}
                            </section>
                          )}
                          {canEdit && inv.kind === 'expense' && (() => {
                            // Attach an expense claim to the artist's budget. Going over needs someone who can approve budgets.
                            const choices = overheads.filter(o => o.kind === 'artist' && o.artistId === inv.artistId && (o.status === 'Active' || o.id === inv.overheadId));
                            if (!choices.length) return null;
                            const o = overheads.find(x => x.id === inv.overheadId);
                            function attach(overheadId, categoryId) {
                              const target = overheads.find(x => x.id === overheadId);
                              if (target) {
                                const amt = Number(inv.amount) || 0;
                                const spentOf = f => ledger.filter(l => l.type === 'expense' && l.overheadId === target.id && (l.approvalStatus || 'Approved') === 'Approved' && f(l)).reduce((t, l) => t + (Number(l.amount) || 0), 0)
                                  + invoices.filter(i => i.id !== inv.id && i.kind === 'expense' && i.overheadId === target.id && ['Pay Approved', 'Paid'].includes(i.status) && f(i)).reduce((t, i) => t + (Number(i.amount) || 0), 0);
                                const cat = categoryChoices(target).find(c => c.id === categoryId);
                                const over = spentOf(() => true) + amt > target.total + 1e-9 || (cat && spentOf(x => x.categoryId === cat.id) + amt > cat.allocated + 1e-9);
                                if (over && !approver) { setError('That takes the budget over. An Admin needs to attach it.'); return; }
                              }
                              logActivity('attached an expense claim to a budget', inv.title + (target ? ' → ' + target.title : ' (detached)'), inv.artistId);
                              update(invoices.map(i => i.id !== inv.id ? i : { ...i, overheadId: overheadId || '', categoryId: categoryId || '' }));
                            }
                            return (
                              <section className="imss-sub-wide">
                                <h3 className="imss-sub-h">Budget</h3>
                                <div className="flex gap-2 flex-wrap">
                                  <Select value={inv.overheadId || ''} onChange={e => attach(e.target.value, '')} aria-label="Budget" style={{ flex: '1 1 200px' }}>
                                    <option value="">Not attached</option>
                                    {choices.map(x => <option key={x.id} value={x.id}>{x.title}</option>)}
                                  </Select>
                                  {o && <Select value={inv.categoryId || ''} onChange={e => attach(o.id, e.target.value)} aria-label="Budget category" style={{ flex: '1 1 160px' }}>
                                    <option value="">Unallocated</option>
                                    {categoryChoices(o).map(c => <option key={c.id} value={c.id}>{catLabel(c)}{c.allocated ? '' : ' (nothing allocated)'}</option>)}
                                  </Select>}
                                </div>
                                <div className="text-xs mt-1" style={{ color: C.textDim }}>Counts against the budget once it reaches Pay Approved.</div>
                              </section>
                            );
                          })()}
                          {(() => {
                            // Send to partner: PM (theirs), Finance, Legal or Admin. It's shared with the
                            // artist's label rep (view and download only) and moves to DP Queue.
                            const artistRec = roster.find(a => a.id === inv.artistId) || {};
                            const rep = staff.find(m => m.id === artistRec.labelRep && m.status !== 'Archived');
                            const maysend = canEdit && (['Admin', 'Finance', 'Legal'].includes(session.role) || (session.role === 'Product Manager' && artistRec.productManager === session.name));
                            const past = ['DP Queue', 'Pay Approved', 'Paid', 'Rejected'].includes(st);
                            if (inv.sentToRepAt || inv.sentToPartnerAt) return <section className="imss-sub-wide text-sm" style={{ color: C.textDim }}>Sent to the partner {String(inv.sentToPartnerAt || inv.sentToRepAt).slice(0, 10)}{inv.sentToRepBy ? ' by ' + inv.sentToRepBy : ''}{rep ? '; shared with ' + rep.name + ' (label rep)' : ''}.{rep && <span className="block mt-1" style={{ color: inv.repSentOutAt ? C.teal : C.textDim }}>{inv.repSentOutAt ? rep.name + ' confirmed sending it out ' + String(inv.repSentOutAt).slice(0, 10) + (inv.repSentOutNote ? ' (' + inv.repSentOutNote + ')' : '') + '.' : inv.repSeenAt ? rep.name + ' has seen it (' + String(inv.repSeenAt).slice(0, 10) + '), not sent out yet.' : 'Not seen by ' + rep.name + ' yet.'}</span>}</section>;
                            if (!maysend || past) return null;
                            return (
                              <section className="imss-sub-wide">
                                <h3 className="imss-sub-h">Partner</h3>
                                <Btn variant="ghost" onClick={() => {
                                  const at = new Date().toISOString();
                                  logActivity('sent an invoice to the partner', inv.title + (rep ? ' (shared with ' + rep.name + ')' : ''), inv.artistId);
                                  update(invoices.map(i => i.id !== inv.id ? i : { ...i, status: 'DP Queue', sentToPartnerAt: at, sentToRepAt: rep ? at : i.sentToRepAt, sentToRepBy: session.name,
                                    history: [...(i.history || []), { at, by: session.name, action: 'sent to partner', from: st, to: 'DP Queue', note: rep ? 'Shared with ' + rep.name : '' }] }));
                                }}><Send size={14} /> Send to partner{rep ? ' (shares it with ' + rep.name + ')' : ''}</Btn>
                                <div className="text-xs mt-1" style={{ color: C.textDim }}>Moves it to DP Queue.{rep ? ' The label rep can view and download it.' : ''}</div>
                              </section>
                            );
                          })()}
                          {canAct(inv) && (
                            <section className="imss-sub-wide">
                              <h3 className="imss-sub-h">{st}: your decision{isAdmin && !reviewers.some(m => me && m.id === me.id) ? ' (as Admin)' : ''}</h3>
                              <Field label={idx === 0 ? 'Note (needed to reject)' : 'Note (needed to send back or reject)'}>
                                <TextArea rows={2} value={note} onChange={e => { setNote(e.target.value); setError(''); }} placeholder="e.g. Receipt doesn’t match the amount" />
                              </Field>
                              {error && <div className="text-sm mt-2" role="alert" style={{ color: C.red }}>{error}</div>}
                              <div className="flex gap-2 flex-wrap mt-3">
                                <Btn variant="primary" onClick={() => move(inv, 'approve')}><CheckCircle2 size={14} /> {stage.approve}{stage.status !== 'Pay Approved' && INVOICE_STAGES[idx + 1] ? ' → ' + INVOICE_STAGES[idx + 1].status : ''}</Btn>
                                {idx > 0 && <Btn variant="ghost" onClick={() => move(inv, 'back')}><ChevronLeft size={14} /> Send back to {INVOICE_STAGES[idx - 1].status}</Btn>}
                                <Btn variant="danger" onClick={() => move(inv, 'reject')}>Reject</Btn>
                              </div>
                            </section>
                          )}
                        </div>
                      </td></tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

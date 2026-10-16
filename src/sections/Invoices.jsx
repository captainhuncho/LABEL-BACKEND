import { CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Eye, FileText, MessageSquare, UserCog, Wallet } from 'lucide-react';
import { logActivity } from '../audit.js';
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
  if (st === 'Pay Approved') return 'Approved for payment';
  const step = INVOICE_FLOW.indexOf(st);
  return step > 0 ? 'In review · step ' + (step + 1) + ' of ' + INVOICE_FLOW.length : 'Submitted';
}
export const INVOICE_TONES = { 'PM Approval': 'amber', 'Finance Queue': 'amber', 'LH Queue': 'amber', 'DP Queue': 'amber', 'Pay Approved': 'teal', Paid: 'teal', Rejected: 'red', Pending: 'amber', Approved: 'teal' };

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

export function InvoicesSection({ invoices, update, roster, staff = [], labelSettings = {}, updateLabelSettings, canEdit = true, session = {}, pmScope = null }) {
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
  const tabs = [['all', 'All', scoped.length], ['mine', 'My queue', mine.length], ...INVOICE_STAGES.map(st => [st.status, st.status, scoped.filter(i => invoiceStatus(i) === st.status).length]), ['Paid', 'Paid', 0], ['Rejected', 'Rejected', 0]];
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
                      <Td>{inv.title}</Td>
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

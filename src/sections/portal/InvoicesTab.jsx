import { FileText, MessageSquare } from 'lucide-react';
import React from 'react';
import { formatCents, formatDate } from '../../constants.js';
import { C } from '../../theme.js';
import { Badge, Btn, EmptyState, Field, Input, Select, Td, TextArea, Th } from '../../ui.jsx';
import { INVOICE_KINDS, invoiceStatus, artistInvoiceStatus, INVOICE_TONES, InvoiceThread } from '../Invoices.jsx';
import { BUDGET_TYPES } from '../Budget.jsx';

// The artist portal's invoices tab (state lives in ArtistPortalShell).
export function InvoicesTab({ artist, budgets, emptyInvoice, handleInvoiceFile, invoiceError, invoiceFileRef, invoiceForm, invoiceSent, invoices, myInvoices, openInvoiceId, paid, replyDrafts, replyError, resubmittingId, sendInvoiceReply, setInvoiceForm, setInvoiceSent, setOpenInvoiceId, setReplyDrafts, setResubmittingId, submitInvoice }) {
  return (
          <div>
            <p className="text-sm mb-5" style={{ color: C.textDim, maxWidth: '70ch' }}>Send the label an invoice to claim back money you spent, or to bill for paid work like a feature or a show. Your Product Manager or an Admin reviews it; you’ll see the decision here.</p>

            <form onSubmit={submitInvoice} className="rounded border p-5 mb-8" style={{ background: C.panel, borderColor: C.border }}>
              <h2 className="mb-4" style={{ fontWeight: 600, fontSize: 17 }}>New invoice</h2>
              <fieldset className="mb-4">
                <legend className="text-xs mb-2" style={{ color: C.textDim }}>What is it for?</legend>
                <div className="flex gap-2 flex-wrap" role="radiogroup">
                  {Object.entries(INVOICE_KINDS).map(([k, label]) => (
                    <label key={k} className="rounded border px-3 py-2 text-sm inline-flex items-center gap-2" style={{ cursor: 'pointer', borderColor: invoiceForm.kind === k ? C.amber : C.border, background: invoiceForm.kind === k ? C.amberSoft : 'transparent', color: invoiceForm.kind === k ? C.amber : C.text }}>
                      <input type="radio" name="invoice-kind" value={k} checked={invoiceForm.kind === k} onChange={() => setInvoiceForm(f => ({ ...f, kind: k }))} style={{ accentColor: C.amber }} />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="imss-form-grid imss-two gap-3">
                <Field label="What it’s for" full>
                  <Select required value={invoiceForm.budgetCategory} onChange={e => setInvoiceForm(f => ({ ...f, budgetCategory: e.target.value }))}>
                    <option value="">Choose…</option>
                    {Object.entries(BUDGET_TYPES).map(([t, names]) => <optgroup key={t} label={t}>{names.map(n => <option key={n} value={t + '|' + n}>{n}</option>)}</optgroup>)}
                    <option value="Other|Other">Something else</option>
                  </Select>
                </Field>
                <Field label="Description" full><Input required value={invoiceForm.title} onChange={e => setInvoiceForm(f => ({ ...f, title: e.target.value }))} placeholder={invoiceForm.kind === 'expense' ? 'e.g. Studio session, 12 March' : 'e.g. Feature verse on “Wave”'} /></Field>
                <Field label="Amount (USD)"><Input required inputMode="decimal" value={invoiceForm.amount} onChange={e => setInvoiceForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" /></Field>
                <Field label="Invoice date"><Input type="date" value={invoiceForm.invoiceDate} onChange={e => setInvoiceForm(f => ({ ...f, invoiceDate: e.target.value }))} /></Field>
                <Field label="Invoice number (optional)"><Input value={invoiceForm.invoiceNumber} onChange={e => setInvoiceForm(f => ({ ...f, invoiceNumber: e.target.value }))} placeholder="e.g. AC-2026-004" /></Field>
                <Field label="Pay to (name on the account)"><Input value={invoiceForm.payTo} onChange={e => setInvoiceForm(f => ({ ...f, payTo: e.target.value }))} placeholder="Your name or company" /></Field>
                {budgets.filter(b => b.status === 'Active').length > 0 && (
                  <Field label="Budget (optional)" full>
                    <Select value={invoiceForm.overheadId} onChange={e => setInvoiceForm(f => ({ ...f, overheadId: e.target.value }))}>
                      <option value="">Not part of a budget</option>
                      {budgets.filter(b => b.status === 'Active').map(b => <option key={b.id} value={b.id}>{b.title}</option>)}
                    </Select>
                  </Field>
                )}
                <Field label="Notes for the label (optional)" full><TextArea rows={3} value={invoiceForm.details} onChange={e => setInvoiceForm(f => ({ ...f, details: e.target.value }))} placeholder="Who agreed it, and anything else the label should know." /></Field>
                <Field label={invoiceForm.kind === 'expense' ? 'Receipt (PDF or photo, up to 10 MB)' : 'Invoice file (PDF or photo, up to 10 MB, optional)'} full>
                  <label className="rounded-full border px-4 inline-flex items-center gap-2 text-sm" style={{ minHeight: 44, cursor: 'pointer', borderColor: invoiceForm.attachmentName ? C.teal : C.border, color: invoiceForm.attachmentName ? C.teal : C.text, maxWidth: '100%' }}>
                    <FileText size={14} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{invoiceForm.attachmentName || 'Choose file'}</span>
                    <input ref={invoiceFileRef} type="file" accept="application/pdf,image/*" onChange={handleInvoiceFile} className="sr-only" />
                  </label>
                </Field>
              </div>
              {invoiceError && <div className="text-sm mt-3" role="alert" style={{ color: C.red }}>{invoiceError}</div>}
              {invoiceSent && !invoiceError && <div className="text-sm mt-3" role="status" style={{ color: C.teal }}>Invoice sent. It’s listed below while the label reviews it.</div>}
              <div className="mt-4 flex gap-2"><Btn variant="primary" type="submit"><FileText size={14} /> {resubmittingId ? 'Resubmit invoice' : 'Submit invoice'}</Btn>{resubmittingId && <Btn variant="ghost" onClick={() => { setResubmittingId(null); setInvoiceForm(emptyInvoice); }}>Cancel</Btn>}</div>
            </form>

            <h2 className="mb-3" style={{ fontWeight: 600, fontSize: 17 }}>Your invoices</h2>
            {myInvoices.length === 0 ? (
              <EmptyState icon={FileText} title="No invoices yet" description="Invoices you submit show here with their status: pending, approved, paid or rejected." />
            ) : (
              <div className="rounded border overflow-x-auto" style={{ borderColor: C.border, background: C.panel }}>
                <table className="w-full" style={{ minWidth: 620 }}>
                  <thead><tr><Th>Date</Th><Th>Type</Th><Th>Description</Th><Th align="right">Amount</Th><Th>Status</Th><Th align="right">Messages</Th></tr></thead>
                  <tbody>
                    {myInvoices.map(i => (
                      <React.Fragment key={i.id}>
                      <tr>
                        <Td mono>{formatDate(i.invoiceDate)}</Td>
                        <Td>{INVOICE_KINDS[i.kind] || i.kind}</Td>
                        <Td>{i.title}{i.category ? <div className="text-xs mt-0.5" style={{ color: C.textDim }}>{i.category}</div> : null}{i.reviewNote ? <div className="text-xs mt-0.5" style={{ color: C.textDim }}>Label: {i.reviewNote}</div> : null}</Td>
                        <Td align="right" mono>{formatCents(i.amount)}</Td>
                        <Td><Badge tone={INVOICE_TONES[invoiceStatus(i)]}>{artistInvoiceStatus(i)}</Badge></Td>
                        <Td align="right"><button onClick={() => setOpenInvoiceId(openInvoiceId === i.id ? null : i.id)} aria-expanded={openInvoiceId === i.id} style={{ color: C.amber, fontWeight: 600, fontSize: 13 }}>{openInvoiceId === i.id ? 'Close' : (i.messages || []).length ? 'Messages (' + i.messages.length + ')' : 'Message'}</button></Td>
                      </tr>
                      {openInvoiceId === i.id && (
                        <tr><td colSpan={6} style={{ padding: 16, borderBottom: '1px solid ' + C.border }}>
                          {i.status === 'Needs changes' && (
                            <div className="rounded p-3 mb-3" style={{ background: C.redSoft }}>
                              <div style={{ fontWeight: 600 }}>The label asked for changes</div>
                              {i.reviewNote && <div className="text-sm mt-1">{i.reviewNote}</div>}
                              <div className="mt-2"><Btn variant="primary" onClick={() => { setResubmittingId(i.id); setInvoiceForm({ ...emptyInvoice, ...Object.fromEntries(Object.keys(emptyInvoice).map(k => [k, i[k] ?? emptyInvoice[k]])), amount: String(i.amount ?? '') }); setInvoiceSent(false); window.scrollTo && document.querySelector('.imss-content')?.scrollTo({ top: 0, behavior: 'smooth' }); }}>Edit and resubmit</Btn></div>
                            </div>
                          )}
                          {i.correctedNote && i.status !== 'Needs changes' && <div className="text-sm mb-3" style={{ color: C.textDim }}>The label corrected this invoice: {i.correctedNote}</div>}
                          <InvoiceThread inv={i} artistLabel={artist.name} />
                          {invoiceStatus(i) !== 'Paid' && (
                            <div className="mt-3">
                              <Field label="Message to the label">
                                <TextArea rows={2} value={replyDrafts['inv_' + i.id] || ''} onChange={e => setReplyDrafts(d => ({ ...d, ['inv_' + i.id]: e.target.value }))} placeholder="e.g. Receipt attached by email; the deposit was paid on 12 March." />
                              </Field>
                              {replyError['inv_' + i.id] && <div className="text-sm mt-2" role="alert" style={{ color: C.red }}>{replyError['inv_' + i.id]}</div>}
                              <div className="mt-2"><Btn variant="ghost" onClick={() => sendInvoiceReply(i)}><MessageSquare size={14} /> Send message</Btn></div>
                            </div>
                          )}
                        </td></tr>
                      )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
  );
}

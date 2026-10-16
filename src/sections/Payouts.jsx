import { CheckCircle2, ClipboardList, DollarSign, Send, Mail, Trash2, TrendingUp, Wallet } from 'lucide-react';
import { logActivity } from '../audit.js';
import { useMemo, useState } from 'react';
import { formatCurrency, formatDate, monthLabel, todayStr, uid } from '../constants.js';
import { labelPnL, payoutStatementFor, recoupmentForArtist, applyThreshold, lastClosedPeriod, reportingTerms, slug } from '../finance.js';
import { C, MONO_FONT } from '../theme.js';
import { inputStyle, Badge, Btn, ConfirmInline, EmptyState, ExportBar, Field, Input, KPICard, SectionHeader, Select, Td, Th } from '../ui.jsx';

export function PayoutsSection({ invoices = [], payouts, update, roster, revenue, masterGross, ledger, canEdit = true }) {
  const empty = { artistId: roster[0] ? roster[0].id : '', periodStart: todayStr().slice(0, 7), periodEnd: todayStr().slice(0, 7), notes: '' };
  const [form, setForm] = useState(empty);
  const [confirmId, setConfirmId] = useState(null);

  const selectedArtist = roster.find(a => a.id === form.artistId) || null;
  const preview = selectedArtist ? payoutStatementFor(selectedArtist, form.periodStart, form.periodEnd, revenue, masterGross) : null;
  // The artist's last real (non-draft) statement before this period carries any under-threshold balance in.
  const previousFor = (aSlug, start) => [...payouts].filter(p => p.artistSlug === aSlug && p.status !== 'draft' && p.periodEnd < start).sort((x, y) => y.periodEnd.localeCompare(x.periodEnd))[0] || null;
  const terms = selectedArtist ? reportingTerms(selectedArtist) : null;
  const carry = preview ? applyThreshold(preview.artistShare, previousFor(slug(selectedArtist.name), form.periodStart), terms.threshold) : null;
  const today = todayStr();
  const dueList = roster.filter(a => (a.status || 'Active') === 'Active').map(a => {
    const per = lastClosedPeriod(a, today), aSlug = slug(a.name);
    const done = payouts.find(p => p.artistSlug === aSlug && p.periodStart === per.start && p.periodEnd === per.end && p.status !== 'draft');
    const share = payoutStatementFor(a, per.start, per.end, revenue, masterGross).artistShare;
    const c = applyThreshold(share, previousFor(aSlug, per.start), reportingTerms(a).threshold);
    const daysLeft = Math.round((Date.parse(per.due) - Date.parse(today)) / 86400000);
    return { artist: a, per, done, c, daysLeft, terms: reportingTerms(a) };
  }).sort((x, y) => (!!x.done - !!y.done) || x.per.due.localeCompare(y.per.due));
  function prepare(row) { setForm({ ...empty, artistId: row.artist.id, periodStart: row.per.start, periodEnd: row.per.end }); }

  function generateStatement(status) {
    if (!selectedArtist || !preview || form.periodStart > form.periodEnd) return;
    const stmt = {
      id: uid(), artist: selectedArtist.name, artistSlug: slug(selectedArtist.name),
      periodStart: form.periodStart, periodEnd: form.periodEnd,
      grossEarning: preview.gross, swiftShare: preview.swift, netAfterSwift: preview.net,
      artistPct: preview.artistPct, artistShare: preview.artistShare, labelShare: preview.labelShare,
      ...carry, threshold: terms.threshold,
      // Under the threshold nothing is paid; the balance rolls into the next statement.
      status: status === 'paid' && carry.belowThreshold ? 'carried forward' : status, createdAt: Date.now(), notes: form.notes,
    };
    update([...payouts, stmt]);
    setForm({ ...empty, artistId: form.artistId });
  }
  function markPaid(id) { logActivity('marked statement paid', (payouts.find(p => p.id === id) || {}).artist || ''); update(payouts.map(p => p.id === id ? { ...p, status: 'paid' } : p)); }
  // Sending publishes the statement to the artist's portal and emails them;
  // a scheduled one goes out within 10 minutes of its time.
  const [scheduleId, setScheduleId] = useState(null);
  const [scheduleAt, setScheduleAt] = useState('');
  const [scheduleError, setScheduleError] = useState('');
  function sendNow(id) { const p0 = payouts.find(p => p.id === id); logActivity('sent statement to artist', p0 ? p0.artist + ' ' + p0.periodStart + '–' + p0.periodEnd : ''); update(payouts.map(p => p.id === id ? { ...p, sentAt: new Date().toISOString(), scheduledFor: '' } : p)); }
  function schedule(id) {
    const when = Date.parse(scheduleAt);
    if (!scheduleAt || isNaN(when) || when <= Date.now()) { setScheduleError('Pick a date and time in the future.'); return; }
    logActivity('scheduled statement', new Date(when).toISOString());
    update(payouts.map(p => p.id === id ? { ...p, scheduledFor: new Date(when).toISOString() } : p));
    setScheduleId(null); setScheduleAt(''); setScheduleError('');
  }
  function cancelSchedule(id) { update(payouts.map(p => p.id === id ? { ...p, scheduledFor: '' } : p)); }
  const fmtWhen = iso => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  function remove(id) { update(payouts.filter(p => p.id !== id)); setConfirmId(null); }

  const recoupmentByArtist = useMemo(() => roster.map(a => ({ artist: a, ...recoupmentForArtist(a, ledger, revenue, masterGross, invoices) })), [roster, ledger, revenue, masterGross, invoices]);
  const pnl = labelPnL(roster, revenue, masterGross, ledger);
  const sortedPayouts = [...payouts].sort((a, b) => b.periodEnd.localeCompare(a.periodEnd) || b.createdAt - a.createdAt);

  return (
    <div>
      <SectionHeader title="Payouts" artistNote="a statement only after you press Send to artist (or its scheduled time passes). They get an email." description="Generate a payout statement for an artist over any period — computed live from revenue and money received, per the inbound banking charge split formula." />

      <div className="flex flex-wrap gap-3 mb-6">
        <KPICard icon={DollarSign} label="Label earnings (lifetime)" value={formatCurrency(pnl.labelEarn)} tone="teal" />
        <KPICard icon={TrendingUp} label="Ledger income" value={formatCurrency(pnl.ledgerIncome)} />
        <KPICard icon={Wallet} label="Ledger expense" value={formatCurrency(pnl.ledgerExpense)} />
        <KPICard icon={ClipboardList} label="Label net profit (P&L)" value={formatCurrency(pnl.netProfit)} tone={pnl.netProfit < 0 ? 'red' : 'teal'} />
      </div>

      <h2 className="mb-2" style={{ fontWeight: 600, fontSize: 17 }}>Statements due</h2>
      <p className="text-xs mb-3" style={{ color: C.textDim }}>Each artist’s last closed reporting period, from their schedule on the Roster.</p>
      <div className="rounded border overflow-x-auto mb-6" style={{ borderColor: C.border, background: C.panel }}>
        <table className="w-full" style={{ minWidth: 820 }}>
          <thead><tr><Th>Artist</Th><Th>Schedule</Th><Th>Period</Th><Th>Due by</Th><Th align="right">Due to artist</Th><Th>Status</Th><Th align="right"><span className="sr-only">Actions</span></Th></tr></thead>
          <tbody>
            {dueList.map(r => (
              <tr key={r.artist.id}>
                <Td>{r.artist.name}</Td>
                <Td><span className="text-xs" style={{ color: C.textDim }}>{r.terms.period}, {r.terms.deliveryDays} days{r.terms.threshold ? ', min ' + formatCurrency(r.terms.threshold) : ''}</span></Td>
                <Td mono>{monthLabel(r.per.start)}{r.per.start !== r.per.end ? ' – ' + monthLabel(r.per.end) : ''}</Td>
                <Td mono>{formatDate(r.per.due)}</Td>
                <Td align="right" mono>{formatCurrency(r.c.totalDue)}</Td>
                <Td>{r.done ? <Badge tone="teal">{r.done.status === 'carried forward' ? 'Done · carried forward' : 'Done'}</Badge>
                  : r.daysLeft < 0 ? <Badge tone="red">Overdue {-r.daysLeft} days</Badge>
                  : <Badge tone="amber">Due in {r.daysLeft} days</Badge>}{!r.done && r.c.belowThreshold && <div className="text-xs mt-1" style={{ color: C.textDim }}>Under threshold, will carry forward</div>}</Td>
                <Td align="right">{!r.done && canEdit && <Btn variant="ghost" onClick={() => prepare(r)}>Prepare</Btn>}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canEdit && (
        <div className="rounded border p-4 mb-6 imss-form-grid gap-3" style={{ background: C.panel, borderColor: C.borderLight }}>
          <Field label="Artist">
            <Select value={form.artistId} onChange={e => setForm({ ...form, artistId: e.target.value })}>
              {roster.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          </Field>
          <Field label="Period start"><Input type="month" value={form.periodStart} onChange={e => setForm({ ...form, periodStart: e.target.value })} /></Field>
          <Field label="Period end"><Input type="month" value={form.periodEnd} onChange={e => setForm({ ...form, periodEnd: e.target.value })} /></Field>
          <Field label="Notes" full><Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="e.g. Wired via ACH" /></Field>

          {preview && (
            <div className="imss-span-2 rounded border p-3 flex flex-wrap gap-4" style={{ background: C.bg, borderColor: C.border }}>
              <div className="text-xs" style={{ color: C.textFaint }}>Gross <div style={{ color: C.text, fontFamily: MONO_FONT, fontSize: 14 }}>{formatCurrency(preview.gross)}</div></div>
              <div className="text-xs" style={{ color: C.textFaint }}>Inbound Banking Charge share <div style={{ color: C.text, fontFamily: MONO_FONT, fontSize: 14 }}>{formatCurrency(preview.swift)}</div></div>
              <div className="text-xs" style={{ color: C.textFaint }}>Net <div style={{ color: C.text, fontFamily: MONO_FONT, fontSize: 14 }}>{formatCurrency(preview.net)}</div></div>
              <div className="text-xs" style={{ color: C.textFaint }}>Artist share ({Math.round(preview.artistPct * 100)}%) <div style={{ color: C.teal, fontWeight: 600, fontFamily: MONO_FONT, fontSize: 14 }}>{formatCurrency(preview.artistShare)}</div></div>
              <div className="text-xs" style={{ color: C.textFaint }}>Label share <div style={{ color: C.text, fontFamily: MONO_FONT, fontSize: 14 }}>{formatCurrency(preview.labelShare)}</div></div>
              {carry.carriedIn > 0 && <div className="text-xs" style={{ color: C.textFaint }}>Carried in <div style={{ color: C.text, fontFamily: MONO_FONT, fontSize: 14 }}>{formatCurrency(carry.carriedIn)}</div></div>}
              <div className="text-xs" style={{ color: C.textFaint }}>Total due <div style={{ color: carry.belowThreshold ? C.amber : C.teal, fontWeight: 600, fontFamily: MONO_FONT, fontSize: 14 }}>{formatCurrency(carry.totalDue)}</div></div>
              {carry.belowThreshold && <div className="text-xs w-full" style={{ color: C.amber }}>Under {selectedArtist.name}’s {formatCurrency(terms.threshold)} payout threshold: the statement is still sent, and {formatCurrency(carry.totalDue)} carries forward to the next one.</div>}
            </div>
          )}
          <div className="imss-span-2 flex gap-2 mt-1">
            <Btn variant="ghost" onClick={() => generateStatement('draft')}>Save as draft</Btn>
            <Btn variant="primary" onClick={() => generateStatement('paid')}>{carry && carry.belowThreshold ? 'Generate (carry forward)' : <>Generate &amp; mark paid</>}</Btn>
          </div>
        </div>
      )}

      <div className="text-xs mb-3" style={{ color: C.textFaint }}>Recoupment status by artist</div>
      <div className="rounded border overflow-x-auto mb-6" style={{ borderColor: C.border, background: C.panel }}>
        <table className="w-full" style={{ minWidth: 620 }}>
          <thead><tr><Th>Artist</Th><Th align="right">Spent on artist (label + approved claims)</Th><Th align="right">Earned (artist share)</Th><Th align="right">Balance</Th></tr></thead>
          <tbody>
            {recoupmentByArtist.map(r => (
              <tr key={r.artist.id}>
                <Td>{r.artist.name}</Td>
                <Td align="right" mono>{formatCurrency(r.spent)}</Td>
                <Td align="right" mono>{formatCurrency(r.earned)}</Td>
                <Td align="right" mono>
                  {r.balance > 0
                    ? <span style={{ color: C.red, fontWeight: 600 }}>{formatCurrency(r.unrecouped)} unrecouped</span>
                    : <span style={{ color: C.teal, fontWeight: 600 }}>Fully recouped{r.dueOnTop > 0 ? ' · ' + formatCurrency(r.dueOnTop) + ' due' : ''}</span>}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ExportBar filename="imss-payout-statements" headers={['Artist', 'Period start', 'Period end', 'Gross', 'Inbound Banking Charge share', 'Net', 'Artist %', 'Artist share', 'Label share', 'Status']} rows={sortedPayouts.map(p => [p.artist, p.periodStart, p.periodEnd, p.grossEarning, p.swiftShare, p.netAfterSwift, p.artistPct, p.artistShare, p.labelShare, p.status])} />

      <div className="text-xs mb-3" style={{ color: C.textFaint }}>Statement history</div>
      {sortedPayouts.length === 0 ? (
        <EmptyState icon={Wallet} title="No payout statements yet" description="Generate one above to see it here." />
      ) : (
        <div className="rounded border overflow-x-auto" style={{ borderColor: C.border, background: C.panel }}>
          <table className="w-full" style={{ minWidth: 1000 }}>
            <thead><tr><Th>Period</Th><Th>Artist</Th><Th align="right">Gross</Th><Th align="right">Net</Th><Th align="right">Artist share</Th><Th>Status</Th><Th>Artist</Th><Th align="right">Actions</Th></tr></thead>
            <tbody>
              {sortedPayouts.map(p => (
                <tr key={p.id}>
                  <Td mono>{p.periodStart} – {p.periodEnd}</Td>
                  <Td>{p.artist}</Td>
                  <Td align="right" mono>{formatCurrency(p.grossEarning)}</Td>
                  <Td align="right" mono>{formatCurrency(p.netAfterSwift)}</Td>
                  <Td align="right" mono>{formatCurrency(p.artistShare)}</Td>
                  <Td><Badge tone={p.status === 'paid' ? 'teal' : 'amber'}>{p.status}</Badge>{p.carriedOut > 0 && <div className="text-xs mt-1" style={{ color: C.textDim }}>{formatCurrency(p.carriedOut)} carried forward</div>}</Td>
                  <Td>
                    {p.sentAt ? (
                      <span className="text-xs" style={{ color: C.teal }}>Sent {fmtWhen(p.sentAt)}</span>
                    ) : p.scheduledFor ? (
                      <span className="text-xs" style={{ color: C.amber }}>Scheduled {fmtWhen(p.scheduledFor)}{canEdit && <> · <button onClick={() => cancelSchedule(p.id)} style={{ color: C.textDim, textDecoration: 'underline', textUnderlineOffset: 3 }}>cancel</button></>}</span>
                    ) : canEdit ? (
                      scheduleId === p.id ? (
                        <span className="inline-flex flex-col gap-1">
                          <span className="inline-flex items-center gap-2">
                            <input type="datetime-local" aria-label="Send at" value={scheduleAt} onChange={e => { setScheduleAt(e.target.value); setScheduleError(''); }} style={{ ...inputStyle, height: 32,  }} />
                            <button onClick={() => schedule(p.id)} style={{ color: C.amber, fontWeight: 600, fontSize: 13 }}>Schedule</button>
                            <button onClick={() => { setScheduleId(null); setScheduleError(''); }} style={{ color: C.textDim, fontSize: 13 }}>Cancel</button>
                          </span>
                          {scheduleError && <span className="text-xs" role="alert" style={{ color: C.red }}>{scheduleError}</span>}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-3 text-sm whitespace-nowrap">
                          <button onClick={() => sendNow(p.id)} style={{ color: C.amber, fontWeight: 600 }}><Mail size={13} style={{ display: 'inline', verticalAlign: -2, marginRight: 4 }} />Send to artist</button>
                          <button onClick={() => { setScheduleId(p.id); setScheduleAt(''); }} style={{ color: C.textDim }}>Schedule</button>
                        </span>
                      )
                    ) : <span className="text-xs" style={{ color: C.textDim }}>Not sent</span>}
                  </Td>
                  <Td align="right">
                    {confirmId === p.id ? <ConfirmInline onConfirm={() => remove(p.id)} onCancel={() => setConfirmId(null)} /> : canEdit ? (
                      <span className="inline-flex gap-3 justify-end">
                        {p.status === 'draft' && <button onClick={() => markPaid(p.id)} style={{ color: C.teal }}><CheckCircle2 size={14} /></button>}
                        <button onClick={() => setConfirmId(p.id)} style={{ color: C.textDim }}><Trash2 size={14} /></button>
                      </span>
                    ) : <span style={{ color: C.textFaint }}>—</span>}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

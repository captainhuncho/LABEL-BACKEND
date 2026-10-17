import { ClipboardList, DollarSign, Pencil, Plus, Trash2, TrendingUp, Wallet } from 'lucide-react';
import { useState } from 'react';
import { formatCurrency, formatDate, monthLabel, todayStr } from '../constants.js';
import { companyFinanceTotals, revByMonth, monthRange } from '../finance.js';
import { C } from '../theme.js';
import { Btn, ConfirmInline, EmptyState, Field, Input, KPICard, SectionHeader, Td, Th } from '../ui.jsx';

export function MasterGrossSection({ masterGross, update, roster, revenue, labelSettings, updateLabelSettings, canEdit = true }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const empty = { month: todayStr().slice(0, 7), periodStart: '', remittanceId: '', paidOn: '', receivedOn: '', totalGross: '', swiftFee: String(labelSettings.swiftFee) };
  const [form, setForm] = useState(empty);
  const [confirmId, setConfirmId] = useState(null);
  const [feeInput, setFeeInput] = useState(String(labelSettings.swiftFee));

  function openAdd() { setForm({ ...empty, swiftFee: String(labelSettings.swiftFee) }); setEditing(null); setShowForm(true); }
  function openEdit(g) { setForm({ month: g.month, periodStart: g.periodStart || '', remittanceId: g.remittanceId || '', paidOn: g.paidOn || '', receivedOn: g.receivedOn || '', totalGross: String(g.totalGross), swiftFee: String(g.swiftFee) }); setEditing(g.id); setShowForm(true); }
  function closeForm() { setShowForm(false); setEditing(null); }
  function save(e) {
    e.preventDefault();
    const totalGross = Number(form.totalGross);
    const swiftFee = Number(form.swiftFee);
    if (!form.month || totalGross < 0 || swiftFee < 0) return;
    // month = the statement month this money pays for (what everything matches on); the dates are records only.
    const periodStart = form.periodStart && form.periodStart < form.month ? form.periodStart : '';
    const payload = { id: form.month, month: form.month, periodStart, remittanceId: form.remittanceId.trim(), paidOn: form.paidOn || '', receivedOn: form.receivedOn || '', totalGross, swiftFee };
    if (editing) update(masterGross.map(g => g.id === editing ? payload : g));
    // A new entry replaces any entry for a month it now covers.
    else update([...masterGross.filter(g => !monthRange(periodStart || form.month, form.month).includes(g.month)), payload]);
    closeForm();
  }
  function remove(id) { update(masterGross.filter(g => g.id !== id)); setConfirmId(null); }
  function saveFee(e) {
    e.preventDefault();
    const fee = Number(feeInput);
    if (fee < 0) return;
    updateLabelSettings({ ...labelSettings, swiftFee: fee });
  }

  const sorted = [...masterGross].sort((a, b) => b.month.localeCompare(a.month));
  const totals = companyFinanceTotals(roster, revenue, masterGross);

  return (
    <div>
      <SectionHeader title="Money received" artistNote="never the label’s totals. Only their share of each month’s Inbound Banking Charge, fixed when their earnings are published." description="One row per statement month, company-wide: the real money the distributor paid for that statement (usually arriving the month after), and the flat inbound banking charge split proportionally across every artist who earned that month." action={canEdit && <Btn variant="primary" onClick={openAdd}><Plus size={14} /> Log month</Btn>} />

      <div className="flex flex-wrap gap-3 mb-6">
        <KPICard icon={DollarSign} label="Total gross (all months)" value={formatCurrency(totals.totalGross)} tone="teal" />
        <KPICard icon={Wallet} label="Total inbound banking charges" value={formatCurrency(totals.totalSwift)} />
        <KPICard icon={TrendingUp} label="Tracked gross (revenue rows)" value={formatCurrency(totals.trackedGross)} />
        <KPICard icon={ClipboardList} label="Untracked gap" value={formatCurrency(totals.untrackedGap)} tone={Math.abs(totals.untrackedGap) > 0.01 ? 'amber' : 'teal'} sub={Math.abs(totals.untrackedGap) > 0.01 ? 'Reconciliation flag, not an error' : 'Fully reconciled'} />
      </div>

      {canEdit && (
        <form onSubmit={saveFee} className="rounded border p-4 mb-6 flex items-end gap-3 flex-wrap" style={{ background: C.panel, borderColor: C.border }}>
          <Field label="Default inbound banking charge for new months (USD)"><Input type="number" min="0" step="0.01" value={feeInput} onChange={e => setFeeInput(e.target.value)} style={{ maxWidth: 160 }} /></Field>
          <Btn variant="ghost" type="submit">Save default</Btn>
        </form>
      )}

      {showForm && (
        <form onSubmit={save} className="rounded border p-4 mb-6 imss-form-grid gap-3" style={{ background: C.panel, borderColor: C.borderLight }}>
          <Field label="Statement month it pays for"><Input type="month" required value={form.month} onChange={e => setForm({ ...form, month: e.target.value })} disabled={!!editing} /></Field>
          <Field label="Carried forward from (optional)"><Input type="month" value={form.periodStart} max={form.month} onChange={e => setForm({ ...form, periodStart: e.target.value })} /></Field>
          <div className="imss-span-2 text-xs" style={{ color: C.textDim, marginTop: -4 }}>If EMPIRE held earlier months back (under its $300 minimum) and paid them in this one payment, pick the first month it covers. The amount and the single charge are spread across those months by what each earned.</div>
          <Field label="Remittance ID"><Input value={form.remittanceId} onChange={e => setForm({ ...form, remittanceId: e.target.value })} placeholder="e.g. JAN26-16344-21056" /></Field>
          <Field label="Money sent (EMPIRE payment date)"><Input type="date" value={form.paidOn} onChange={e => setForm({ ...form, paidOn: e.target.value })} /></Field>
          <Field label="Money received (bank credit date)"><Input type="date" value={form.receivedOn} onChange={e => setForm({ ...form, receivedOn: e.target.value })} /></Field>
          <Field label="Total gross received (USD)"><Input type="number" min="0" step="0.01" required value={form.totalGross} onChange={e => setForm({ ...form, totalGross: e.target.value })} /></Field>
          <Field label="Inbound Banking Charge (USD)"><Input type="number" min="0" step="0.01" required value={form.swiftFee} onChange={e => setForm({ ...form, swiftFee: e.target.value })} /></Field>
          <div className="imss-span-2 flex gap-2 mt-1">
            <Btn variant="primary" type="submit">{editing ? 'Save changes' : 'Log month'}</Btn>
            <Btn variant="ghost" onClick={closeForm}>Cancel</Btn>
          </div>
        </form>
      )}

      {sorted.length === 0 ? (
        <EmptyState icon={DollarSign} title="No months logged yet" description="Log the distributor's real gross and inbound banking charge for a month to start splitting it across artists." />
      ) : (
        <div className="rounded border overflow-x-auto" style={{ borderColor: C.border, background: C.panel }}>
          <table className="w-full" style={{ minWidth: 620 }}>
            <thead><tr><Th>Statement month</Th><Th>Remittance</Th><Th>Money sent</Th><Th>Money received</Th><Th align="right">Total gross</Th><Th align="right">Inbound Banking Charge</Th><Th align="right">Net received</Th><Th align="right">Tracked revenue</Th><Th align="right">Actions</Th></tr></thead>
            <tbody>
              {sorted.map(g => {
                const trackedThisMonth = monthRange(g.periodStart || g.month, g.month).reduce((t, m) => t + (revByMonth(revenue)[m] || 0), 0);
                const gap = g.totalGross - trackedThisMonth;
                return (
                  <tr key={g.id}>
                    <Td mono>{g.periodStart ? monthLabel(g.periodStart) + ' – ' : ''}{monthLabel(g.month)}{g.periodStart && <div className="text-xs" style={{ color: C.textDim, fontFamily: 'inherit' }}>Carried forward, paid together</div>}</Td>
                    <Td><span className="text-xs" style={{ color: C.textDim }}>{g.remittanceId || '—'}</span></Td>
                    <Td mono>{formatDate(g.paidOn)}</Td>
                    <Td mono>{g.receivedOn ? formatDate(g.receivedOn) : <span className="text-xs" style={{ color: C.textDim }}>Date not recorded</span>}</Td>
                    <Td align="right" mono>{formatCurrency(g.totalGross)}</Td>
                    <Td align="right" mono>{formatCurrency(g.swiftFee)}</Td>
                    <Td align="right" mono>{formatCurrency(g.totalGross - g.swiftFee)}</Td>
                    <Td align="right" mono>{formatCurrency(trackedThisMonth)}{Math.abs(gap) > 0.01 && <span style={{ color: C.amber }}> ({gap > 0 ? '+' : ''}{formatCurrency(gap)})</span>}</Td>
                    <Td align="right">
                      {confirmId === g.id ? <ConfirmInline onConfirm={() => remove(g.id)} onCancel={() => setConfirmId(null)} /> : canEdit ? (
                        <span className="inline-flex gap-3 justify-end">
                          <button aria-label="Edit" title="Edit" onClick={() => openEdit(g)} style={{ color: C.textDim }}><Pencil size={14} /></button>
                          <button aria-label="Delete" title="Delete" onClick={() => setConfirmId(g.id)} style={{ color: C.textDim }}><Trash2 size={14} /></button>
                        </span>
                      ) : <span style={{ color: C.textFaint }}>—</span>}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

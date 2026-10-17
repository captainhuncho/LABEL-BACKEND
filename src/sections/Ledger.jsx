import { ClipboardList, DollarSign, Pencil, Plus, Trash2, TrendingUp, Wallet } from 'lucide-react';
import { useMemo, useState } from 'react';
import { catLabel } from './Budget.jsx';
import { LEDGER_CATEGORIES, formatCurrency, formatDate, todayStr, uid } from '../constants.js';
import { ledgerTotals, recoupmentForArtist } from '../finance.js';
import { C } from '../theme.js';
import { Badge, Btn, ConfirmInline, EmptyState, ExportBar, Field, Input, KPICard, SectionHeader, Select, Td, Th } from '../ui.jsx';

export function LedgerSection({ invoices = [], ledger: rawLedger, update, roster: fullRoster, revenue, masterGross, canEdit = true, isAdmin = false, sessionName = '', pmScope = null, overheads = [], approver = false }) {
  // A Product Manager only sees the ledger for the artists they manage — never
  // company-wide overhead, and never another PM's roster.
  const roster = useMemo(() => pmScope ? fullRoster.filter(a => a.productManager === pmScope) : fullRoster, [fullRoster, pmScope]);
  const scopedNames = useMemo(() => new Set(roster.map(a => a.name)), [roster]);
  const ledger = useMemo(() => pmScope ? rawLedger.filter(l => l.artist && scopedNames.has(l.artist)) : rawLedger, [rawLedger, pmScope, scopedNames]);
  const empty = { type: 'expense', artist: '', category: LEDGER_CATEGORIES[0], description: '', amount: '', date: todayStr(), recoupable: false, enteredBy: '', overheadId: '', categoryId: '' };
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [confirmId, setConfirmId] = useState(null);
  const [filterArtist, setFilterArtist] = useState('all');
  // Would this expense take its budget category, or the whole overhead, over?
  function overBudget(entry) {
    const o = overheads.find(x => x.id === entry.overheadId);
    if (!o) return '';
    const others = rawLedger.filter(l => l.id !== entry.id && l.type === 'expense' && l.overheadId === o.id && (l.approvalStatus || 'Approved') !== 'Rejected');
    const claims = invoices.filter(i => i.kind === 'expense' && i.overheadId === o.id && ['Pay Approved', 'Paid'].includes(i.status));
    const spent = others.reduce((t, l) => t + (Number(l.amount) || 0), 0) + claims.reduce((t, i) => t + (Number(i.amount) || 0), 0);
    if (spent + entry.amount > o.total + 1e-9) return 'This takes ' + o.title + ' over its ' + formatCurrency(o.total) + ' total.';
    const cat = (o.categories || []).find(c => c.id === entry.categoryId);
    if (cat) {
      const catSpent = others.filter(l => l.categoryId === cat.id).reduce((t, l) => t + (Number(l.amount) || 0), 0) + claims.filter(i => i.categoryId === cat.id).reduce((t, i) => t + (Number(i.amount) || 0), 0);
      if (catSpent + entry.amount > cat.allocated + 1e-9) return 'This takes ' + cat.category + ' over its ' + formatCurrency(cat.allocated) + '.';
    }
    return '';
  }
  const [filterType, setFilterType] = useState('all');

  function openAdd() { setForm(empty); setEditing(null); setShowForm(true); }
  function openEdit(x) { setForm({ type: x.type, artist: x.artist || '', category: x.category, description: x.description || '', amount: String(x.amount), date: x.date, recoupable: !!x.recoupable, enteredBy: x.enteredBy || '', overheadId: x.overheadId || '', categoryId: x.categoryId || '' }); setEditing(x.id); setShowForm(true); }
  function closeForm() { setShowForm(false); setEditing(null); }
  function save(e) {
    e.preventDefault();
    const amt = Number(form.amount);
    if (!amt || amt <= 0) return;
    // Over budget: only someone who can approve budgets enters it straight away;
    // anyone else's waits (it always does for non-Admins) and is flagged.
    const over = form.type === 'expense' ? overBudget({ ...form, amount: amt, id: editing }) : '';
    const approval = isAdmin
      ? { approvalStatus: 'Approved', approvedBy: sessionName, approvedAt: todayStr() }
      : { approvalStatus: 'Pending', approvedBy: '', approvedAt: '' };
    const attach = form.type === 'expense' && form.overheadId ? { overheadId: form.overheadId, categoryId: form.categoryId || '' } : { overheadId: '', categoryId: '' };
    const payload = { ...form, ...attach, artist: form.artist || null, amount: amt, recoupable: form.type === 'expense' && !!form.recoupable, createdAt: Date.parse(form.date) || Date.now(), overBudget: over || '', ...approval };
    // Always write to the full ledger: a PM sees only their artists' rows, but the save is the whole list.
    if (editing) update(rawLedger.map(x => x.id === editing ? { ...payload, id: editing } : x));
    else update([...rawLedger, { ...payload, id: uid() }]);
    closeForm();
  }
  function remove(id) { update(rawLedger.filter(x => x.id !== id)); setConfirmId(null); }
  function approveEntry(id) { update(rawLedger.map(x => x.id === id ? { ...x, approvalStatus: 'Approved', approvedBy: sessionName, approvedAt: todayStr() } : x)); }
  function rejectEntry(id) { update(rawLedger.map(x => x.id === id ? { ...x, approvalStatus: 'Rejected', approvedBy: sessionName, approvedAt: todayStr() } : x)); }

  const approvedLedger = useMemo(() => ledger.filter(x => (x.approvalStatus || 'Approved') === 'Approved'), [ledger]);
  const recoupmentByArtist = useMemo(() => roster.map(a => ({ artist: a, ...recoupmentForArtist(a, approvedLedger, revenue, masterGross, invoices) })).filter(r => r.spent > 0), [invoices, roster, approvedLedger, revenue, masterGross]);

  const filtered = ledger.filter(x => {
    if (filterArtist !== 'all' && (filterArtist === '__general__' ? x.artist : x.artist !== filterArtist)) return false;
    if (filterType !== 'all' && x.type !== filterType) return false;
    return true;
  });
  const sorted = [...filtered].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const totals = ledgerTotals(filtered.filter(x => (x.approvalStatus || 'Approved') === 'Approved'));
  const totalRecoupable = filtered.filter(x => x.type === 'expense' && x.artist).reduce((s, x) => s + x.amount, 0);
  const pendingCount = ledger.filter(x => x.approvalStatus === 'Pending').length;

  return (
    <div>
      <SectionHeader title="Expenses & income" artistNote="approved expenses recorded against their name, in their Expenses tab. Recoupable ones reduce what they’re due." description="Non-royalty income and expenses — advances, recording costs, marketing spend, and anything else that isn't distributor revenue. Recoupable expenses reduce what an artist is due until their share covers them." action={canEdit && <Btn variant="primary" onClick={openAdd}><Plus size={14} /> Add entry</Btn>} />

      <div className="flex flex-wrap gap-3 mb-6">
        <KPICard icon={TrendingUp} label="Income" value={formatCurrency(totals.income)} tone="teal" />
        <KPICard icon={Wallet} label="Expense" value={formatCurrency(totals.expense)} />
        <KPICard icon={DollarSign} label="Net" value={formatCurrency(totals.net)} tone={totals.net < 0 ? 'red' : 'teal'} />
        <KPICard icon={ClipboardList} label="Pending approval" value={pendingCount} tone={pendingCount ? 'amber' : undefined} />
      </div>

      {!isAdmin && pendingCount > 0 && (
        <div className="rounded px-3 py-2 text-xs mb-6" style={{ background: C.amberSoft, color: C.amber, border: '1px solid ' + C.amber }}>
          Entries you log need Admin approval before they count toward recoupment or the label P&amp;L.
        </div>
      )}

      <div className="rounded border p-4 mb-6" style={{ background: C.panel, borderColor: C.border }}>
        <div className="imss-form-grid gap-3">
          <Field label="Type">
            <Select value={filterType} onChange={e => setFilterType(e.target.value)}>
              <option value="all">Income + expense</option>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
            </Select>
          </Field>
          <Field label="Artist">
            <Select value={filterArtist} onChange={e => setFilterArtist(e.target.value)}>
              <option value="all">All artists</option>
              <option value="__general__">Label Ops (no artist)</option>
              {roster.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
            </Select>
          </Field>
        </div>
      </div>

      {showForm && (
        <form onSubmit={save} className="rounded border p-4 mb-6 imss-form-grid gap-3" style={{ background: C.panel, borderColor: C.borderLight }}>
          <Field label="Type">
            <Select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </Select>
          </Field>
          <Field label="Artist (optional)">
            <Select value={form.artist} onChange={e => setForm({ ...form, artist: e.target.value })}>
              <option value="">Label Ops (no artist)</option>
              {roster.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
            </Select>
          </Field>
          <Field label="Category">
            <Select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
              {LEDGER_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
          </Field>
          {form.type === 'expense' && (() => {
            // Attach to a budget overhead: the chosen artist's active ones, or label running costs.
            const artistId = (fullRoster.find(a => a.name === form.artist) || {}).id;
            const choices = overheads.filter(o => o.status === 'Active' && (form.artist ? o.kind === 'artist' && o.artistId === artistId : o.kind === 'label'));
            const chosen = overheads.find(o => o.id === form.overheadId);
            return <>
              <Field label="Budget (optional)">
                <Select value={form.overheadId} onChange={e => setForm({ ...form, overheadId: e.target.value, categoryId: '' })}>
                  <option value="">Not attached</option>
                  {choices.map(o => <option key={o.id} value={o.id}>{o.title}</option>)}
                  {chosen && !choices.includes(chosen) && <option value={chosen.id}>{chosen.title} ({chosen.status})</option>}
                </Select>
              </Field>
              {chosen && <Field label="Budget category">
                <Select value={form.categoryId} onChange={e => setForm({ ...form, categoryId: e.target.value })}>
                  <option value="">Unallocated</option>
                  {(chosen.categories || []).map(c => <option key={c.id} value={c.id}>{catLabel(c)}</option>)}
                </Select>
              </Field>}
              {chosen && overBudget({ ...form, amount: Number(form.amount) || 0, id: editing }) && <div className="imss-span-2" role="alert" style={{ color: C.red, fontSize: 14 }}>{overBudget({ ...form, amount: Number(form.amount) || 0, id: editing })} {approver ? 'You can approve this.' : 'It waits for an Admin to approve the overspend.'}</div>}
            </>;
          })()}
          <Field label="Amount (USD)"><Input type="number" min="0" step="0.01" required value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></Field>
          <Field label="Date"><Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></Field>
          <Field label="Description" full><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="e.g. Studio time for Afterglow" /></Field>
          {form.type === 'expense' && (
            <div className="imss-span-2" style={{ color: C.textDim, fontSize: 14 }}>{form.artist ? 'Recorded against ' + form.artist + ', so it’s recouped from their earnings and counts against their budget.' : 'No artist chosen: a label cost, not recouped from anyone.'}</div>
          )}
          {form.type === 'income' && form.category === 'Cash repayment' && (
            <div className="imss-span-2" style={{ color: C.textDim, fontSize: 14 }}>{form.artist ? 'Cash ' + form.artist + ' paid back at the label’s request. It settles their recoupable spend; their earnings aren’t touched.' : 'Choose the artist who paid the cash back.'}</div>
          )}
          <Field label="Entered by"><Input value={form.enteredBy} onChange={e => setForm({ ...form, enteredBy: e.target.value })} placeholder="Your name" /></Field>
          <div className="imss-span-2 flex gap-2 mt-1">
            <Btn variant="primary" type="submit">{editing ? 'Save changes' : 'Add entry'}</Btn>
            <Btn variant="ghost" onClick={closeForm}>Cancel</Btn>
          </div>
        </form>
      )}

      <ExportBar filename="imss-ledger" headers={['Date', 'Type', 'Artist', 'Category', 'Description', 'Recoupable', 'Amount']} rows={sorted.map(x => [x.date, x.type, x.artist || 'Label Ops', x.category, x.description || '', x.type === 'expense' && x.artist ? 'Yes' : 'No', x.amount])} />

      <div className="text-xs mb-3" style={{ color: C.textFaint }}>Recoupment status by artist</div>
      {recoupmentByArtist.length === 0 ? (
        <EmptyState icon={Wallet} title="Nothing to recoup yet" description="Expenses recorded against an artist, and their approved expense claims, show here as the artist earns them back." />
      ) : (
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
      )}

      <div className="text-xs mb-3" style={{ color: C.textFaint }}>Entry log</div>
      {sorted.length === 0 ? (
        <EmptyState icon={DollarSign} title="No ledger entries recorded" description="Add a recording cost, advance, marketing spend, or non-royalty income to start tracking it." />
      ) : (
        <div className="rounded border overflow-x-auto" style={{ borderColor: C.border, background: C.panel }}>
          <table className="w-full" style={{ minWidth: 720 }}>
            <thead><tr><Th>Date</Th><Th>Type</Th><Th>Artist</Th><Th>Category</Th><Th>Description</Th><Th>Recoupable</Th><Th align="right">Amount</Th><Th>Approval</Th><Th align="right">Actions</Th></tr></thead>
            <tbody>
              {sorted.map(x => {
                const approval = x.approvalStatus || 'Approved';
                return (
                  <tr key={x.id} data-focus={x.id}>
                    <Td mono>{formatDate(x.date)}</Td>
                    <Td><Badge tone={x.type === 'income' ? 'teal' : 'default'}>{x.type}</Badge></Td>
                    <Td>{x.artist || 'Label Ops'}</Td>
                    <Td><Badge>{x.category}</Badge></Td>
                    <Td>{x.description || '—'}</Td>
                    <Td>{x.type === 'expense' && x.artist ? <Badge tone="amber">Yes</Badge> : <Badge>No</Badge>}</Td>
                    <Td align="right" mono>{formatCurrency(x.amount)}</Td>
                    <Td>
                      <Badge tone={approval === 'Approved' ? 'teal' : approval === 'Rejected' ? 'red' : 'amber'}>{approval}</Badge>
                      {x.overBudget && approval === 'Pending' && <span className="ml-1"><Badge tone="red">Over budget</Badge></span>}
                      {isAdmin && approval === 'Pending' && (
                        <span className="inline-flex gap-2 ml-2">
                          <button onClick={() => approveEntry(x.id)} className="text-xs" style={{ color: C.teal }}>Approve</button>
                          <button onClick={() => rejectEntry(x.id)} className="text-xs" style={{ color: C.red }}>Reject</button>
                        </span>
                      )}
                    </Td>
                    <Td align="right">
                      {confirmId === x.id ? <ConfirmInline onConfirm={() => remove(x.id)} onCancel={() => setConfirmId(null)} /> : canEdit ? (
                        <span className="inline-flex gap-3 justify-end">
                          <button onClick={() => openEdit(x)} style={{ color: C.textDim }}><Pencil size={14} /></button>
                          <button onClick={() => setConfirmId(x.id)} style={{ color: C.textDim }}><Trash2 size={14} /></button>
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

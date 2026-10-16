import { DollarSign, Pencil, Plus, Trash2, Users, Wallet } from 'lucide-react';
import { useMemo, useState } from 'react';
import { LEDGER_CATEGORIES, formatCurrency, uid } from '../constants.js';
import { C, MONO_FONT } from '../theme.js';
import { Badge, Btn, ConfirmInline, EmptyState, Field, Input, KPICard, SectionHeader, Select } from '../ui.jsx';

export function BudgetSection({ labelBudgets, update, ledger, roster, canEdit = true }) {
  const expenses = useMemo(() => ledger.filter(x => x.type === 'expense'), [ledger]);
  const empty = { category: LEDGER_CATEGORIES[0], allocated: '' };
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [confirmId, setConfirmId] = useState(null);

  function openAdd() { setForm(empty); setEditing(null); setShowForm(true); }
  function openEdit(b) { setForm({ ...b, allocated: String(b.allocated) }); setEditing(b.id); setShowForm(true); }
  function closeForm() { setShowForm(false); setEditing(null); }
  function save(e) {
    e.preventDefault();
    const amt = Number(form.allocated);
    if (!amt || amt < 0) return;
    const payload = { ...form, allocated: amt };
    if (editing) update(labelBudgets.map(b => b.id === editing ? { ...payload, id: editing } : b));
    else update([...labelBudgets, { ...payload, id: uid() }]);
    closeForm();
  }
  function remove(id) { update(labelBudgets.filter(b => b.id !== id)); setConfirmId(null); }

  const categoriesWithBudget = new Set(labelBudgets.map(b => b.category));
  const availableCategories = LEDGER_CATEGORIES.filter(c => editing ? true : !categoriesWithBudget.has(c));

  const spendByCategory = useMemo(() => {
    const map = {};
    expenses.forEach(x => { map[x.category] = (map[x.category] || 0) + x.amount; });
    return map;
  }, [expenses]);

  const rows = labelBudgets.map(b => {
    const spent = spendByCategory[b.category] || 0;
    const remaining = b.allocated - spent;
    const pct = b.allocated > 0 ? Math.min(100, Math.round((spent / b.allocated) * 100)) : 0;
    return { ...b, spent, remaining, pct };
  }).sort((a, b) => b.allocated - a.allocated);

  const totalAllocated = labelBudgets.reduce((s, b) => s + b.allocated, 0);
  const totalSpentAcrossBudgeted = rows.reduce((s, r) => s + r.spent, 0);
  const totalSpentOverall = expenses.reduce((s, x) => s + x.amount, 0);
  const unbudgetedSpend = totalSpentOverall - totalSpentAcrossBudgeted;
  const artistTiedSpend = expenses.filter(x => x.artist).reduce((s, x) => s + x.amount, 0);
  const labelOpsSpend = totalSpentOverall - artistTiedSpend;

  return (
    <div>
      <SectionHeader title="Budget" artistNote="nothing. Budgets are internal." description="Label-wide budget planning by category, tracked against everything logged in Expenses — artist-specific and label operations alike. Visible to team members only." action={canEdit && <Btn variant="primary" onClick={openAdd}><Plus size={14} /> Allocate budget</Btn>} />

      <div className="flex flex-wrap gap-3 mb-6">
        <KPICard icon={DollarSign} label="Total allocated" value={formatCurrency(totalAllocated)} />
        <KPICard icon={DollarSign} label="Spent (budgeted categories)" value={formatCurrency(totalSpentAcrossBudgeted)} tone="amber" />
        <KPICard icon={Wallet} label="Remaining" value={formatCurrency(totalAllocated - totalSpentAcrossBudgeted)} tone={(totalAllocated - totalSpentAcrossBudgeted) < 0 ? 'red' : 'teal'} />
        <KPICard icon={Users} label="Artist-tied spend" value={formatCurrency(artistTiedSpend)} sub={formatCurrency(labelOpsSpend) + ' label ops'} />
      </div>

      {showForm && (
        <form onSubmit={save} className="rounded border p-4 mb-6 imss-form-grid gap-3" style={{ background: C.panel, borderColor: C.borderLight }}>
          <Field label="Category">
            <Select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} disabled={!!editing}>
              {availableCategories.map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Allocated amount"><Input type="number" min="0" step="0.01" value={form.allocated} onChange={e => setForm({ ...form, allocated: e.target.value })} /></Field>
          <div className="imss-span-2 flex gap-2 mt-1">
            <Btn variant="primary" type="submit">{editing ? 'Save changes' : 'Add allocation'}</Btn>
            <Btn variant="ghost" onClick={closeForm}>Cancel</Btn>
          </div>
        </form>
      )}

      {rows.length === 0 ? (
        <EmptyState icon={DollarSign} title="No budget allocated yet" description="Set an allocation per category to start tracking spend against it." />
      ) : (
        <div className="flex flex-col gap-3 mb-6">
          {rows.map(r => (
            <div key={r.id} className="rounded border p-4" style={{ background: C.panel, borderColor: C.border }}>
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Badge>{r.category}</Badge>
                  {r.pct >= 100 && <Badge tone="red">Over budget</Badge>}
                  {r.pct >= 80 && r.pct < 100 && <Badge tone="amber">Nearly spent</Badge>}
                </div>
                <div className="text-xs" style={{ color: C.textFaint }}>{formatCurrency(r.spent)} of {formatCurrency(r.allocated)} spent</div>
              </div>
              <div className="rounded-full overflow-hidden" style={{ height: 8, background: C.panel2 }}>
                <div style={{ height: 8, width: r.pct + '%', background: r.remaining < 0 ? C.red : C.amber }} />
              </div>
              <div className="flex items-center justify-between mt-2">
                <div className="text-xs" style={{ color: C.textFaint }}>Remaining: <span style={{ color: r.remaining < 0 ? C.red : C.teal, fontFamily: MONO_FONT }}>{formatCurrency(r.remaining)}</span></div>
                {canEdit && (
                  confirmId === r.id ? <ConfirmInline onConfirm={() => remove(r.id)} onCancel={() => setConfirmId(null)} /> : (
                    <span className="inline-flex gap-3">
                      <button onClick={() => openEdit(r)} style={{ color: C.textDim }}><Pencil size={14} /></button>
                      <button onClick={() => setConfirmId(r.id)} style={{ color: C.textDim }}><Trash2 size={14} /></button>
                    </span>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {unbudgetedSpend > 0 && (
        <div className="rounded px-3 py-2 text-xs" style={{ background: C.amberSoft, color: C.amber, border: '1px solid ' + C.amber }}>
          {formatCurrency(unbudgetedSpend)} has been spent in categories with no budget allocation yet — add an allocation above to start tracking it.
        </div>
      )}
    </div>
  );
}

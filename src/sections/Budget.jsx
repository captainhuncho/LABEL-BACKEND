// Budgets: one overhead per artist product (a release, or an album with its
// singles carved out of it), or a "Label" overhead for running costs.
// An overhead has a total and categories that draw it down; what's not yet
// assigned shows as Unallocated. Spend attaches to an overhead + category
// (ledger expenses and approved expense claims with overheadId/categoryId);
// only money actually spent is recouped from the artist, never unspent budget.
// Admin creates and changes overheads directly; anyone else's create or change
// waits for an Admin (or someone an Admin let approve budgets). Admin closes an
// overhead when the product is done: no new spend, history kept.
import { CheckCircle2, ChevronLeft, Lock, Plus, Trash2, Wallet, XCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { LEDGER_CATEGORIES, formatCurrency, formatDate, uid } from '../constants.js';
import { logActivity } from '../audit.js';
import { C } from '../theme.js';
import { Badge, Btn, EmptyState, Field, Input, KPICard, SectionHeader, Select, TextArea } from '../ui.jsx';

const CATS = LEDGER_CATEGORIES.filter(c => c !== 'Cash repayment');
const TONE = { Active: 'teal', Pending: 'amber', Closed: 'default', Rejected: 'red' };
const money = n => formatCurrency(Number(n) || 0);
const sum = (xs, f) => xs.reduce((s, x) => s + (Number(f(x)) || 0), 0);
const now = () => new Date().toISOString();

// Spend attached to an overhead: approved ledger expenses plus expense claims at
// Pay Approved / Paid (the same claims recoupment counts).
export function overheadSpend(o, ledger = [], invoices = []) {
  const rows = [
    ...ledger.filter(l => l.type === 'expense' && l.overheadId === o.id && (l.approvalStatus || 'Approved') === 'Approved').map(l => ({ categoryId: l.categoryId, amount: Number(l.amount) || 0 })),
    ...invoices.filter(i => i.kind === 'expense' && i.overheadId === o.id && ['Pay Approved', 'Paid'].includes(i.status)).map(i => ({ categoryId: i.categoryId, amount: Number(i.amount) || 0 })),
  ];
  const byCat = {};
  rows.forEach(r => { byCat[r.categoryId || ''] = (byCat[r.categoryId || ''] || 0) + r.amount; });
  return { total: sum(rows, r => r.amount), byCat };
}

export function canApproveBudgets(session, staff = []) {
  if (!session || session.mode !== 'team') return false;
  if (session.role === 'Admin') return true;
  const me = staff.find(m => m.name === session.name);
  return !!(me && me.canApproveBudgets); // an Admin can grant this, e.g. to Legal
}

export function BudgetSection({ overheads = [], update, roster = [], catalog = [], staff = [], ledger = [], invoices = [], session = {}, canEdit = true }) {
  const approver = canApproveBudgets(session, staff);
  const [statusFilter, setStatusFilter] = useState('open');
  const [artistFilter, setArtistFilter] = useState('');
  const [openId, setOpenId] = useState(null);
  const [form, setForm] = useState(null); // create or edit draft
  const artistName = id => (roster.find(a => a.id === id) || {}).name || 'Unknown artist';

  const shown = useMemo(() => overheads
    .filter(o => statusFilter === 'all' ? true : statusFilter === 'open' ? ['Active', 'Pending'].includes(o.status) : o.status === statusFilter)
    .filter(o => !artistFilter || (artistFilter === 'label' ? o.kind === 'label' : o.artistId === artistFilter))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))), [overheads, statusFilter, artistFilter]);

  const active = overheads.filter(o => o.status === 'Active');
  const waiting = overheads.filter(o => o.status === 'Pending' || o.pendingChange).length;
  const committed = sum(active, o => o.total);
  const spentActive = sum(active, o => overheadSpend(o, ledger, invoices).total);
  const unallocated = sum(active, o => o.total - sum(o.categories || [], c => c.allocated));

  function save(next, verb) { update(next); logActivity(verb, ''); }
  function stamp(o, entry) { return { ...o, history: [...(o.history || []), { at: now(), by: session.name, ...entry }] }; }

  // ---- create / edit ----
  function newForm() { setForm({ id: null, kind: 'artist', artistId: '', title: '', releaseIds: [], parentId: '', total: '', categories: [{ id: uid(), category: 'Recording', allocated: '' }], note: '' }); }
  function editForm(o) { setForm({ ...o, total: String(o.total), categories: (o.categories || []).map(c => ({ ...c, allocated: String(c.allocated) })), note: '' }); }
  function formProblem(f) {
    const total = Number(f.total);
    if (!f.title.trim()) return 'Give it a name, e.g. the release title.';
    if (f.kind === 'artist' && !f.artistId) return 'Choose the artist.';
    if (!(total > 0)) return 'Enter the total budget.';
    const allocated = sum(f.categories, c => c.allocated);
    if (allocated > total + 1e-9) return 'Categories add up to ' + money(allocated) + ', more than the ' + money(total) + ' total.';
    if (f.parentId) {
      const parent = overheads.find(o => o.id === f.parentId);
      const siblings = overheads.filter(o => o.parentId === f.parentId && o.id !== f.id && o.status !== 'Rejected');
      if (parent && sum(siblings, o => o.total) + total > parent.total + 1e-9) return 'Singles carved from ' + parent.title + ' would add up to more than its ' + money(parent.total) + ' total.';
    }
    return '';
  }
  function submit(e) {
    e.preventDefault();
    if (formProblem(form)) return;
    const artist = roster.find(a => a.id === form.artistId);
    const clean = {
      kind: form.kind, artistId: form.kind === 'artist' ? form.artistId : '', title: form.title.trim(),
      releaseIds: form.kind === 'artist' ? form.releaseIds : [], parentId: form.parentId || '', total: Number(form.total),
      categories: form.categories.filter(c => c.category).map(c => ({ id: c.id || uid(), category: c.category, allocated: Number(c.allocated) || 0 })),
      // The deal term in force when it was set up (non-funded artists included).
      dealTerm: form.dealTerm || (artist ? { artistPct: artist.artistPct, fundingTier: artist.fundingTier || 'Non-Funded', dealType: artist.dealType || '', at: now() } : null),
    };
    if (!form.id) {
      const o = stamp({ id: uid(), ...clean, status: approver ? 'Active' : 'Pending', createdBy: session.name, createdAt: now(), ...(approver ? { approvedBy: session.name, approvedAt: now() } : {}) }, { action: approver ? 'created' : 'proposed', note: form.note });
      save([o, ...overheads], approver ? 'created a budget overhead' : 'proposed a budget overhead');
      setOpenId(o.id);
    } else if (approver) {
      save(overheads.map(o => o.id !== form.id ? o : stamp({ ...o, ...clean, pendingChange: null }, { action: 'changed', note: form.note })), 'changed a budget overhead');
    } else {
      save(overheads.map(o => o.id !== form.id ? o : stamp({ ...o, pendingChange: { changes: clean, by: session.name, at: now(), note: form.note } }, { action: 'proposed a change', note: form.note })), 'proposed a budget change');
    }
    setForm(null);
  }

  // ---- approve / reject / close ----
  function decide(o, ok) {
    if (o.status === 'Pending') save(overheads.map(x => x.id !== o.id ? x : stamp({ ...x, status: ok ? 'Active' : 'Rejected', approvedBy: session.name, approvedAt: now() }, { action: ok ? 'approved' : 'rejected' })), ok ? 'approved a budget overhead' : 'rejected a budget overhead');
    else if (o.pendingChange) save(overheads.map(x => x.id !== o.id ? x : stamp({ ...x, ...(ok ? x.pendingChange.changes : {}), pendingChange: null }, { action: ok ? 'approved a change' : 'rejected a change' })), ok ? 'approved a budget change' : 'rejected a budget change');
  }
  function close(o) { save(overheads.map(x => x.id !== o.id ? x : stamp({ ...x, status: 'Closed', closedBy: session.name, closedAt: now() }, { action: 'closed: product ended' })), 'closed a budget overhead'); }
  function sendToArtist(o) { save(overheads.map(x => x.id !== o.id ? x : stamp({ ...x, sentToArtistAt: now(), sentToArtistBy: session.name }, { action: 'sent it to the artist’s dashboard' })), 'sent a budget to the artist'); }
  function reopen(o) { save(overheads.map(x => x.id !== o.id ? x : stamp({ ...x, status: 'Active', closedBy: '', closedAt: '' }, { action: 'reopened' })), 'reopened a budget overhead'); }

  if (form) return <OverheadForm form={form} setForm={setForm} submit={submit} problem={formProblem(form)} roster={roster} catalog={catalog} overheads={overheads} approver={approver} onCancel={() => setForm(null)} />;

  const open = overheads.find(o => o.id === openId);
  if (open) return <OverheadDetail o={open} ledger={ledger} invoices={invoices} artistName={artistName} catalog={catalog} overheads={overheads} spend={overheadSpend(open, ledger, invoices)} approver={approver} canEdit={canEdit}
    onBack={() => setOpenId(null)} onEdit={() => editForm(open)} onDecide={ok => decide(open, ok)} onClose={() => close(open)} onReopen={() => reopen(open)} canSend={session.role === 'Admin' || session.role === 'Legal'} onSend={() => sendToArtist(open)} />;

  return (
    <div>
      <SectionHeader title="Budget" artistNote="their own budgets, after an Admin or Legal sends them: totals, categories and the spend attached. Never label budgets or notes." description="One overhead per artist product: a total, split into categories, and the spend attached to it. Only money actually spent is recouped. An Admin closes it when the product is done." action={canEdit && <Btn variant="primary" onClick={newForm}><Plus size={14} /> New overhead</Btn>} />
      <div className="flex flex-wrap gap-3 mb-6">
        <KPICard icon={Wallet} label="Committed (active)" value={money(committed)} sub={active.length + ' active'} />
        <KPICard icon={Wallet} label="Spent (active)" value={money(spentActive)} tone="amber" />
        <KPICard icon={Wallet} label="Unallocated" value={money(unallocated)} tone="teal" />
        <KPICard icon={CheckCircle2} label="Waiting for approval" value={waiting} tone={waiting ? 'amber' : undefined} />
      </div>
      <div className="flex gap-2 flex-wrap mb-4">
        <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} aria-label="Status">
          <option value="open">Active and waiting</option><option value="Active">Active</option><option value="Pending">Waiting for approval</option><option value="Closed">Closed</option><option value="Rejected">Rejected</option><option value="all">All</option>
        </Select>
        <Select value={artistFilter} onChange={e => setArtistFilter(e.target.value)} aria-label="Artist">
          <option value="">All artists</option><option value="label">Label running costs</option>
          {roster.filter(a => a.status !== 'Archived').map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </Select>
      </div>
      {shown.length === 0 ? <EmptyState icon={Wallet} title={overheads.length ? 'Nothing matches' : 'No overheads yet'} description={overheads.length ? 'Try another status or artist.' : 'Create one for an artist’s release or product, split it into categories, then attach spend to it.'} /> : (
        <ul className="flex flex-col gap-2">
          {shown.map(o => {
            const allocated = sum(o.categories || [], c => c.allocated);
            const spent = overheadSpend(o, ledger, invoices).total;
            const pct = o.total > 0 ? Math.min(100, Math.round(spent / o.total * 100)) : 0;
            return (
              <li key={o.id}>
                <button onClick={() => setOpenId(o.id)} className="w-full text-left rounded p-4" style={{ background: C.panel }}>
                  <div className="flex items-baseline justify-between gap-3 flex-wrap">
                    <div style={{ fontWeight: 600, fontSize: 16 }}>{o.title} <span style={{ color: C.textDim, fontWeight: 400 }}>· {o.kind === 'label' ? 'Label running costs' : artistName(o.artistId)}</span></div>
                    <div style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{money(o.total)}</div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap mt-1.5 text-sm" style={{ color: C.textDim }}>
                    <Badge tone={TONE[o.status]}>{o.status === 'Pending' ? 'Waiting for approval' : o.status}</Badge>
                    {o.pendingChange && <Badge tone="amber">Change waiting</Badge>}
                    {o.parentId && <span>Part of {(overheads.find(p => p.id === o.parentId) || {}).title}</span>}
                    <span>{money(spent)} spent · {money(o.total - allocated)} unallocated</span>
                  </div>
                  <div className="mt-2" style={{ height: 6, borderRadius: 9999, background: 'var(--fill)', overflow: 'hidden' }}><div style={{ width: pct + '%', height: '100%', background: spent > o.total ? C.red : C.amberFill }} /></div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function OverheadForm({ form, setForm, submit, problem, roster, catalog, overheads, approver, onCancel }) {
  const set = patch => setForm(f => ({ ...f, ...patch }));
  const releases = catalog.filter(r => r.artistId === form.artistId);
  const parents = overheads.filter(o => o.kind === 'artist' && o.artistId === form.artistId && o.id !== form.id && !o.parentId && o.status !== 'Rejected' && o.status !== 'Closed');
  const allocated = sum(form.categories, c => c.allocated);
  const total = Number(form.total) || 0;
  return (
    <form onSubmit={submit}>
      <button type="button" onClick={onCancel} className="inline-flex items-center gap-1 mb-3" style={{ color: C.textDim }}><ChevronLeft size={16} /> Budget</button>
      <h1 className="imss-title">{form.id ? 'Change overhead' : 'New overhead'}</h1>
      {!approver && <p className="mb-4" style={{ color: C.amber, fontSize: 15 }}>An Admin approves this before it takes effect.</p>}
      <div className="rounded p-5 mb-4" style={{ background: C.panel }}>
        <div className="imss-form-grid gap-3">
          <Field label="For">
            <Select value={form.kind} onChange={e => set({ kind: e.target.value })} disabled={!!form.id}>
              <option value="artist">An artist’s product or release</option><option value="label">Label running costs</option>
            </Select>
          </Field>
          {form.kind === 'artist' && <Field label="Artist">
            <Select value={form.artistId} onChange={e => set({ artistId: e.target.value, releaseIds: [], parentId: '' })} disabled={!!form.id}>
              <option value="">Choose…</option>
              {roster.filter(a => a.status !== 'Archived').map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          </Field>}
          <Field label="Name"><Input value={form.title} onChange={e => set({ title: e.target.value })} placeholder={form.kind === 'label' ? 'e.g. Office and tools 2027' : 'e.g. Lagos Rain (single)'} /></Field>
          <Field label="Total budget"><Input type="number" min="0" step="0.01" inputMode="decimal" value={form.total} onChange={e => set({ total: e.target.value })} /></Field>
          {form.kind === 'artist' && form.artistId && parents.length > 0 && <Field label="Part of an album (optional)">
            <Select value={form.parentId} onChange={e => set({ parentId: e.target.value })}>
              <option value="">No, its own overhead</option>
              {parents.map(p => <option key={p.id} value={p.id}>{p.title} ({money(p.total)})</option>)}
            </Select>
          </Field>}
        </div>
        {form.kind === 'artist' && form.artistId && (
          <fieldset className="mt-4">
            <legend className="text-sm mb-2" style={{ color: C.textDim }}>Releases it covers</legend>
            {releases.length === 0 ? <p className="text-sm" style={{ color: C.textDim }}>No releases in Catalog yet for this artist. You can add them later.</p> : (
              <div className="flex flex-wrap gap-2">
                {releases.map(r => {
                  const on = form.releaseIds.includes(r.id);
                  return <button type="button" key={r.id} aria-pressed={on} onClick={() => set({ releaseIds: on ? form.releaseIds.filter(x => x !== r.id) : [...form.releaseIds, r.id] })} className="rounded" style={{ padding: '8px 12px', borderRadius: 980, background: on ? C.amberSoft : 'var(--fill)', color: on ? C.amber : C.text, fontSize: 14 }}>{r.title}</button>;
                })}
              </div>
            )}
          </fieldset>
        )}
      </div>

      <div className="rounded p-5 mb-4" style={{ background: C.panel }}>
        <div className="flex items-baseline justify-between gap-3 flex-wrap mb-3">
          <h2 style={{ fontWeight: 600, fontSize: 17 }}>Categories</h2>
          <span className="text-sm" style={{ color: allocated > total ? C.red : C.textDim, fontVariantNumeric: 'tabular-nums' }}>{money(allocated)} of {money(total)} · {money(total - allocated)} unallocated</span>
        </div>
        <ul className="flex flex-col gap-2">
          {form.categories.map((c, i) => (
            <li key={c.id || i} className="flex gap-2 items-center">
              <Select value={c.category} onChange={e => set({ categories: form.categories.map((x, j) => j === i ? { ...x, category: e.target.value } : x) })} aria-label="Category" style={{ flex: '1 1 50%' }}>
                {CATS.map(k => <option key={k} value={k}>{k}</option>)}
              </Select>
              <Input type="number" min="0" step="0.01" inputMode="decimal" value={c.allocated} onChange={e => set({ categories: form.categories.map((x, j) => j === i ? { ...x, allocated: e.target.value } : x) })} aria-label={c.category + ' amount'} placeholder="Amount" style={{ flex: '1 1 40%' }} />
              <button type="button" onClick={() => set({ categories: form.categories.filter((_, j) => j !== i) })} aria-label={'Remove ' + c.category} style={{ color: C.textDim }}><Trash2 size={16} /></button>
            </li>
          ))}
        </ul>
        <div className="mt-3"><Btn variant="ghost" onClick={() => set({ categories: [...form.categories, { id: uid(), category: CATS.find(k => !form.categories.some(x => x.category === k)) || 'Other', allocated: '' }] })}><Plus size={14} /> Add category</Btn></div>
      </div>

      {(form.id || !approver) && <Field label={approver ? 'Note (optional)' : 'Why (shown to the Admin)'}><TextArea rows={2} value={form.note} onChange={e => set({ note: e.target.value })} /></Field>}
      {problem && <div role="alert" className="text-sm mt-3" style={{ color: C.red }}>{problem}</div>}
      <div className="flex gap-2 mt-4">
        <Btn variant="primary" type="submit" disabled={!!problem}>{approver ? (form.id ? 'Save changes' : 'Create overhead') : 'Send for approval'}</Btn>
        <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>
      </div>
    </form>
  );
}

function OverheadDetail({ o, ledger = [], invoices = [], artistName, catalog, overheads, spend, approver, canEdit, onBack, onEdit, onDecide, onClose, onReopen, canSend = false, onSend }) {
  const allocated = sum(o.categories || [], c => c.allocated);
  const children = overheads.filter(x => x.parentId === o.id && x.status !== 'Rejected');
  const releaseTitles = (o.releaseIds || []).map(id => (catalog.find(r => r.id === id) || {}).title).filter(Boolean);
  const change = o.pendingChange;
  // Everything attached: ledger expenses (any status, so pending overspends show) and expense claims.
  const items = [
    ...ledger.filter(l => l.type === 'expense' && l.overheadId === o.id && l.approvalStatus !== 'Rejected').map(l => ({ id: l.id, categoryId: l.categoryId || '', date: l.date, text: l.description || l.category, amount: Number(l.amount) || 0, state: (l.approvalStatus || 'Approved') === 'Approved' ? '' : (l.overBudget ? 'Over budget, waiting' : 'Waiting for approval') })),
    ...invoices.filter(i => i.kind === 'expense' && i.overheadId === o.id && i.status !== 'Rejected').map(i => ({ id: i.id, categoryId: i.categoryId || '', date: String(i.submittedAt || '').slice(0, 10), text: 'Expense claim: ' + i.title, amount: Number(i.amount) || 0, state: ['Pay Approved', 'Paid'].includes(i.status) ? '' : 'Claim ' + i.status })),
  ].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  return (
    <div>
      <button onClick={onBack} className="inline-flex items-center gap-1 mb-3" style={{ color: C.textDim }}><ChevronLeft size={16} /> Budget</button>
      <h1 className="imss-title" style={{ marginBottom: 6 }}>{o.title}</h1>
      <div className="flex items-center gap-2 flex-wrap mb-5" style={{ color: C.textDim }}>
        <Badge tone={TONE[o.status]}>{o.status === 'Pending' ? 'Waiting for approval' : o.status}</Badge>
        <span>{o.kind === 'label' ? 'Label running costs' : artistName(o.artistId)}</span>
        {releaseTitles.length > 0 && <span>· {releaseTitles.join(', ')}</span>}
        {o.dealTerm && o.kind === 'artist' && <span>· {o.dealTerm.fundingTier}{o.dealTerm.dealType ? ' ' + o.dealTerm.dealType : ''}, {Math.round((o.dealTerm.artistPct || 0) * 100)}% deal</span>}
      </div>

      {(o.status === 'Pending' || change) && (
        <div className="rounded p-4 mb-4" style={{ background: C.amberSoft }}>
          <div style={{ fontWeight: 600 }}>{o.status === 'Pending' ? 'Waiting for approval' : 'A change is waiting for approval'}</div>
          <div className="text-sm mt-1" style={{ color: C.text }}>
            {o.status === 'Pending' ? 'Proposed by ' + o.createdBy + '.' : 'Proposed by ' + change.by + ': total ' + money(change.changes.total) + ', ' + change.changes.categories.length + ' categories.'}
            {change && change.note ? ' “' + change.note + '”' : ''}
          </div>
          {approver && <div className="flex gap-2 mt-3"><Btn variant="primary" onClick={() => onDecide(true)}><CheckCircle2 size={14} /> Approve</Btn><Btn variant="ghost" onClick={() => onDecide(false)}><XCircle size={14} /> Reject</Btn></div>}
        </div>
      )}

      <div className="flex flex-wrap gap-3 mb-4">
        <KPICard icon={Wallet} label="Total" value={money(o.total)} />
        <KPICard icon={Wallet} label="Spent" value={money(spend.total)} tone={spend.total > o.total ? 'red' : 'amber'} />
        <KPICard icon={Wallet} label="Remaining" value={money(o.total - spend.total - sum(children, x => x.total))} sub={children.length ? money(sum(children, x => x.total)) + ' carved out for singles' : undefined} tone="teal" />
        <KPICard icon={Wallet} label="Unallocated" value={money(o.total - allocated)} />
      </div>

      <div className="rounded p-5 mb-4" style={{ background: C.panel }}>
        <h2 className="mb-3" style={{ fontWeight: 600, fontSize: 17 }}>Categories</h2>
        {(o.categories || []).length === 0 ? <p style={{ color: C.textDim }}>No categories yet.</p> : (
          <ul className="flex flex-col gap-3">
            {o.categories.map(c => {
              const spent = spend.byCat[c.id] || 0;
              const pct = c.allocated > 0 ? Math.min(100, Math.round(spent / c.allocated * 100)) : 0;
              return (
                <li key={c.id}>
                  <div className="flex items-baseline justify-between gap-3 text-sm"><span style={{ fontWeight: 600, fontSize: 15 }}>{c.category}</span><span style={{ color: spent > c.allocated ? C.red : C.textDim, fontVariantNumeric: 'tabular-nums' }}>{money(spent)} of {money(c.allocated)}</span></div>
                  <div className="mt-1.5" style={{ height: 6, borderRadius: 9999, background: 'var(--fill)', overflow: 'hidden' }}><div style={{ width: pct + '%', height: '100%', background: spent > c.allocated ? C.red : C.amberFill }} /></div>
                  <AttachedItems items={items.filter(x => x.categoryId === c.id)} />
                </li>
              );
            })}
          </ul>
        )}
        {items.some(x => !x.categoryId) && <div className="mt-4"><div className="text-sm" style={{ fontWeight: 600 }}>Unallocated</div><AttachedItems items={items.filter(x => !x.categoryId)} /></div>}
        {items.length === 0 && <p className="text-sm mt-4" style={{ color: C.textDim }}>Nothing attached yet. Choose this budget when you add an expense in Expenses &amp; income, or on an expense claim in Invoices.</p>}
      </div>

      {children.length > 0 && (
        <div className="rounded p-5 mb-4" style={{ background: C.panel }}>
          <h2 className="mb-2" style={{ fontWeight: 600, fontSize: 17 }}>Singles from this album</h2>
          <ul className="text-sm flex flex-col gap-1">{children.map(x => <li key={x.id} className="flex justify-between gap-3"><span>{x.title}</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{money(x.total)}</span></li>)}</ul>
          <div className="text-sm mt-2" style={{ color: C.textDim }}>{money(o.total - sum(children, x => x.total))} of the album left to carve out.</div>
        </div>
      )}

      <div className="flex gap-2 flex-wrap mb-6">
        {canEdit && o.status !== 'Closed' && o.status !== 'Rejected' && !change && <Btn variant="ghost" onClick={onEdit}>{approver ? 'Change' : 'Propose a change'}</Btn>}
        {approver && o.status === 'Active' && <Btn variant="ghost" onClick={onClose}><Lock size={14} /> Close: product ended</Btn>}
        {approver && o.status === 'Closed' && <Btn variant="ghost" onClick={onReopen}>Reopen</Btn>}
        {canSend && o.kind === 'artist' && ['Active', 'Closed'].includes(o.status) && !o.sentToArtistAt && <Btn variant="primary" onClick={onSend}>Send to artist’s dashboard</Btn>}
        {o.sentToArtistAt && <span className="text-sm self-center" style={{ color: C.teal }}>On the artist’s dashboard since {formatDate(String(o.sentToArtistAt).slice(0, 10))}</span>}
      </div>

      <div className="rounded p-5" style={{ background: C.panel }}>
        <h2 className="mb-2" style={{ fontWeight: 600, fontSize: 17 }}>History</h2>
        <ul className="text-sm flex flex-col gap-1.5">{[...(o.history || [])].reverse().map((h, i) => <li key={i}><span style={{ color: C.textDim }}>{formatDate(String(h.at).slice(0, 10))}</span> · {h.by} {h.action}{h.note ? ': “' + h.note + '”' : ''}</li>)}</ul>
      </div>
    </div>
  );
}

// Expenses and claims attached to a category; ones not yet counted say why.
function AttachedItems({ items, fmt = money }) {
  if (!items.length) return null;
  return (
    <ul className="mt-2 flex flex-col" style={{ borderTop: '1px solid var(--hairline)' }}>
      {items.map(x => (
        <li key={x.id} className="flex items-baseline justify-between gap-3 text-sm" style={{ padding: '6px 0', borderBottom: '1px solid var(--hairline)' }}>
          <span style={{ minWidth: 0 }}><span style={{ color: C.textDim }}>{x.date ? formatDate(x.date) : ''}</span> {x.text}{x.state && <span style={{ color: C.amber }}> · {x.state}</span>}</span>
          <span style={{ fontVariantNumeric: 'tabular-nums', flex: '0 0 auto' }}>{fmt(x.amount)}</span>
        </li>
      ))}
    </ul>
  );
}

// The artist's view of a budget, the same shape artist_portal() returns.
export function artistBudgetsFor(artistId, overheads = [], ledger = [], invoices = []) {
  return overheads.filter(o => o.kind === 'artist' && o.artistId === artistId && o.sentToArtistAt && ['Active', 'Closed'].includes(o.status)).map(o => ({
    id: o.id, title: o.title, status: o.status, total: o.total, releaseIds: o.releaseIds || [], parentId: o.parentId || '', closedAt: o.closedAt || '', sentToArtistAt: o.sentToArtistAt,
    categories: (o.categories || []).map(c => ({ id: c.id, category: c.category, allocated: c.allocated })),
    items: [
      ...ledger.filter(l => l.type === 'expense' && l.overheadId === o.id && (l.approvalStatus || 'Approved') === 'Approved').map(l => ({ id: l.id, categoryId: l.categoryId || '', date: l.date, text: l.description || l.category, amount: l.amount })),
      ...invoices.filter(i => i.kind === 'expense' && i.overheadId === o.id && ['Pay Approved', 'Paid'].includes(i.status)).map(i => ({ id: i.id, categoryId: i.categoryId || '', date: String(i.submittedAt || '').slice(0, 10), text: 'Expense claim: ' + i.title, amount: i.amount })),
    ],
  }));
}

// Artist portal: their budgets, per release then per category, with what's been spent.
export function ArtistBudgets({ budgets = [], catalog = [], fmt = money }) {
  if (!budgets.length) return null;
  return (
    <div className="flex flex-col gap-4 mb-6">
      {budgets.map(b => {
        const spent = sum(b.items, x => x.amount);
        const releases = (b.releaseIds || []).map(id => (catalog.find(r => r.id === id) || {}).title).filter(Boolean);
        return (
          <section key={b.id} aria-label={b.title} className="rounded p-5" style={{ background: C.panel }}>
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
              <h2 style={{ fontWeight: 700, fontSize: 19, letterSpacing: '-0.02em' }}>{b.title}</h2>
              {b.status === 'Closed' && <Badge>Closed{b.closedAt ? ' ' + formatDate(String(b.closedAt).slice(0, 10)) : ''}</Badge>}
            </div>
            {releases.length > 0 && <div className="text-sm mt-0.5" style={{ color: C.textDim }}>{releases.join(', ')}</div>}
            <dl className="grid gap-3 mt-4" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
              {[['Budget', b.total, C.text], ['Spent', spent, C.amber], ['Left', b.total - spent, spent > b.total ? C.red : C.teal]].map(([k, v, col]) => (
                <div key={k}><dt className="text-sm" style={{ color: C.textDim }}>{k}</dt><dd style={{ fontWeight: 700, fontSize: 20, color: col, fontVariantNumeric: 'tabular-nums' }}>{fmt(v)}</dd></div>
              ))}
            </dl>
            <ul className="mt-4 flex flex-col gap-3">
              {b.categories.map(c => {
                const its = b.items.filter(x => x.categoryId === c.id);
                const cs = sum(its, x => x.amount);
                const pct = c.allocated > 0 ? Math.min(100, Math.round(cs / c.allocated * 100)) : 0;
                return (
                  <li key={c.id}>
                    <div className="flex items-baseline justify-between gap-3"><span style={{ fontWeight: 600 }}>{c.category}</span><span className="text-sm" style={{ color: C.textDim, fontVariantNumeric: 'tabular-nums' }}>{fmt(cs)} of {fmt(c.allocated)}</span></div>
                    <div className="mt-1.5" style={{ height: 6, borderRadius: 9999, background: 'var(--fill)', overflow: 'hidden' }}><div style={{ width: pct + '%', height: '100%', background: cs > c.allocated ? C.red : C.amberFill }} /></div>
                    <AttachedItems fmt={fmt} items={its.map(x => ({ ...x, amount: Number(x.amount) || 0 }))} />
                  </li>
                );
              })}
              {b.items.some(x => !x.categoryId) && <li><span style={{ fontWeight: 600 }}>Other spend</span><AttachedItems fmt={fmt} items={b.items.filter(x => !x.categoryId).map(x => ({ ...x, amount: Number(x.amount) || 0 }))} /></li>}
            </ul>
            <p className="text-sm mt-4" style={{ color: C.textDim }}>Only money actually spent is recouped from your earnings, never the unspent budget.</p>
          </section>
        );
      })}
    </div>
  );
}

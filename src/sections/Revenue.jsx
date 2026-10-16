import { CheckCircle2, ClipboardList, DollarSign, Download, FileText, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { RELEASE_TYPES, formatCurrency, todayStr } from '../constants.js';
import { slug } from '../finance.js';
import { C } from '../theme.js';
import { Badge, Btn, ConfirmInline, EmptyState, Field, Input, KPICard, SectionHeader, Select, Td, Th, exportRowsToCsv } from '../ui.jsx';

export function RevenueSection({ revenue, update, roster, catalog = [], canEdit = true, isAdmin = false, sessionName = '' }) {
  const empty = { artist: roster[0] ? roster[0].name : '', title: '', month: todayStr().slice(0, 7), earning: '', type: RELEASE_TYPES[0], epAlbum: '', releaseDate: '' };
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [confirmId, setConfirmId] = useState(null);
  const [filters, setFilters] = useState({ startMonth: '', endMonth: '', artist: 'all', search: '' });

  function openAdd() { setForm(empty); setEditing(null); setShowForm(true); }
  function openEdit(r) { setForm({ artist: r.artist, title: r.title, month: r.month, earning: String(r.earning), type: r.type || RELEASE_TYPES[0], epAlbum: r.epAlbum || '', releaseDate: r.releaseDate || '' }); setEditing(r.id); setShowForm(true); }
  function closeForm() { setShowForm(false); setEditing(null); }
  function save(e) {
    e.preventDefault();
    const earning = Number(form.earning);
    if (!form.artist || !form.title.trim() || !form.month || !earning || earning <= 0) return;
    const artistSlug = slug(form.artist);
    const id = editing || (artistSlug + '_' + slug(form.title) + '_' + form.month);
    const approvalStatus = isAdmin ? 'Approved' : 'Pending';
    const payload = { id, artist: form.artist, artistSlug, title: form.title.trim(), month: form.month, earning, type: form.type, epAlbum: form.epAlbum.trim() || null, releaseDate: form.releaseDate || null, approvalStatus, approvedBy: isAdmin ? sessionName : '', approvedAt: isAdmin ? todayStr() : '' };
    if (editing) update(revenue.map(r => r.id === editing ? { ...r, ...payload, id: editing } : r));
    else update([...revenue.filter(r => r.id !== id), payload]);
    closeForm();
  }
  function remove(id) { update(revenue.filter(r => r.id !== id)); setConfirmId(null); }
  function approveEntry(id) { update(revenue.map(r => r.id === id ? { ...r, approvalStatus: 'Approved', approvedBy: sessionName, approvedAt: todayStr() } : r)); }
  function rejectEntry(id) { update(revenue.map(r => r.id === id ? { ...r, approvalStatus: 'Rejected', approvedBy: sessionName, approvedAt: todayStr() } : r)); }
  // The month range applies on Generate; artist and search stay live so the
  // management table is still quick to scan.
  const [appliedMonths, setAppliedMonths] = useState({ startMonth: '', endMonth: '' });
  const [rangeError, setRangeError] = useState('');
  function resetFilters() { setFilters({ startMonth: '', endMonth: '', artist: 'all', search: '' }); setAppliedMonths({ startMonth: '', endMonth: '' }); setRangeError(''); }
  function applyMonths() {
    if (filters.startMonth && filters.endMonth && filters.startMonth > filters.endMonth) {
      setRangeError('The start month has to come before the end month.');
      return;
    }
    setRangeError('');
    setAppliedMonths({ startMonth: filters.startMonth, endMonth: filters.endMonth });
  }

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return revenue.filter(r => {
      if (appliedMonths.startMonth && r.month < appliedMonths.startMonth) return false;
      if (appliedMonths.endMonth && r.month > appliedMonths.endMonth) return false;
      if (filters.artist !== 'all' && r.artistSlug !== filters.artist) return false;
      if (!q) return true;
      const rel = catalog.find(c => slug(c.title) === slug(r.title) && slug((roster.find(a => a.id === c.artistId) || {}).name || '') === r.artistSlug);
      return [r.title, r.artist, r.isrc, r.upc, rel && rel.isrc, rel && rel.upc].some(v => v && String(v).toLowerCase().includes(q));
    });
  }, [revenue, filters, appliedMonths, catalog, roster]);

  function exportCsv() {
    exportRowsToCsv('revenue-export', ['Artist', 'Title', 'Month', 'Earning', 'Type', 'EP/Album', 'Release date', 'Status'],
      [...filtered].sort((a, b) => b.month.localeCompare(a.month)).map(r => [r.artist, r.title, r.month, r.earning, r.type || '', r.epAlbum || '', r.releaseDate || '', r.approvalStatus || 'Approved']));
  }

  const sorted = [...filtered].sort((a, b) => b.month.localeCompare(a.month) || a.artist.localeCompare(b.artist));
  const total = filtered.reduce((s, r) => s + r.earning, 0);
  const pendingCount = revenue.filter(r => r.approvalStatus === 'Pending').length;
  const filtersActive = !!(appliedMonths.startMonth || appliedMonths.endMonth || filters.artist !== 'all' || filters.search);

  return (
    <div>
      <SectionHeader title="Revenue" artistNote="nothing from this screen directly. Changes here reach artists only through Publish to artists." description="One row per track per month — the source of truth every finance calculation is built from." action={canEdit && <Btn variant="primary" onClick={openAdd}><Plus size={14} /> Add revenue</Btn>} />

      {!isAdmin && pendingCount > 0 && (
        <div className="rounded px-3 py-2 text-xs mb-4" style={{ background: C.amberSoft, color: C.amber, border: '1px solid ' + C.amber }}>
          {pendingCount} {pendingCount === 1 ? 'entry is' : 'entries are'} waiting on admin approval and excluded from totals until approved.
        </div>
      )}

      <div className="rounded border p-4 mb-6" style={{ background: C.panel, borderColor: C.border }}>
        <div className="imss-form-grid gap-3 mb-3">
          <Field label="Start month"><Input type="month" value={filters.startMonth} onChange={e => { setFilters({ ...filters, startMonth: e.target.value }); setRangeError(''); }} /></Field>
          <Field label="End month"><Input type="month" value={filters.endMonth} onChange={e => { setFilters({ ...filters, endMonth: e.target.value }); setRangeError(''); }} /></Field>
          <Field label="Artist">
            <Select value={filters.artist} onChange={e => setFilters({ ...filters, artist: e.target.value })}>
              <option value="all">All artists</option>
              {roster.map(a => <option key={a.id} value={slug(a.name)}>{a.name}</option>)}
            </Select>
          </Field>
          <Field label="Search"><Input value={filters.search} onChange={e => setFilters({ ...filters, search: e.target.value })} placeholder="Title, artist, ISRC or UPC" /></Field>
        </div>
        {rangeError && (
          <div className="rounded px-3 py-2 text-xs mb-3" style={{ background: C.redSoft, color: C.red, border: '1px solid ' + C.red }}>{rangeError}</div>
        )}
        <div className="flex gap-2 flex-wrap">
          <Btn variant="primary" onClick={applyMonths}><FileText size={14} /> Generate</Btn>
          <Btn variant="ghost" onClick={exportCsv}><Download size={14} /> Export to CSV</Btn>
          <Btn variant="ghost" onClick={resetFilters}>Reset</Btn>
        </div>
        {filtersActive && <div className="text-xs mt-2" style={{ color: C.textFaint }}>Showing {filtered.length} of {revenue.length} entries</div>}
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <KPICard icon={DollarSign} label="Total revenue (filtered)" value={formatCurrency(total)} tone="teal" />
        <KPICard icon={ClipboardList} label="Pending approval" value={pendingCount} tone={pendingCount ? 'amber' : undefined} />
      </div>

      {showForm && (
        <form onSubmit={save} className="rounded border p-4 mb-6 imss-form-grid gap-3" style={{ background: C.panel, borderColor: C.borderLight }}>
          <Field label="Artist">
            <Select value={form.artist} onChange={e => setForm({ ...form, artist: e.target.value })}>
              {roster.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
            </Select>
          </Field>
          <Field label="Track title"><Input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></Field>
          <Field label="Month"><Input type="month" required value={form.month} onChange={e => setForm({ ...form, month: e.target.value })} /></Field>
          <Field label="Earning (gross, USD)"><Input type="number" min="0" step="0.01" required value={form.earning} onChange={e => setForm({ ...form, earning: e.target.value })} /></Field>
          <Field label="Type">
            <Select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
              {RELEASE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </Select>
          </Field>
          <Field label="Parent EP/Album (optional)"><Input value={form.epAlbum} onChange={e => setForm({ ...form, epAlbum: e.target.value })} /></Field>
          <Field label="Original release date (optional)"><Input type="date" value={form.releaseDate} onChange={e => setForm({ ...form, releaseDate: e.target.value })} /></Field>
          <div className="imss-span-2 flex gap-2 mt-1">
            <Btn variant="primary" type="submit">{editing ? 'Save changes' : 'Add revenue'}</Btn>
            <Btn variant="ghost" onClick={closeForm}>Cancel</Btn>
          </div>
        </form>
      )}

      {sorted.length === 0 ? (
        <EmptyState icon={DollarSign} title={filtersActive ? 'No matching revenue' : 'No revenue recorded'} description={filtersActive ? 'Try widening the filters.' : 'Log a track/month earning to get started.'} />
      ) : (
        <div className="rounded border overflow-x-auto" style={{ borderColor: C.border, background: C.panel }}>
          <table className="w-full" style={{ minWidth: 760 }}>
            <thead><tr><Th>Month</Th><Th>Artist</Th><Th>Track</Th><Th>Type</Th><Th align="right">Earning</Th><Th>Status</Th><Th align="right">Actions</Th></tr></thead>
            <tbody>
              {sorted.map(r => (
                <tr key={r.id}>
                  <Td mono>{r.month}</Td>
                  <Td>{r.artist}</Td>
                  <Td>{r.title}{r.epAlbum ? <span style={{ color: C.textFaint }}> · {r.epAlbum}</span> : ''}</Td>
                  <Td><Badge>{r.type || '—'}</Badge></Td>
                  <Td align="right" mono>{formatCurrency(r.earning)}</Td>
                  <Td><Badge tone={r.approvalStatus === 'Pending' ? 'amber' : r.approvalStatus === 'Rejected' ? 'red' : 'teal'}>{r.approvalStatus || 'Approved'}</Badge></Td>
                  <Td align="right">
                    {confirmId === r.id ? <ConfirmInline onConfirm={() => remove(r.id)} onCancel={() => setConfirmId(null)} /> : (
                      <span className="inline-flex gap-3 justify-end items-center">
                        {isAdmin && r.approvalStatus === 'Pending' && (
                          <>
                            <button onClick={() => approveEntry(r.id)} style={{ color: C.teal }}><CheckCircle2 size={14} /></button>
                            <button onClick={() => rejectEntry(r.id)} style={{ color: C.red }}><Trash2 size={14} /></button>
                          </>
                        )}
                        {canEdit && <button onClick={() => openEdit(r)} style={{ color: C.textDim }}><Pencil size={14} /></button>}
                        {canEdit && <button onClick={() => setConfirmId(r.id)} style={{ color: C.textDim }}><Trash2 size={14} /></button>}
                      </span>
                    )}
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

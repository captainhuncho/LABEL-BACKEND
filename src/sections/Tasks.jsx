import { ClipboardList, Pencil, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { formatDate, todayStr, uid } from '../constants.js';
import { TASK_STATUSES } from '../seed.js';
import { C } from '../theme.js';
import { Badge, Btn, ConfirmInline, EmptyState, ExportBar, Field, Input, KPICard, SectionHeader, Select, Td, TextArea, Th } from '../ui.jsx';

export function TasksSection({ tasks, update, staff, roster, catalog }) {
  const empty = { title: '', assignee: staff[0] ? staff[0].name : '', dueDate: todayStr(), status: 'Open', notes: '', artistId: '', releaseId: '' };
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [confirmId, setConfirmId] = useState(null);
  const [filterAssignee, setFilterAssignee] = useState('all');
  const [filterStatus, setFilterStatus] = useState('Open');
  const [filterArtist, setFilterArtist] = useState('all');
  const [view, setView] = useState('list');

  function openAdd() { setForm({ ...empty, assignee: staff[0] ? staff[0].name : '' }); setEditing(null); setShowForm(true); }
  function openEdit(t) { setForm({ ...empty, ...t }); setEditing(t.id); setShowForm(true); }
  function closeForm() { setShowForm(false); setEditing(null); }
  function setFormArtist(artistId) { setForm(f => ({ ...f, artistId, releaseId: '' })); }
  function save(e) {
    e.preventDefault();
    if (!form.title.trim() || !form.assignee) return;
    if (editing) update(tasks.map(t => t.id === editing ? { ...form, id: editing } : t));
    else update([...tasks, { ...form, id: uid(), createdAt: todayStr() }]);
    closeForm();
  }
  function remove(id) { update(tasks.filter(t => t.id !== id)); setConfirmId(null); }
  function toggleDone(t) { update(tasks.map(x => x.id === t.id ? { ...x, status: x.status === 'Done' ? 'Open' : 'Done' } : x)); }

  const formReleases = form.artistId ? catalog.filter(c => c.artistId === form.artistId) : [];

  const filtered = tasks.filter(t => {
    if (filterAssignee !== 'all' && t.assignee !== filterAssignee) return false;
    if (filterStatus !== 'all' && t.status !== filterStatus) return false;
    if (filterArtist !== 'all' && t.artistId !== filterArtist) return false;
    return true;
  });
  const sorted = [...filtered].sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
  const openCount = tasks.filter(t => t.status === 'Open').length;
  const overdueCount = tasks.filter(t => t.status === 'Open' && t.dueDate && t.dueDate < todayStr()).length;

  const workload = useMemo(() => {
    const map = {};
    staff.forEach(s => { map[s.name] = { name: s.name, open: 0, overdue: 0 }; });
    tasks.forEach(t => {
      if (t.status !== 'Open') return;
      if (!map[t.assignee]) map[t.assignee] = { name: t.assignee, open: 0, overdue: 0 };
      map[t.assignee].open += 1;
      if (t.dueDate && t.dueDate < todayStr()) map[t.assignee].overdue += 1;
    });
    return Object.values(map).sort((a, b) => b.open - a.open);
  }, [tasks, staff]);
  const maxOpen = Math.max(1, ...workload.map(w => w.open));

  function linkBadge(t) {
    const artist = t.artistId ? roster.find(a => a.id === t.artistId) : null;
    const release = t.releaseId ? catalog.find(c => c.id === t.releaseId) : null;
    if (!artist) return null;
    return <Badge>{release ? release.title : artist.name}</Badge>;
  }

  return (
    <div>
      <SectionHeader title="Tasks" description="Shared to-dos across the team — assign, track, and close out." action={<Btn variant="primary" onClick={openAdd}><Plus size={14} /> Add task</Btn>} />

      <div className="flex flex-wrap gap-3 mb-6">
        <KPICard icon={ClipboardList} label="Open tasks" value={openCount} />
        <KPICard icon={ClipboardList} label="Overdue" value={overdueCount} tone={overdueCount > 0 ? 'red' : undefined} />
      </div>

      <div className="imss-print-hide flex items-center gap-1 mb-6">
        {[['list', 'List'], ['workload', 'Workload']].map(([id, label]) => (
          <button key={id} onClick={() => setView(id)} className="text-sm px-3 py-1.5 rounded"
            style={{ background: view === id ? C.amberSoft : 'transparent', color: view === id ? C.amber : C.textDim, border: '1px solid ' + (view === id ? 'transparent' : C.border), fontWeight: view === id ? 600 : 500 }}>
            {label}
          </button>
        ))}
      </div>

      {view === 'workload' ? (
        workload.every(w => w.open === 0) ? (
          <EmptyState icon={ClipboardList} title="No open tasks" description="Workload per person shows up here once tasks are assigned." />
        ) : (
          <div className="rounded border p-4" style={{ background: C.panel, borderColor: C.border }}>
            <div className="flex flex-col gap-3">
              {workload.filter(w => w.open > 0).map(w => (
                <div key={w.name}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span>{w.name}</span>
                    <span style={{ color: C.textFaint }}>{w.open} open{w.overdue > 0 ? ' · ' + w.overdue + ' overdue' : ''}</span>
                  </div>
                  <div className="rounded-full overflow-hidden" style={{ height: 6, background: C.panel2 }}>
                    <div style={{ height: 6, width: (w.open / maxOpen * 100) + '%', background: w.overdue > 0 ? C.red : C.amber }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      ) : (
        <>
          <div className="rounded border p-4 mb-6" style={{ background: C.panel, borderColor: C.border }}>
            <div className="imss-form-grid gap-3">
              <Field label="Assignee">
                <Select value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)}>
                  <option value="all">Everyone</option>
                  {staff.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                </Select>
              </Field>
              <Field label="Artist">
                <Select value={filterArtist} onChange={e => setFilterArtist(e.target.value)}>
                  <option value="all">All artists</option>
                  {roster.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </Select>
              </Field>
              <Field label="Status">
                <Select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                  <option value="all">All</option>
                  {TASK_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </Select>
              </Field>
            </div>
          </div>

          <ExportBar filename="imss-tasks" headers={['Task', 'Assignee', 'Artist', 'Release', 'Due Date', 'Status', 'Notes']} rows={sorted.map(t => {
            const artist = t.artistId ? roster.find(a => a.id === t.artistId) : null;
            const release = t.releaseId ? catalog.find(c => c.id === t.releaseId) : null;
            return [t.title, t.assignee, artist ? artist.name : '', release ? release.title : '', t.dueDate || '', t.status, t.notes || ''];
          })} />

          {showForm && (
            <form onSubmit={save} className="rounded border p-4 mb-6 imss-form-grid gap-3" style={{ background: C.panel, borderColor: C.borderLight }}>
              <Field label="Task" full><Input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Confirm split sheet" /></Field>
              <Field label="Assignee">
                <Select value={form.assignee} onChange={e => setForm({ ...form, assignee: e.target.value })}>
                  {staff.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                </Select>
              </Field>
              <Field label="Due date"><Input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} /></Field>
              <Field label="Related artist">
                <Select value={form.artistId} onChange={e => setFormArtist(e.target.value)}>
                  <option value="">— none —</option>
                  {roster.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </Select>
              </Field>
              <Field label="Related release">
                <Select value={form.releaseId} onChange={e => setForm({ ...form, releaseId: e.target.value })} disabled={!form.artistId}>
                  <option value="">— none —</option>
                  {formReleases.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                </Select>
              </Field>
              <Field label="Status">
                <Select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                  {TASK_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </Select>
              </Field>
              <Field label="Notes" full><TextArea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></Field>
              <div className="imss-span-2 flex gap-2 mt-1">
                <Btn variant="primary" type="submit">{editing ? 'Save changes' : 'Add task'}</Btn>
                <Btn variant="ghost" onClick={closeForm}>Cancel</Btn>
              </div>
            </form>
          )}

          {sorted.length === 0 ? (
            <EmptyState icon={ClipboardList} title="Nothing here" description="Add a task to get the team aligned on what's next." />
          ) : (
            <div className="rounded border overflow-x-auto" style={{ borderColor: C.border, background: C.panel }}>
              <table className="w-full" style={{ minWidth: 680 }}>
                <thead><tr><Th></Th><Th>Task</Th><Th>Assignee</Th><Th>Related to</Th><Th>Due</Th><Th>Status</Th><Th align="right">Actions</Th></tr></thead>
                <tbody>
                  {sorted.map(t => {
                    const overdue = t.status === 'Open' && t.dueDate && t.dueDate < todayStr();
                    return (
                      <tr key={t.id} data-focus={t.id} style={{ opacity: t.status === 'Done' ? 0.55 : 1 }}>
                        <Td><input type="checkbox" checked={t.status === 'Done'} onChange={() => toggleDone(t)} /></Td>
                        <Td style={{ textDecoration: t.status === 'Done' ? 'line-through' : 'none' }}>{t.title}</Td>
                        <Td>{t.assignee}</Td>
                        <Td>{linkBadge(t) || '—'}</Td>
                        <Td mono style={{ color: overdue ? C.red : undefined }}>{t.dueDate ? formatDate(t.dueDate) : '—'}</Td>
                        <Td><Badge tone={t.status === 'Done' ? 'teal' : overdue ? 'red' : 'amber'}>{overdue ? 'Overdue' : t.status}</Badge></Td>
                        <Td align="right">
                          {confirmId === t.id ? <ConfirmInline onConfirm={() => remove(t.id)} onCancel={() => setConfirmId(null)} /> : (
                            <span className="inline-flex gap-3 justify-end">
                              <button onClick={() => openEdit(t)} style={{ color: C.textDim }}><Pencil size={14} /></button>
                              <button onClick={() => setConfirmId(t.id)} style={{ color: C.textDim }}><Trash2 size={14} /></button>
                            </span>
                          )}
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

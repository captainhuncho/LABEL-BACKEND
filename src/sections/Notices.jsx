import { Bell, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { formatDate, todayStr, uid } from '../constants.js';
import { C } from '../theme.js';
import { Btn, ConfirmInline, EmptyState, Field, Input, SectionHeader, Select, TextArea } from '../ui.jsx';

export function NoticesSection({ notices, update, roster, staff, sessionName }) {
  const empty = { title: '', message: '', audience: 'all' };
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [confirmId, setConfirmId] = useState(null);

  function openAdd() { setForm(empty); setEditing(null); setShowForm(true); }
  function openEdit(n) { setForm({ title: n.title, message: n.message, audience: n.audience }); setEditing(n.id); setShowForm(true); }
  function closeForm() { setShowForm(false); setEditing(null); }
  function save(e) {
    e.preventDefault();
    if (!form.title.trim() || !form.message.trim()) return;
    if (editing) update(notices.map(n => n.id === editing ? { ...n, ...form } : n));
    else update([{ ...form, id: uid(), createdBy: sessionName, createdAt: todayStr() }, ...notices]);
    closeForm();
  }
  function remove(id) { update(notices.filter(n => n.id !== id)); setConfirmId(null); }

  function audienceLabel(n) {
    if (n.audience === 'all') return 'All artists';
    if (n.audience === 'all-team') return 'All team members';
    const artist = roster.find(a => a.id === n.audience);
    if (artist) return artist.name + ' (artist)';
    const member = staff.find(s => s.id === n.audience);
    if (member) return member.name + ' (team)';
    return 'Unknown';
  }

  const sorted = [...notices].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

  return (
    <div>
      <SectionHeader title="Noticeboard" description="Push announcements to artist dashboards or straight to the team — target everyone, or someone specific." action={<Btn variant="primary" onClick={openAdd}><Plus size={14} /> New notice</Btn>} />

      {showForm && (
        <form onSubmit={save} className="rounded border p-4 mb-6 imss-form-grid gap-3" style={{ background: C.panel, borderColor: C.borderLight }}>
          <Field label="Title" full><Input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Studio closed for the holidays" /></Field>
          <Field label="Audience" full>
            <Select value={form.audience} onChange={e => setForm({ ...form, audience: e.target.value })}>
              <optgroup label="Artists">
                <option value="all">All artists</option>
                {roster.map(a => <option key={a.id} value={a.id}>{a.name} only</option>)}
              </optgroup>
              <optgroup label="Team">
                <option value="all-team">All team members</option>
                {staff.map(s => <option key={s.id} value={s.id}>{s.name} only</option>)}
              </optgroup>
            </Select>
          </Field>
          <Field label="Message" full><TextArea rows={3} required value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} placeholder="What should they know?" /></Field>
          <div className="imss-span-2 flex gap-2 mt-1">
            <Btn variant="primary" type="submit">{editing ? 'Save changes' : 'Post notice'}</Btn>
            <Btn variant="ghost" onClick={closeForm}>Cancel</Btn>
          </div>
        </form>
      )}

      {sorted.length === 0 ? (
        <EmptyState icon={Bell} title="No notices posted" description="Anything you post here shows up on the 'Worth knowing' section of the right dashboard — artist or team." />
      ) : (
        <div className="flex flex-col gap-3">
          {sorted.map(n => (
            <div key={n.id} className="rounded border p-4" style={{ background: C.panel, borderColor: C.border }}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div style={{ fontWeight: 600 }}>{n.title}</div>
                  <div className="text-xs mt-0.5" style={{ color: C.textFaint }}>
                    {audienceLabel(n)}
                    {' · '}{n.createdBy}{' · '}{formatDate(n.createdAt)}
                  </div>
                </div>
                {confirmId === n.id ? <ConfirmInline onConfirm={() => remove(n.id)} onCancel={() => setConfirmId(null)} /> : (
                  <span className="inline-flex gap-3">
                    <button onClick={() => openEdit(n)} style={{ color: C.textDim }}><Pencil size={14} /></button>
                    <button onClick={() => setConfirmId(n.id)} style={{ color: C.textDim }}><Trash2 size={14} /></button>
                  </span>
                )}
              </div>
              <div className="text-sm mt-2" style={{ color: C.textDim }}>{n.message}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

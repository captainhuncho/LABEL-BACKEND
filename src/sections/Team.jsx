import { Pencil, Plus, Search, Trash2, UserCog, Users } from 'lucide-react';
import { useRef, useState } from 'react';
import { STAFF_EMAIL_DOMAINS, isStaffEmailAllowed, PERMISSION_FIELDS, STAFF_ROLES, STAFF_STATUSES, defaultPermissionsForRole, isTopRole, makeOnboardingChecklist, onboardingProgress, permissionsFor, todayStr, uid } from '../constants.js';
import { C } from '../theme.js';
import { Avatar, Badge, Btn, ConfirmInline, EmptyState, ExportBar, Field, Input, KPICard, SectionHeader, SegmentedToggle, Select, Td, TextArea, Th, resizeImageFile } from '../ui.jsx';
import { SendLinkButton } from './ArtistDetail.jsx';

export function TeamSection({ staff, update, sessionRole = 'Admin', sessionName = '', accessRequests = [], updateAccessRequests }) {
  // Legal has Admin-level reach, but access changes it makes are proposals:
  // they queue for an Admin instead of applying.
  const proposesOnly = sessionRole === 'Legal';
  const [proposed, setProposed] = useState('');
  const empty = { name: '', role: 'Product Manager', email: '', phone: '', startDate: todayStr(), status: 'Onboarding', bio: '', photoUrl: '', permissions: defaultPermissionsForRole('Product Manager'), onboarding: makeOnboardingChecklist() };
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [confirmId, setConfirmId] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [view, setView] = useState('grid');
  const [newTaskLabel, setNewTaskLabel] = useState('');
  const photoInputRef = useRef(null);

  function openAdd() { setForm({ ...empty, permissions: defaultPermissionsForRole('Product Manager'), onboarding: makeOnboardingChecklist() }); setEditing(null); setShowForm(true); }
  function openEdit(s) { setForm({ ...empty, ...s, permissions: permissionsFor(s), onboarding: s.onboarding && s.onboarding.length ? s.onboarding : makeOnboardingChecklist() }); setEditing(s.id); setShowForm(true); }
  function closeForm() { setShowForm(false); setEditing(null); setNewTaskLabel(''); if (photoInputRef.current) photoInputRef.current.value = ''; }
  function changeRole(role) { setForm(f => ({ ...f, role, permissions: defaultPermissionsForRole(role) })); }
  function togglePermission(key) { setForm(f => ({ ...f, permissions: { ...f.permissions, [key]: !f.permissions[key] } })); }
  function toggleTask(taskId) {
    setForm(f => {
      const onboarding = f.onboarding.map(t => t.id === taskId ? { ...t, done: !t.done } : t);
      const allDone = onboarding.length > 0 && onboarding.every(t => t.done);
      return { ...f, onboarding, status: allDone && f.status === 'Onboarding' ? 'Active' : f.status };
    });
  }
  function addTask() {
    if (!newTaskLabel.trim()) return;
    setForm(f => ({ ...f, onboarding: [...f.onboarding, { id: uid(), label: newTaskLabel.trim(), done: false }] }));
    setNewTaskLabel('');
  }
  function removeTask(taskId) { setForm(f => ({ ...f, onboarding: f.onboarding.filter(t => t.id !== taskId) })); }
  function handlePhotoUpload(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    resizeImageFile(file, 300, dataUrl => setForm(f => ({ ...f, photoUrl: dataUrl })));
  }
  const [emailError, setEmailError] = useState('');
  function save(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    // A new or changed staff email must be on a label domain; unchanged existing ones keep working.
    const previousEmail = editing ? ((staff.find(x => x.id === editing) || {}).email || '') : null;
    const email = (form.email || '').trim();
    if (!email) { setEmailError('Add their work email. It’s how they sign in.'); return; }
    if (email.toLowerCase() !== String(previousEmail || '').toLowerCase() && !isStaffEmailAllowed(email)) {
      setEmailError('Use a label email ending in ' + STAFF_EMAIL_DOMAINS.map(d => '@' + d).join(' or ') + '.'); return;
    }
    setEmailError('');
    if (editing) {
      const before = staff.find(s => s.id === editing);
      // Legal outranks nobody where Admin is concerned.
      if (proposesOnly && isTopRole(before && before.role)) { closeForm(); return; }
      const beforePerms = permissionsFor(before);
      const accessChanged = before && (before.role !== form.role ||
        PERMISSION_FIELDS.some(f => !!beforePerms[f.key] !== !!form.permissions[f.key]));
      if (proposesOnly && accessChanged) {
        // Everything except role and permissions still saves straight away.
        update(staff.map(s => s.id === editing
          ? { ...form, id: editing, role: before.role, permissions: beforePerms }
          : s));
        if (updateAccessRequests) {
          updateAccessRequests([{
            id: uid(), staffId: editing, staffName: form.name.trim(),
            previousRole: before.role, proposedRole: form.role,
            previousPermissions: beforePerms, proposedPermissions: { ...form.permissions },
            requestedBy: sessionName || 'Legal', requestedAt: new Date().toISOString(),
            status: 'Pending', reviewedBy: '', reviewedAt: '', reason: '',
          }, ...accessRequests]);
        }
        setProposed(form.name.trim());
        closeForm();
        return;
      }
      update(staff.map(s => s.id === editing ? { ...form, id: editing } : s));
    } else if (proposesOnly) {
      // A new hire Legal adds starts on their role's defaults; any custom
      // access Legal picked goes to an Admin as a proposal.
      const newId = uid();
      const roleDefaults = defaultPermissionsForRole(form.role);
      update([...staff, { ...form, id: newId, permissions: roleDefaults }]);
      const custom = PERMISSION_FIELDS.some(f => !!roleDefaults[f.key] !== !!form.permissions[f.key]);
      if (custom && updateAccessRequests) {
        updateAccessRequests([{
          id: uid(), staffId: newId, staffName: form.name.trim(),
          previousRole: form.role, proposedRole: form.role,
          previousPermissions: roleDefaults, proposedPermissions: { ...form.permissions },
          requestedBy: sessionName || 'Legal', requestedAt: new Date().toISOString(),
          status: 'Pending', reviewedBy: '', reviewedAt: '', reason: '',
        }, ...accessRequests]);
        setProposed(form.name.trim());
      }
    } else {
      update([...staff, { ...form, id: uid() }]);
    }
    closeForm();
  }
  function remove(id) { update(staff.filter(s => s.id !== id)); setConfirmId(null); }

  const filtered = staff.filter(s => {
    if (filterStatus !== 'all' && (s.status || 'Active') !== filterStatus) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return s.name.toLowerCase().includes(q) || s.role.toLowerCase().includes(q) || (s.email && s.email.toLowerCase().includes(q));
  });
  const sorted = [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  const lockedAccess = isTopRole(form.role);
  // Legal cannot touch an Admin — Admin is the highest power.
  const editingAdmin = editing ? isTopRole((staff.find(s => s.id === editing) || {}).role) : false;
  const blockedByRank = proposesOnly && editingAdmin;
  const onboardingCount = staff.filter(s => (s.status || 'Active') === 'Onboarding').length;

  return (
    <div>
      <SectionHeader title="Team" description="Everyone on the label side with access to this dashboard — profiles, roles, permissions, and onboarding progress." action={<Btn variant="primary" onClick={openAdd}><Plus size={14} /> Add team member</Btn>} />
      {proposesOnly && (
        <div className="rounded px-3 py-2 text-xs mb-4" style={{ background: C.amberSoft, color: C.amber, border: '1px solid ' + C.amber }}>
          You can change anyone's access here, including what an Admin set — but the change is a proposal. An Admin has to approve it in Access Requests before it takes effect.
        </div>
      )}
      {proposed && (
        <div className="rounded px-3 py-2 text-xs mb-4" style={{ background: C.tealSoft, color: C.teal, border: '1px solid ' + C.teal }}>
          Access change for {proposed} sent to an Admin for approval. <button onClick={() => setProposed('')} style={{ textDecoration: 'underline' }}>Dismiss</button>
        </div>
      )}

      <div className="flex flex-wrap gap-3 mb-6">
        <KPICard icon={Users} label="Team members" value={staff.length} />
        <KPICard icon={UserCog} label="Onboarding" value={onboardingCount} tone={onboardingCount > 0 ? 'amber' : undefined} />
      </div>

      <div className="rounded border p-4 mb-6" style={{ background: C.panel, borderColor: C.border }}>
        <div className="imss-form-grid gap-3">
          <Field label="Status">
            <Select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="all">All statuses</option>
              {STAFF_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </Select>
          </Field>
          <Field label="Search" full><Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Name, role, or email" /></Field>
        </div>
      </div>

      {showForm && (
        <form onSubmit={save} className="rounded border p-4 mb-6" style={{ background: C.panel, borderColor: C.borderLight }}>
          <div className="flex items-center gap-3 mb-4">
            <Avatar name={form.name} photoUrl={form.photoUrl} size={64} />
            <div className="flex flex-col gap-1">
              <input ref={photoInputRef} type="file" accept="image/*" onChange={handlePhotoUpload} className="text-xs" style={{ color: C.textDim, maxWidth: 220 }} />
              {form.photoUrl && <button type="button" onClick={() => setForm({ ...form, photoUrl: '' })} className="text-xs text-left" style={{ color: C.textFaint }}>Remove photo</button>}
            </div>
          </div>
          <div className="imss-form-grid gap-3 mb-4">
            <Field label="Name"><Input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Dana Whitfield" /></Field>
            <Field label="Role">
              <Select value={form.role} onChange={e => changeRole(e.target.value)}>
                {STAFF_ROLES.filter(r => !proposesOnly || editingAdmin || !isTopRole(r)).map(r => <option key={r} value={r}>{r}</option>)}
              </Select>
            </Field>
            <Field label="Work email">
              <Input type="email" required value={form.email} onChange={e => { setForm({ ...form, email: e.target.value }); setEmailError(''); }} placeholder={'name@' + STAFF_EMAIL_DOMAINS[0]} aria-invalid={!!emailError} />
              {emailError && <span className="text-xs" role="alert" style={{ color: C.red }}>{emailError}</span>}
            </Field>
            <Field label="Phone"><Input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="Optional" /></Field>
            <Field label="Start date"><Input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} /></Field>
            <Field label="Status">
              <Select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                {STAFF_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </Select>
            </Field>
            <Field label="Bio / notes" full><TextArea rows={2} value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} placeholder="What they're joining to do, background, anything worth noting." /></Field>
          </div>

          <div className="text-xs mb-2" style={{ color: C.textFaint }}>Access {lockedAccess && '— Admins always have full access'}</div>
          {blockedByRank && (
            <div className="rounded px-3 py-2 text-xs mb-2" style={{ background: C.redSoft, color: C.red, border: '1px solid ' + C.red }}>
              Admin is the highest role — Legal can't change an Admin's access. Ask an Admin to make this change.
            </div>
          )}
          <div className="rounded border p-3 mb-4" style={{ borderColor: C.border, background: C.bg }}>
            <div className="grid grid-cols-1 gap-2">
              {PERMISSION_FIELDS.map(f => (
                <label key={f.key} className="flex items-start gap-2 text-sm" style={{ color: (lockedAccess || blockedByRank) ? C.textFaint : C.text, opacity: (lockedAccess || blockedByRank) ? 0.6 : 1 }}>
                  <input type="checkbox" checked={lockedAccess ? true : !!form.permissions[f.key]} disabled={lockedAccess || blockedByRank} onChange={() => togglePermission(f.key)} style={{ marginTop: 3 }} />
                  <span>
                    <span style={{ fontWeight: 500 }}>{f.label}</span>
                    <span className="block text-xs" style={{ color: C.textFaint }}>{f.desc}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="text-xs mb-2" style={{ color: C.textFaint }}>Onboarding checklist — {onboardingProgress(form).done}/{onboardingProgress(form).total} complete</div>
          <div className="rounded border p-3 mb-4" style={{ borderColor: C.border, background: C.bg }}>
            <div className="flex flex-col gap-2 mb-3">
              {form.onboarding.map(t => (
                <div key={t.id} className="flex items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-sm" style={{ color: t.done ? C.textFaint : C.text, textDecoration: t.done ? 'line-through' : 'none' }}>
                    <input type="checkbox" checked={t.done} onChange={() => toggleTask(t.id)} />
                    {t.label}
                  </label>
                  <button type="button" onClick={() => removeTask(t.id)} style={{ color: C.textFaint }}><Trash2 size={12} /></button>
                </div>
              ))}
              {form.onboarding.length === 0 && <div className="text-xs" style={{ color: C.textFaint }}>No tasks yet.</div>}
            </div>
            <div className="flex gap-2">
              <Input value={newTaskLabel} onChange={e => setNewTaskLabel(e.target.value)} placeholder="Add a custom task" />
              <Btn variant="ghost" type="button" onClick={addTask}>Add</Btn>
            </div>
          </div>

          <div className="flex gap-2 mt-1">
            <Btn variant="primary" type="submit">{editing ? 'Save changes' : 'Add team member'}</Btn>
            <Btn variant="ghost" onClick={closeForm}>Cancel</Btn>
            {isTopRole(sessionRole) && editing && <SendLinkButton labeled email={(staff.find(x => x.id === editing) || {}).email} />}
          </div>
        </form>
      )}

      <ExportBar filename="imss-team" headers={['Name', 'Role', 'Status', 'Email', 'Phone', 'Start Date', 'Onboarding Progress']} rows={sorted.map(s => {
        const prog = onboardingProgress(s);
        return [s.name, s.role, s.status || 'Active', s.email || '', s.phone || '', s.startDate || '', prog.total > 0 ? prog.done + '/' + prog.total : ''];
      })} />

      <div className="flex justify-end gap-1 mb-4">
        <SegmentedToggle options={[{ id: 'grid', label: 'Grid' }, { id: 'table', label: 'Table' }]} value={view} onChange={setView} />
      </div>

      {sorted.length === 0 ? (
        <EmptyState icon={UserCog} title="No team members yet" description="Add the people on your side of the label — this list is also what populates sign-in, roster assignments, and access control." />
      ) : view === 'grid' ? (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
          {sorted.map(s => {
            const prog = onboardingProgress(s);
            const status = s.status || 'Active';
            return (
              <button key={s.id} onClick={() => openEdit(s)} className="text-left rounded border p-4" style={{ background: C.panel, borderColor: C.border }}>
                <div className="flex items-center gap-3 mb-3">
                  <Avatar name={s.name} photoUrl={s.photoUrl} size={48} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                    <div className="text-xs" style={{ color: C.textFaint }}>{s.role}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap mb-2">
                  <Badge tone={status === 'Active' ? 'teal' : status === 'Onboarding' ? 'amber' : 'default'}>{status}</Badge>
                </div>
                {status === 'Onboarding' && prog.total > 0 && (
                  <div className="mb-2">
                    <div className="rounded-full overflow-hidden" style={{ height: 4, background: C.panel2 }}>
                      <div style={{ height: 4, width: prog.pct + '%', background: C.amber }} />
                    </div>
                    <div className="text-xs mt-1" style={{ color: C.textFaint }}>{prog.done}/{prog.total} onboarding tasks</div>
                  </div>
                )}
                <div className="text-xs" style={{ color: C.textFaint }}>{s.email || 'No email set'}</div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="rounded border overflow-x-auto" style={{ borderColor: C.border, background: C.panel }}>
          <table className="w-full" style={{ minWidth: 720 }}>
            <thead><tr><Th></Th><Th>Name</Th><Th>Role</Th><Th>Status</Th><Th>Onboarding</Th><Th>Email</Th><Th align="right">Actions</Th></tr></thead>
            <tbody>
              {sorted.map(s => {
                const prog = onboardingProgress(s);
                const status = s.status || 'Active';
                return (
                  <tr key={s.id}>
                    <Td><Avatar name={s.name} photoUrl={s.photoUrl} size={32} /></Td>
                    <Td>{s.name}</Td>
                    <Td><Badge tone={s.role === 'Admin' ? 'amber' : s.role === 'Finance' ? 'teal' : 'default'}>{s.role}</Badge></Td>
                    <Td><Badge tone={status === 'Active' ? 'teal' : status === 'Onboarding' ? 'amber' : 'default'}>{status}</Badge></Td>
                    <Td mono>{prog.total > 0 ? prog.done + '/' + prog.total : '—'}</Td>
                    <Td>{s.email || '—'}</Td>
                    <Td align="right">
                      {confirmId === s.id ? <ConfirmInline onConfirm={() => remove(s.id)} onCancel={() => setConfirmId(null)} /> : (
                        <span className="inline-flex gap-3 justify-end">
                          {isTopRole(sessionRole) && <SendLinkButton email={s.email} />}
                          <button onClick={() => openEdit(s)} style={{ color: C.textDim }}><Pencil size={14} /></button>
                          <button onClick={() => setConfirmId(s.id)} style={{ color: C.textDim }}><Trash2 size={14} /></button>
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
    </div>
  );
}

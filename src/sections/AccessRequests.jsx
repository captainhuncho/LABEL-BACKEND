import { CheckCircle2, ShieldCheck, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { PERMISSION_FIELDS, formatDate } from '../constants.js';
import { C } from '../theme.js';
import { Badge, Btn, EmptyState, KPICard, SectionHeader, Td, Th } from '../ui.jsx';

// Access changes proposed by Legal sit here until an Admin approves them.
// Legal can propose anything — including overriding what an Admin set — but
// nothing takes effect until an Admin signs it off.
export function AccessRequestsSection({ accessRequests, update, staff, updateStaff, isAdmin, sessionName }) {
  const [confirmId, setConfirmId] = useState(null);
  const pending = accessRequests.filter(r => r.status === 'Pending');
  const settled = accessRequests.filter(r => r.status !== 'Pending')
    .sort((a, b) => (b.reviewedAt || '').localeCompare(a.reviewedAt || ''));

  function approve(req) {
    const target = staff.find(s => s.id === req.staffId);
    if (target) {
      updateStaff(staff.map(s => s.id === req.staffId
        ? { ...s, role: req.proposedRole, permissions: req.proposedPermissions }
        : s));
    }
    update(accessRequests.map(r => r.id === req.id
      ? { ...r, status: target ? 'Approved' : 'Rejected',
          note: target ? '' : 'That team member no longer exists.',
          reviewedBy: sessionName, reviewedAt: new Date().toISOString() }
      : r));
  }
  function reject(req) {
    update(accessRequests.map(r => r.id === req.id
      ? { ...r, status: 'Rejected', reviewedBy: sessionName, reviewedAt: new Date().toISOString() }
      : r));
    setConfirmId(null);
  }

  function diffRows(req) {
    const rows = [];
    if (req.previousRole !== req.proposedRole) {
      rows.push({ key: 'role', label: 'Role', from: req.previousRole, to: req.proposedRole });
    }
    PERMISSION_FIELDS.forEach(f => {
      const before = !!(req.previousPermissions || {})[f.key];
      const after = !!(req.proposedPermissions || {})[f.key];
      if (before !== after) rows.push({ key: f.key, label: f.label, from: before ? 'Yes' : 'No', to: after ? 'Yes' : 'No', granted: after });
    });
    return rows;
  }

  return (
    <div>
      <SectionHeader title="Access Requests"
        description={isAdmin
          ? 'Access changes Legal has proposed. Nothing here has taken effect yet — approving is what applies it.'
          : 'Access changes you have proposed. An Admin has to approve them before they take effect.'} />

      <div className="flex flex-wrap gap-3 mb-6">
        <KPICard icon={ShieldCheck} label="Waiting on approval" value={pending.length} tone={pending.length ? 'amber' : undefined} />
        <KPICard icon={CheckCircle2} label="Approved" value={accessRequests.filter(r => r.status === 'Approved').length} tone="teal" />
        <KPICard icon={Trash2} label="Rejected" value={accessRequests.filter(r => r.status === 'Rejected').length} />
      </div>

      {pending.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="Nothing waiting"
          description={isAdmin ? 'When Legal proposes an access change, it lands here for you to approve.' : 'Change someone’s access from the Team tab and it will show up here for an Admin.'} />
      ) : (
        <div className="flex flex-col gap-4 mb-6">
          {pending.map(req => {
            const rows = diffRows(req);
            return (
              <div key={req.id} className="rounded border p-4" style={{ background: C.panel, borderColor: C.amber }}>
                <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                  <div>
                    <div style={{ fontWeight: 600 }}>{req.staffName}</div>
                    <div className="text-xs mt-0.5" style={{ color: C.textFaint }}>
                      Proposed by {req.requestedBy} · {formatDate(String(req.requestedAt).slice(0, 10))}
                    </div>
                  </div>
                  <Badge tone="amber">Pending</Badge>
                </div>

                {rows.length === 0 ? (
                  <div className="text-sm" style={{ color: C.textDim }}>No effective change.</div>
                ) : (
                  <div className="rounded border overflow-x-auto mb-3" style={{ borderColor: C.border, background: C.bg }}>
                    <table className="w-full" style={{ minWidth: 380 }}>
                      <thead><tr><Th>What changes</Th><Th>From</Th><Th>To</Th></tr></thead>
                      <tbody>
                        {rows.map(r => (
                          <tr key={r.key}>
                            <Td>{r.label}</Td>
                            <Td><span style={{ color: C.textFaint }}>{r.from}</span></Td>
                            <Td><span style={{ color: r.granted ? C.teal : C.amber, fontWeight: 600 }}>{r.to}</span></Td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {req.reason && <div className="text-sm mb-3" style={{ color: C.textDim }}>“{req.reason}”</div>}

                {isAdmin ? (
                  confirmId === req.id ? (
                    <div className="flex items-center gap-2 flex-wrap text-sm">
                      <span style={{ color: C.textDim }}>Reject this change?</span>
                      <button onClick={() => reject(req)} style={{ color: C.red, fontWeight: 600 }}>Yes, reject</button>
                      <button onClick={() => setConfirmId(null)} style={{ color: C.textDim }}>Cancel</button>
                    </div>
                  ) : (
                    <div className="flex gap-2 flex-wrap">
                      <Btn variant="primary" onClick={() => approve(req)}><CheckCircle2 size={14} /> Approve &amp; apply</Btn>
                      <Btn variant="ghost" onClick={() => setConfirmId(req.id)}>Reject</Btn>
                    </div>
                  )
                ) : (
                  <div className="text-xs" style={{ color: C.textFaint }}>Waiting on an Admin.</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {settled.length > 0 && (
        <div className="rounded border overflow-x-auto" style={{ borderColor: C.border, background: C.panel }}>
          <div className="text-xs px-4 pt-4 pb-2" style={{ color: C.textFaint }}>Decided</div>
          <table className="w-full" style={{ minWidth: 520 }}>
            <thead><tr><Th>Team member</Th><Th>Proposed by</Th><Th>Reviewed by</Th><Th>When</Th><Th align="right">Outcome</Th></tr></thead>
            <tbody>
              {settled.map(r => (
                <tr key={r.id}>
                  <Td>{r.staffName}</Td>
                  <Td>{r.requestedBy}</Td>
                  <Td>{r.reviewedBy || '—'}</Td>
                  <Td mono>{r.reviewedAt ? formatDate(String(r.reviewedAt).slice(0, 10)) : '—'}</Td>
                  <Td align="right"><Badge tone={r.status === 'Approved' ? 'teal' : 'red'}>{r.status}</Badge></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

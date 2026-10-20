import { ChevronDown, MessageSquare } from 'lucide-react';
import { useState } from 'react';
import { formatDate, isPmOf } from '../constants.js';
import { REQUEST_STATUSES } from '../seed.js';
import { C } from '../theme.js';
import { Badge, Btn, EmptyState, Field, KPICard, SectionHeader, Select, TextArea } from '../ui.jsx';

export function ArtistRequestsSection({ artistRequests, update, roster, sessionName, pmScope = null }) {
  const visibleRoster = pmScope ? roster.filter(a => isPmOf(a, pmScope)) : roster;
  const visibleArtistIds = new Set(visibleRoster.map(a => a.id));
  const visibleRequests = pmScope ? artistRequests.filter(r => visibleArtistIds.has(r.artistId)) : artistRequests;
  const [filterArtist, setFilterArtist] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [responseText, setResponseText] = useState('');

  const filtered = visibleRequests.filter(r => {
    if (filterArtist !== 'all' && r.artistId !== filterArtist) return false;
    if (filterStatus !== 'all' && r.status !== filterStatus) return false;
    return true;
  });
  const sorted = [...filtered].sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''));
  const openCount = visibleRequests.filter(r => r.status !== 'Resolved').length;

  function toggleExpand(r) {
    if (expandedId === r.id) { setExpandedId(null); return; }
    setExpandedId(r.id);
    setResponseText(r.response || '');
  }
  function updateStatus(id, status) {
    update(artistRequests.map(r => r.id === id ? { ...r, status, ...(status === 'Resolved' ? { resolvedAt: new Date().toISOString() } : {}) } : r));
  }
  function submitResponse(id) {
    if (!responseText.trim()) return;
    update(artistRequests.map(r => r.id === id ? { ...r, response: responseText.trim(), respondedBy: sessionName, status: r.status === 'Open' ? 'In Progress' : r.status } : r));
  }

  return (
    <div>
      <SectionHeader title="Artist Requests" description="Everything artists have asked for — meetings, marketing support, tour funding, and more." />

      {pmScope && (
        <div className="rounded px-3 py-2 text-xs mb-4" style={{ background: C.amberSoft, color: C.amber, border: '1px solid ' + C.amber }}>
          Showing only requests from artists assigned to you as Product Manager ({visibleRequests.length} of {artistRequests.length} total).
        </div>
      )}

      <div className="flex flex-wrap gap-3 mb-6">
        <KPICard icon={MessageSquare} label="Open requests" value={openCount} tone={openCount > 0 ? 'amber' : undefined} />
      </div>

      <div className="rounded border p-4 mb-6" style={{ background: C.panel, borderColor: C.border }}>
        <div className="imss-form-grid gap-3">
          <Field label="Artist">
            <Select value={filterArtist} onChange={e => setFilterArtist(e.target.value)}>
              <option value="all">All artists</option>
              {visibleRoster.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          </Field>
          <Field label="Status">
            <Select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="all">All</option>
              {REQUEST_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </Select>
          </Field>
        </div>
      </div>

      {sorted.length === 0 ? (
        <EmptyState icon={MessageSquare} title="No requests" description="Requests artists submit from their portal will show up here." />
      ) : (
        <div className="flex flex-col gap-3">
          {sorted.map(r => {
            const artist = roster.find(a => a.id === r.artistId);
            const expanded = expandedId === r.id;
            return (
              <div key={r.id} data-focus={r.id} className="rounded border overflow-hidden" style={{ background: C.panel, borderColor: C.border }}>
                <button onClick={() => toggleExpand(r)} className="w-full text-left p-4 flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Badge tone="teal">{artist ? artist.name : 'Unknown'}</Badge>
                      <Badge>{r.category}</Badge>
                      <Badge tone={r.status === 'Resolved' ? 'teal' : r.status === 'In Progress' ? 'amber' : 'default'}>{r.status}</Badge>
                    </div>
                    <div style={{ fontWeight: 600 }}>{r.title}</div>
                    <div className="text-xs mt-0.5" style={{ color: C.textFaint }}>{formatDate(r.submittedAt.slice(0, 10))}</div>
                  </div>
                  <ChevronDown size={16} color={C.textFaint} style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }} />
                </button>
                {expanded && (
                  <div className="px-4 pb-4">
                    <div className="rounded p-3 text-sm mb-3" style={{ background: C.bg, color: C.textDim }}>{r.message}</div>
                    {(r.messages || []).length > 0 && (
                            <ol className="imss-thread mb-3">
                              {r.messages.map((m, i) => (
                                <li key={i} className={m.from === 'artist' ? 'is-artist' : 'is-label'}>
                                  <div className="imss-thread-meta">{m.from === 'artist' ? (m.by || 'Artist') : (m.by || 'IMSS Records')} · {formatDate(String(m.at || '').slice(0, 10))}{m.via === 'email' ? ' · by email' : ''}</div>
                                  <div style={{ whiteSpace: 'pre-wrap' }}>{m.text}</div>
                                </li>
                              ))}
                            </ol>
                          )}
                    <Field label="Response" full><TextArea rows={3} value={responseText} onChange={e => setResponseText(e.target.value)} placeholder="Reply to the artist…" /></Field>
                    <div className="flex gap-2 flex-wrap mt-2">
                      <Btn variant="primary" onClick={() => submitResponse(r.id)}>Send response</Btn>
                      {REQUEST_STATUSES.filter(s => s !== r.status).map(s => (
                        <Btn key={s} variant="ghost" onClick={() => updateStatus(r.id, s)}>Mark {s}</Btn>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

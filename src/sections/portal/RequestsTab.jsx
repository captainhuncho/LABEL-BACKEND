import { ChevronDown, MessageSquare } from 'lucide-react';
import { formatDate } from '../../constants.js';
import { REQUEST_CATEGORIES } from '../../seed.js';
import { C } from '../../theme.js';
import { Badge, Btn, EmptyState, Field, Input, Select, TextArea } from '../../ui.jsx';

// The artist portal's requests tab (state lives in ArtistPortalShell).
export function RequestsTab({ artist, expandedRequestId, myArtistRequests, requestForm, setExpandedRequestId, setRequestForm, submitArtistRequest }) {
  return (
          <div>
            <div className="rounded border p-4 mb-6" style={{ background: C.panel, borderColor: C.border }}>
              <div className="text-xs mb-3" style={{ color: C.textFaint }}>New request</div>
              <div className="imss-form-grid gap-3 mb-3">
                <Field label="Category">
                  <Select value={requestForm.category} onChange={e => setRequestForm({ ...requestForm, category: e.target.value })}>
                    {REQUEST_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </Select>
                </Field>
                <Field label="Title"><Input value={requestForm.title} onChange={e => setRequestForm({ ...requestForm, title: e.target.value })} placeholder="One line summary" /></Field>
                <Field label="Details" full><TextArea rows={3} value={requestForm.message} onChange={e => setRequestForm({ ...requestForm, message: e.target.value })} placeholder="Give your PM or Admin what they need to help." /></Field>
              </div>
              <Btn variant="primary" onClick={submitArtistRequest}>Submit request</Btn>
            </div>

            {myArtistRequests.length === 0 ? (
              <EmptyState icon={MessageSquare} title="No requests yet" description="Need something from the label — a meeting, marketing support, tour funding? Submit it above." />
            ) : (
              <div className="flex flex-col gap-3">
                {myArtistRequests.map(r => {
                  const expanded = expandedRequestId === r.id;
                  return (
                    <div key={r.id} className="rounded border overflow-hidden" style={{ background: C.panel, borderColor: C.border }}>
                      <button onClick={() => setExpandedRequestId(expanded ? null : r.id)} className="w-full text-left p-4 flex items-center justify-between gap-3 flex-wrap">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <Badge>{r.category}</Badge>
                            <Badge tone={r.status === 'Resolved' ? 'teal' : r.status === 'In Progress' ? 'amber' : 'default'}>{r.status}</Badge>
                          </div>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{r.title}</div>
                          <div className="text-xs mt-0.5" style={{ color: C.textFaint }}>{formatDate(r.submittedAt.slice(0, 10))}</div>
                        </div>
                        <ChevronDown size={16} color={C.textFaint} style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }} />
                      </button>
                      {expanded && (
                        <div className="px-4 pb-4">
                          <div className="rounded p-3 text-sm" style={{ background: C.bg, color: C.textDim }}>{r.message}</div>
                          {(r.messages || []).length > 0 && (
                            <ol className="imss-thread mt-2">
                              {r.messages.map((m, i) => (
                                <li key={i} className={m.from === 'artist' ? 'is-artist' : 'is-label'}>
                                  <div className="imss-thread-meta">{m.from === 'artist' ? 'You' : (m.by || 'IMSS Records')} · {formatDate(String(m.at || '').slice(0, 10))}{m.via === 'email' ? ' · by email' : ''}</div>
                                  <div style={{ whiteSpace: 'pre-wrap' }}>{m.text}</div>
                                </li>
                              ))}
                            </ol>
                          )}
                          {r.response ? (
                            <div className="rounded p-3 text-sm mt-2" style={{ background: C.tealSoft, border: '1px solid ' + C.teal }}>
                              <div className="text-xs mb-1" style={{ color: C.teal, fontWeight: 600 }}>Response from {r.respondedBy || 'the label'}</div>
                              <div style={{ color: C.text }}>{r.response}</div>
                            </div>
                          ) : (
                            <div className="text-xs mt-2" style={{ color: C.textFaint }}>No response yet — your PM or Admin will get back to you here.</div>
                          )}
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

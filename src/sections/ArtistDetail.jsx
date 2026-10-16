import { CheckCircle2, ChevronLeft, ChevronRight, Disc3, DollarSign, Globe, Send, Mail, Pencil, Radio, Trash2, Wallet, ExternalLink } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { PLATFORM_COLORS, artistStatusTone, expirationStatus, formatCurrency, formatDate, formatNumber, monthLabel, releaseStatusTone, todayStr, uid } from '../constants.js';
import { artistLifetime, recoupmentForArtist, revenueRowSplit, artistSpend, pctAt, slug } from '../finance.js';
import { SOCIAL_LINKS, safeLink, PROFILE_EDITABLE_FIELDS } from '../seed.js';
import { supabase } from '../storage.js';
import { C } from '../theme.js';
import { ArtworkThumb, Avatar, Badge, Btn, KPICard, Td, TextArea, Th } from '../ui.jsx';
import { StatementFilesList } from './StatementFiles.jsx';

export function ArtistDetailPanel({ invoices = [], dealSection = null, statementFiles = [], artist, roster, catalog, revenue, streams, masterGross = [], payouts, ledger = [], tasks = [], labelSettings, staff, onBack, onEdit, canEdit, canViewRoyalties = true, canViewSpend = true, update, sessionName = '', isAdmin = false, profileRequests = [], updateProfileRequests }) {
  const artistCatalog = useMemo(() => catalog.filter(c => c.artistId === artist.id).sort((a, b) => (b.releaseDate || '').localeCompare(a.releaseDate || '')), [catalog, artist.id]);
  const releaseIds = useMemo(() => new Set(artistCatalog.map(c => c.id)), [artistCatalog]);
  const aSlug = useMemo(() => slug(artist.name), [artist.name]);

  const myRevenue = useMemo(() => revenue.filter(r => r.artistSlug === aSlug), [revenue, aSlug]);
  const myStreams = useMemo(() => streams.filter(s => releaseIds.has(s.releaseId)), [streams, releaseIds]);

  const lifetime = useMemo(() => artistLifetime(artist, revenue, masterGross), [artist, revenue, masterGross]);
  const recoupment = useMemo(() => recoupmentForArtist(artist, ledger, revenue, masterGross, invoices), [artist, ledger, revenue, masterGross, invoices]);
  const totalRevenue = myRevenue.reduce((s, r) => s + r.earning, 0);
  const totalStreams = myStreams.reduce((s, r) => s + r.count, 0);

  const remainingRecoupable = recoupment.unrecouped;
  const netAfterRecoupment = recoupment.dueOnTop;
  const paid = payouts.filter(p => p.artistSlug === aSlug && p.status === 'paid').reduce((s, p) => s + (p.artistShare || 0), 0);
  const balance = netAfterRecoupment - paid;
  const myExpenses = [...ledger.filter(x => x.artist === artist.name && x.type === 'expense')].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const isFunded = artist.fundingTier === 'Funded';
  // Budget used: label spend on the artist plus their approved claims.
  const totalSpent = artistSpend(artist, ledger, invoices).budgetUsed;
  const budgetRemaining = (artist.annualBudget || 0) - totalSpent;
  const budgetPct = artist.annualBudget > 0 ? Math.min(100, Math.round((totalSpent / artist.annualBudget) * 100)) : 0;
  const myPayouts = [...payouts.filter(p => p.artistSlug === aSlug)].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  const monthlyRevenue = useMemo(() => {
    const map = {};
    myRevenue.forEach(r => { map[r.month] = (map[r.month] || 0) + r.earning; });
    return Object.keys(map).sort().map(k => ({ month: monthLabel(k), value: map[k] }));
  }, [myRevenue]);

  const platformTotals = useMemo(() => {
    const map = {};
    myStreams.forEach(s => { map[s.platform] = (map[s.platform] || 0) + s.count; });
    return Object.keys(map).map(k => ({ name: k, value: map[k] }));
  }, [myStreams]);

  const contractStat = artist.contractExpiration ? expirationStatus(artist.contractExpiration) : null;
  const alerts = [];
  if (contractStat && contractStat.label !== 'Active') alerts.push({ tone: contractStat.tone, text: 'Contract ' + contractStat.label.toLowerCase() + (artist.contractExpiration ? ' (' + formatDate(artist.contractExpiration) + ')' : '') });
  artistCatalog.forEach(c => {
    if (!c.licenseExpiration) return;
    const st = c.license;
    if (st.label !== 'Active') alerts.push({ tone: st.tone, text: c.title + ' license ' + st.label.toLowerCase() });
  });
  if (canViewRoyalties && remainingRecoupable > 0) alerts.push({ tone: 'amber', text: formatCurrency(remainingRecoupable) + ' still unrecouped against future earnings' });

  const pmStaff = staff.find(s => s.name === artist.productManager);
  const myTasks = [...tasks.filter(t => t.artistId === artist.id && t.status === 'Open')].sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
  const [newComment, setNewComment] = useState('');
  const comments = artist.comments || [];
  const canApproveProfile = isAdmin || sessionName === artist.productManager;
  const myPendingProfileRequests = profileRequests.filter(r => r.artistId === artist.id && r.status === 'Pending');
  function approveProfileRequest(req) {
    if (update) update(roster.map(a => a.id === artist.id ? { ...a, ...req.changes } : a));
    if (updateProfileRequests) updateProfileRequests(profileRequests.map(r => r.id === req.id ? { ...r, status: 'Approved', reviewedBy: sessionName, reviewedAt: new Date().toISOString() } : r));
  }
  function rejectProfileRequest(req) {
    if (updateProfileRequests) updateProfileRequests(profileRequests.map(r => r.id === req.id ? { ...r, status: 'Rejected', reviewedBy: sessionName, reviewedAt: new Date().toISOString() } : r));
  }
  function addComment() {
    if (!newComment.trim() || !update) return;
    const comment = { id: uid(), author: sessionName || 'Unknown', text: newComment.trim(), createdAt: new Date().toISOString() };
    update(roster.map(a => a.id === artist.id ? { ...a, comments: [...(a.comments || []), comment] } : a));
    setNewComment('');
  }
  function removeComment(id) {
    if (!update) return;
    update(roster.map(a => a.id === artist.id ? { ...a, comments: (a.comments || []).filter(c => c.id !== id) } : a));
  }
  const anrStaff = staff.find(s => s.name === artist.anr);

  return (
    <div>
      <button onClick={onBack} className="text-sm inline-flex items-center gap-1.5 mb-4" style={{ color: C.textDim }}><ChevronLeft size={14} /> Back to roster</button>

      <div className="rounded border p-4 mb-6 flex items-start gap-4 flex-wrap justify-between" style={{ background: C.panel, borderColor: C.border }}>
        <div className="flex items-center gap-4 flex-wrap">
          <Avatar name={artist.name} photoUrl={artist.photoUrl} size={72} />
          <div>
            <div style={{ fontWeight: 600, fontSize: 20 }}>{artist.name}</div>
            <div className="text-sm mt-1" style={{ color: C.textFaint }}>{artist.genre || 'No genre set'}{artist.subGenre ? ' · ' + artist.subGenre : ''}</div>
            <div className="flex items-center gap-1.5 flex-wrap mt-2">
              <Badge tone={artistStatusTone(artist.status)}>{artist.status}</Badge>
              <Badge>{artist.royaltyRate}% royalty</Badge>
              {isFunded && <Badge tone="teal">Funded</Badge>}
              {artist.primaryMarket && <Badge tone="teal"><Globe size={10} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />{artist.primaryMarket}</Badge>}
              {artist.secondaryMarket && <Badge>+ {artist.secondaryMarket}</Badge>}
            </div>
            {SOCIAL_LINKS.some(l => safeLink(artist[l.key])) && (
              <div className="flex items-center gap-2 flex-wrap mt-3" aria-label="Socials and streaming">
                {SOCIAL_LINKS.filter(l => safeLink(artist[l.key])).map(l => (
                  <a key={l.key} href={safeLink(artist[l.key])} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1" style={{ background: C.fill, color: C.text, borderRadius: 980, padding: '4px 12px', fontSize: 13 }}>{l.label} <ExternalLink size={11} /></a>
                ))}
              </div>
            )}
          </div>
        </div>
        {canEdit && <Btn variant="primary" onClick={() => onEdit(artist)}><Pencil size={14} /> Edit profile</Btn>}
      </div>

      {alerts.length > 0 && (
        <div className="rounded border p-4 mb-6" style={{ background: C.amberSoft, borderColor: C.amber }}>
          <div className="text-xs mb-2" style={{ color: C.amber, fontWeight: 600 }}>Needs attention</div>
          <div className="flex flex-col gap-1.5">
            {alerts.map((a, i) => (
              <div key={i} className="flex items-center gap-2 text-sm" style={{ color: C.text }}>
                <span style={{ width: 6, height: 6, borderRadius: 9999, background: a.tone === 'red' ? C.red : C.amber, flexShrink: 0 }}></span>
                {a.text}
              </div>
            ))}
          </div>
        </div>
      )}

      {canApproveProfile && myPendingProfileRequests.length > 0 && (
        <div className="rounded border p-4 mb-6" style={{ background: C.amberSoft, borderColor: C.amber }}>
          <div className="text-xs mb-3" style={{ color: C.amber, fontWeight: 600 }}>{artist.name} requested profile changes</div>
          <div className="flex flex-col gap-3">
            {myPendingProfileRequests.map(req => (
              <div key={req.id} className="rounded p-3" style={{ background: C.panel, border: '1px solid ' + C.border }}>
                <div className="flex flex-col gap-1.5 mb-3">
                  {Object.entries(req.changes).map(([key, value]) => {
                    const field = PROFILE_EDITABLE_FIELDS.find(f => f.key === key);
                    const current = artist[key] || '';
                    return (
                      <div key={key} className="text-sm">
                        <span style={{ fontWeight: 600 }}>{field ? field.label : key}:</span>{' '}
                        {key === 'photoUrl' ? (
                          <span className="inline-flex items-center gap-2 align-middle">
                            <Avatar name={artist.name} photoUrl={current} size={24} /> <ChevronRight size={12} /> <Avatar name={artist.name} photoUrl={value} size={24} />
                          </span>
                        ) : (
                          <span style={{ color: C.textDim }}>"{current || '—'}" <ChevronRight size={11} style={{ display: 'inline', verticalAlign: 'middle' }} /> "{value}"</span>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  <Btn variant="primary" onClick={() => approveProfileRequest(req)}>Approve</Btn>
                  <Btn variant="ghost" onClick={() => rejectProfileRequest(req)}>Reject</Btn>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3 mb-6">
        {canViewRoyalties && <KPICard icon={DollarSign} label="Total revenue" value={formatCurrency(totalRevenue)} tone="teal" />}
        <KPICard icon={Radio} label="Total streams" value={formatNumber(totalStreams)} />
        <KPICard icon={Disc3} label="Releases" value={artistCatalog.length} />
        {canViewRoyalties && <KPICard icon={Wallet} label="Balance owed" value={formatCurrency(Math.max(0, balance))} tone={balance > 0 ? 'amber' : undefined} />}
      </div>

      <div className="rounded border p-4 mb-6" style={{ background: C.panel, borderColor: C.border }}>
        <div className="text-xs mb-3" style={{ color: C.textFaint }}>Contacts &amp; dates</div>
        <div className="imss-grid-2 gap-3 text-sm">
          <div>
            <div style={{ color: C.textFaint }} className="text-xs mb-0.5">Product Manager</div>
            <div>{artist.productManager || '—'}{pmStaff && pmStaff.email ? ' · ' + pmStaff.email : ''}</div>
          </div>
          <div>
            <div style={{ color: C.textFaint }} className="text-xs mb-0.5">A&amp;R</div>
            <div>{artist.anr || '—'}{anrStaff && anrStaff.email ? ' · ' + anrStaff.email : ''}</div>
          </div>
          <div>
            <div style={{ color: C.textFaint }} className="text-xs mb-0.5">Signed</div>
            <div>{artist.signedDate ? formatDate(artist.signedDate) : '—'}</div>
          </div>
          <div>
            <div style={{ color: C.textFaint }} className="text-xs mb-0.5">Contract expiration</div>
            <div className="flex items-center gap-2">
              {artist.contractExpiration ? formatDate(artist.contractExpiration) : '—'}
              {contractStat && contractStat.label !== 'Active' && <Badge tone={contractStat.tone}>{contractStat.label}</Badge>}
            </div>
          </div>
          <div>
            <div style={{ color: C.textFaint }} className="text-xs mb-0.5">Email</div>
            <div>{artist.email || '—'}</div>
          </div>
        </div>
        {artist.notes && (
          <div className="mt-3 pt-3 text-sm" style={{ borderTop: '1px solid ' + C.border, color: C.textDim }}>{artist.notes}</div>
        )}
      </div>

      {myTasks.length > 0 && (
        <div className="rounded border mb-6" style={{ background: C.panel, borderColor: C.border }}>
          <div className="text-xs px-4 pt-4 pb-2" style={{ color: C.textFaint }}>Active work</div>
          <table className="w-full">
            <tbody>
              {myTasks.map(t => {
                const overdue = t.dueDate && t.dueDate < todayStr();
                const release = t.releaseId ? catalog.find(c => c.id === t.releaseId) : null;
                return (
                  <tr key={t.id}>
                    <Td>{t.title}{release && <div className="text-xs" style={{ color: C.textFaint }}>{release.title}</div>}</Td>
                    <Td>{t.assignee}</Td>
                    <Td align="right" mono style={{ color: overdue ? C.red : undefined }}>{t.dueDate ? formatDate(t.dueDate) : '—'}</Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="rounded border p-4 mb-6" style={{ background: C.panel, borderColor: C.border }}>
        <div className="text-xs mb-3" style={{ color: C.textFaint }}>Team notes ({comments.length})</div>
        {comments.length === 0 ? (
          <div className="text-sm mb-3" style={{ color: C.textDim }}>No notes yet — leave context here for whoever picks this up next.</div>
        ) : (
          <div className="flex flex-col gap-3 mb-3" style={{ maxHeight: 280, overflowY: 'auto' }}>
            {comments.map(c => (
              <div key={c.id} className="rounded p-3" style={{ background: C.bg, border: '1px solid ' + C.border }}>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs" style={{ fontWeight: 600, color: C.textDim }}>{c.author}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: C.textFaint }}>{new Date(c.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                    {canEdit && <button onClick={() => removeComment(c.id)} style={{ color: C.textFaint }}><Trash2 size={11} /></button>}
                  </span>
                </div>
                <div className="text-sm" style={{ color: C.text }}>{c.text}</div>
              </div>
            ))}
          </div>
        )}
        {canEdit && (
          <div className="flex gap-2">
            <TextArea rows={2} value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="Leave a note for the team — status updates, context, anything worth remembering." />
            <Btn variant="primary" onClick={addComment}>Post</Btn>
          </div>
        )}
      </div>

      <div className="imss-grid-2 gap-4 mb-6">
        {canViewRoyalties && (
          <div className="rounded p-4 border" style={{ background: C.panel, borderColor: C.border }}>
            <div className="text-xs mb-3" style={{ color: C.textFaint }}>Revenue by month</div>
            <div style={{ height: 200 }}>
              {monthlyRevenue.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm" style={{ color: C.textFaint }}>No revenue yet</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyRevenue}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                    <XAxis dataKey="month" tick={{ fill: C.textFaint, fontSize: 11 }} axisLine={{ stroke: C.border }} tickLine={false} />
                    <YAxis tick={{ fill: C.textFaint, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? '$' + Math.round(v / 1000) + 'k' : '$' + Math.round(v)} />
                    <Tooltip contentStyle={{ background: C.panel2, border: '1px solid ' + C.border, borderRadius: 12, fontSize: 13, color: C.text }} labelStyle={{ color: C.text }} formatter={(v) => formatCurrency(v)} />
                    <Bar dataKey="value" fill={C.amber} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        )}
        <div className="rounded p-4 border" style={{ background: C.panel, borderColor: C.border }}>
          <div className="text-xs mb-3" style={{ color: C.textFaint }}>Streams by platform</div>
          <div style={{ height: 200 }}>
            {platformTotals.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm" style={{ color: C.textFaint }}>No stream data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={platformTotals} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70} paddingAngle={2}>
                    {platformTotals.map((p) => (<Cell key={p.name} fill={PLATFORM_COLORS[p.name] || C.textFaint} />))}
                  </Pie>
                  <Tooltip contentStyle={{ background: C.panel2, border: '1px solid ' + C.border, borderRadius: 12, fontSize: 13, color: C.text }} formatter={(v) => formatNumber(v)} />
                  <Legend wrapperStyle={{ fontSize: 11, color: C.textDim }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="rounded border mb-6" style={{ background: C.panel, borderColor: C.border }}>
        <div className="text-xs px-4 pt-4 pb-2" style={{ color: C.textFaint }}>Releases</div>
        {artistCatalog.length === 0 ? (
          <div className="p-4 text-sm" style={{ color: C.textDim }}>No releases yet.</div>
        ) : (
          <table className="w-full">
            <thead><tr><Th></Th><Th>Title</Th><Th>Type</Th><Th>Release date</Th><Th>Status</Th><Th>License</Th></tr></thead>
            <tbody>
              {artistCatalog.map(c => {
                const lic = c.licenseExpiration ? c.license : null;
                return (
                  <tr key={c.id}>
                    <Td><ArtworkThumb release={c} size={32} /></Td>
                    <Td>{c.title}</Td>
                    <Td>{c.type}</Td>
                    <Td mono>{formatDate(c.releaseDate)}</Td>
                    <Td><Badge tone={releaseStatusTone(c.status)}>{c.status}</Badge></Td>
                    <Td>{lic ? <Badge tone={lic.tone}>{lic.label}</Badge> : '—'}</Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {canViewSpend && isFunded && (
        <div className="rounded border p-4 mb-6" style={{ background: C.panel, borderColor: C.border }}>
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs" style={{ color: C.textFaint }}>Annual budget</div>
            <div className="text-xs" style={{ color: C.textFaint }}>{formatCurrency(totalSpent)} of {formatCurrency(artist.annualBudget || 0)} spent</div>
          </div>
          <div className="rounded-full overflow-hidden" style={{ height: 8, background: C.panel2 }}>
            <div style={{ height: 8, width: budgetPct + '%', background: budgetRemaining < 0 ? C.red : C.amber }} />
          </div>
          <div className="flex flex-wrap gap-3 mt-4">
            <KPICard icon={DollarSign} label="Budget allocated" value={formatCurrency(artist.annualBudget || 0)} />
            <KPICard icon={DollarSign} label="Spent" value={formatCurrency(totalSpent)} tone="amber" />
            <KPICard icon={Wallet} label="Remaining" value={formatCurrency(budgetRemaining)} tone={budgetRemaining < 0 ? 'red' : 'teal'} />
          </div>
        </div>
      )}

      {(canViewSpend || canViewRoyalties) && (
        <div className="imss-grid-2 gap-4">
          {canViewSpend && (
          <div className="rounded border" style={{ background: C.panel, borderColor: C.border }}>
            <div className="text-xs px-4 pt-4 pb-2" style={{ color: C.textFaint }}>Recent expenses</div>
            {myExpenses.length === 0 ? (
              <div className="p-4 text-sm" style={{ color: C.textDim }}>No expenses logged.</div>
            ) : (
              <table className="w-full">
                <tbody>
                  {myExpenses.slice(0, 6).map(x => (
                    <tr key={x.id}>
                      <Td mono>{formatDate(x.date)}</Td>
                      <Td>{x.category}</Td>
                      <Td align="right" mono>{formatCurrency(x.amount)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          )}
          {dealSection && <div className="rounded p-5 mb-4" style={{ background: C.panel }}>{dealSection}</div>}
          {canViewRoyalties && <div className="mb-4"><StatementFilesList files={statementFiles.filter(f => f.artistId === artist.id)} rows={myRevenue} splitOf={r => revenueRowSplit(r, revenue, masterGross, pctAt(artist, r.month))} artistName={artist.name} empty="No statement files yet. Import an EMPIRE detailed report and it’s kept here." /></div>}
          {canViewRoyalties && (
          <div className="rounded border" style={{ background: C.panel, borderColor: C.border }}>
            <div className="text-xs px-4 pt-4 pb-2" style={{ color: C.textFaint }}>Payout history</div>
            {myPayouts.length === 0 ? (
              <div className="p-4 text-sm" style={{ color: C.textDim }}>No payouts recorded.</div>
            ) : (
              <table className="w-full">
                <tbody>
                  {myPayouts.slice(0, 6).map(p => (
                    <tr key={p.id}>
                      <Td mono>{p.periodStart} – {p.periodEnd}</Td>
                      <Td><Badge tone={p.status === 'paid' ? 'teal' : undefined}>{p.status}</Badge></Td>
                      <Td align="right" mono>{formatCurrency(p.artistShare)}</Td>
                    </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
          )}
      </div>
      )}
    </div>
  );
}

// Admin-only: emails someone a fresh sign-in link (same email they'd get from the sign-in page).
export function SendLinkButton({ email, labeled = false }) {
  const [state, setState] = useState('idle');
  if (!supabase || !email) return null;
  async function send() {
    setState('sending');
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
    setState(error ? 'error' : 'sent');
    setTimeout(() => setState('idle'), 4000);
  }
  const label = state === 'sent' ? 'Sign-in link sent to ' + email : state === 'error' ? 'Could not send. Try again shortly.' : 'Email ' + email + ' a sign-in link';
  // In edit forms: a full button naming the saved address the link goes to.
  if (labeled) {
    return (
      <span className="inline-flex items-center gap-2">
        <Btn variant="ghost" onClick={send} disabled={state === 'sending'}><Mail size={14} /> {state === 'sending' ? 'Sending…' : 'Send sign-in link'}</Btn>
        <span className="text-xs" role="status" style={{ color: state === 'sent' ? C.teal : state === 'error' ? C.red : C.textFaint }}>
          {state === 'idle' || state === 'sending' ? 'to ' + email : label}
        </span>
      </span>
    );
  }
  return (
    <button onClick={send} disabled={state === 'sending'} title={label} aria-label={label}
      style={{ color: state === 'sent' ? C.teal : state === 'error' ? C.red : C.textDim }}>
      {state === 'sent' ? <CheckCircle2 size={14} /> : <Mail size={14} />}
    </button>
  );
}

import { Globe, Pencil, Plus, Search, Trash2, Users, Archive } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ARTIST_STATUSES, DEAL_FIELDS, FUNDING_TIERS, DEAL_TYPES, dealLabel, GENRES, MARKETS, SUB_GENRES, artistStatusTone, expirationStatus, formatDate, todayStr, uid } from '../constants.js';
import { DEFAULT_DELIVERY_DAYS } from '../finance.js';
import { SOCIAL_LINKS } from '../seed.js';
import DealChanges from './DealChanges.jsx';
import { C, HEADING_FONT, MONO_FONT } from '../theme.js';
import { Avatar, Badge, Btn, ConfirmInline, EmptyState, ExportBar, Field, Input, SectionHeader, SegmentedToggle, Select, Td, TextArea, Th, resizeImageFile } from '../ui.jsx';
import { ArtistDetailPanel } from './ArtistDetail.jsx';

export function RosterSection({ updateStatementFiles, focus = null, updateCatalog, updateTasks, invoices = [], dealChanges = [], updateDealChanges, session = {}, publishedRevenue = [], statementFiles = [], roster, update, catalog, staff, canEdit = true, pmScope = null, revenue = [], streams = [], masterGross = [], payouts = [], ledger = [], labelSettings, canViewRoyalties = true, canViewSpend = true, tasks = [], sessionName = '', isAdmin = false, profileRequests = [], updateProfileRequests }) {
  const [detailId, setDetailId] = useState(focus && focus.artistId || null);
  // Deal terms (share, funding, contract) are for Admin, Finance, Legal and Artist earnings; the database hides them from everyone else.
  const canSeeDeals = canViewRoyalties || ['Admin', 'Finance', 'Legal'].includes(session.role);
  // Only Admin and Legal add artists (enforced in the database too).
  const canAddArtists = ['Admin', 'Legal'].includes(session.role);
  useEffect(() => { if (focus && focus.artistId) setDetailId(focus.artistId); }, [focus]);
  const empty = { name: '', genre: '', subGenre: '', royaltyRate: 50, signedDate: todayStr(), contractExpiration: '', email: '', status: 'Active', notes: '', photoUrl: '', productManager: pmScope || '', anr: '', primaryMarket: '', secondaryMarket: '', fundingTier: 'Non-Funded', annualBudget: '', driveFolder: '', reportingPeriod: 'quarterly', deliveryDays: '', payoutThreshold: '' };
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [query, setQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterGenre, setFilterGenre] = useState('all');
  const [filterMarket, setFilterMarket] = useState('all');
  const [view, setView] = useState('grid');
  const [confirmId, setConfirmId] = useState(null);
  const [form, setForm] = useState(empty);
  const photoInputRef = useRef(null);

  function openAdd() { setForm({ ...empty, productManager: pmScope || '' }); setEditing(null); setShowForm(true); }
  function openEdit(a) { setForm({ ...empty, ...a }); setEditing(a.id); setShowForm(true); setFormError(''); }
  const [formError, setFormError] = useState('');
  function closeForm() { setShowForm(false); setEditing(null); if (photoInputRef.current) photoInputRef.current.value = ''; }

  function save(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    let payload = { ...form, royaltyRate: Number(form.royaltyRate), artistPct: Number(form.royaltyRate) / 100, payoutThreshold: Number(form.payoutThreshold) || 0, deliveryDays: Number(form.deliveryDays) || '', annualBudget: form.fundingTier === 'Funded' ? (Number(form.annualBudget) || 0) : 0 };
    // The split and deal change only through Deal changes, dated and approved.
    if (editing) { const o = roster.find(a => a.id === editing); payload = { ...payload, artistPct: o.artistPct, royaltyRate: o.royaltyRate, fundingTier: o.fundingTier, dealType: o.dealType, dealTerms: o.dealTerms }; }
    // Without deal access, leave the terms out: existing ones are kept by the database, new artists get theirs from an Admin.
    if (!canSeeDeals) DEAL_FIELDS.forEach(k => { delete payload[k]; });
    setFormError('');
    if (editing) update(roster.map(a => a.id === editing ? { ...payload, id: editing } : a));
    else update([...roster, { ...payload, id: uid() }]);
    closeForm();
  }
  // Artists are never deleted: archiving keeps their history and removes their sign-in.
  function remove(id) { update(roster.map(a => a.id !== id ? a : { ...a, status: 'Archived', archivedFrom: a.status, archivedAt: new Date().toISOString(), archivedBy: sessionName })); setConfirmId(null); }
  function restore(id) { update(roster.map(a => a.id !== id ? a : { ...a, status: a.archivedFrom && a.archivedFrom !== 'Archived' ? a.archivedFrom : 'Active', archivedAt: null, archivedBy: null })); }
  function handlePhotoUpload(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    resizeImageFile(file, 300, dataUrl => setForm(f => ({ ...f, photoUrl: dataUrl })));
  }

  const visibleRoster = pmScope ? roster.filter(a => a.productManager === pmScope) : roster;
  const genres = Array.from(new Set(visibleRoster.map(a => a.genre).filter(Boolean))).sort();
  const marketsInUse = Array.from(new Set(visibleRoster.flatMap(a => [a.primaryMarket, a.secondaryMarket]).filter(Boolean))).sort();

  const filtered = visibleRoster.filter(a => {
    if (filterStatus === 'all' ? a.status === 'Archived' : a.status !== filterStatus) return false;
    if (filterGenre !== 'all' && a.genre !== filterGenre) return false;
    if (filterMarket !== 'all' && a.primaryMarket !== filterMarket && a.secondaryMarket !== filterMarket) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    if (a.name.toLowerCase().includes(q)) return true;
    if (a.genre && a.genre.toLowerCase().includes(q)) return true;
    return catalog.some(c => c.artistId === a.id && (
      c.title.toLowerCase().includes(q) ||
      (c.upc && c.upc.toLowerCase().includes(q))
    ));
  });
  const filtersActive = filterStatus !== 'all' || filterGenre !== 'all' || filterMarket !== 'all' || !!query;

  return (
    <div>
      {pmScope && (
        <div className="rounded px-3 py-2 text-xs mb-4" style={{ background: C.amberSoft, color: C.amber, border: '1px solid ' + C.amber }}>
          Showing only artists assigned to you as Product Manager ({visibleRoster.length} of {roster.length} total).
        </div>
      )}
      <SectionHeader title="Roster" description="Everyone signed to the label, their royalty terms, and status." action={canEdit && canAddArtists && <Btn variant="primary" onClick={openAdd}><Plus size={14} /> Add artist</Btn>} />

      {detailId && roster.find(a => a.id === detailId) ? (
        <ArtistDetailPanel
          invoices={invoices}
          canSeeDeals={canSeeDeals}
          dealSection={canSeeDeals && <DealChanges roster={roster} updateRoster={update} changes={dealChanges} updateChanges={updateDealChanges} publishedRevenue={publishedRevenue} session={session} artistId={detailId} canEdit={canEdit} catalog={catalog} updateCatalog={updateCatalog} tasks={tasks} updateTasks={updateTasks} ledger={ledger} invoices={invoices} />}
          statementFiles={statementFiles}
          updateStatementFiles={updateStatementFiles}
          artist={roster.find(a => a.id === detailId)}
          roster={roster} catalog={catalog} revenue={revenue} streams={streams} masterGross={masterGross}
          payouts={payouts} ledger={ledger} labelSettings={labelSettings} staff={staff}
          tasks={tasks}
          onBack={() => setDetailId(null)}
          onEdit={(a) => { setDetailId(null); openEdit(a); }}
          canEdit={canEdit}
          canViewRoyalties={canViewRoyalties}
          canViewSpend={canViewSpend}
          update={update}
          sessionName={sessionName}
          isAdmin={isAdmin}
          profileRequests={profileRequests}
          updateProfileRequests={updateProfileRequests}
        />
      ) : (
        <>


      <div className="rounded border p-4 mb-6" style={{ background: C.panel, borderColor: C.border }}>
        <div className="imss-form-grid gap-3">
          <Field label="Status">
            <Select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="all">All statuses</option>
              {ARTIST_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </Select>
          </Field>
          <Field label="Genre">
            <Select value={filterGenre} onChange={e => setFilterGenre(e.target.value)}>
              <option value="all">All genres</option>
              {genres.map(g => <option key={g} value={g}>{g}</option>)}
            </Select>
          </Field>
          <Field label="Market">
            <Select value={filterMarket} onChange={e => setFilterMarket(e.target.value)}>
              <option value="all">All markets</option>
              {marketsInUse.map(m => <option key={m} value={m}>{m}</option>)}
            </Select>
          </Field>
          <Field label="Search" full>
            <div className="flex items-center gap-2 rounded" style={{ background: C.panel2, border: '1px solid ' + C.border, padding: '7px 9px' }}>
              <Search size={14} color={C.textFaint} />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Name, product, or UPC" className="w-full text-sm bg-transparent" style={{ color: C.text, fontFamily: HEADING_FONT, border: 'none' }} />
            </div>
          </Field>
        </div>
        {filtersActive && <div className="text-xs mt-3" style={{ color: C.textFaint }}>Showing {filtered.length} of {visibleRoster.length} artists</div>}
      </div>

      {showForm && (
        <form onSubmit={save} className="rounded border p-4 mb-6 imss-form-grid gap-3" style={{ background: C.panel, borderColor: C.borderLight }}>
          <div className="imss-span-2 flex items-center gap-3">
            <Avatar name={form.name} photoUrl={form.photoUrl} size={64} />
            <div className="flex flex-col gap-1">
              <input ref={photoInputRef} type="file" accept="image/*" onChange={handlePhotoUpload} className="text-xs" style={{ color: C.textDim, maxWidth: 220 }} />
              {form.photoUrl && <button type="button" onClick={() => setForm({ ...form, photoUrl: '' })} className="text-xs text-left" style={{ color: C.textFaint }}>Remove photo</button>}
            </div>
          </div>
          <Field label="Artist / act name"><Input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Nova Reyes" /></Field>
          <Field label="Genre">
            <Select value={form.genre} onChange={e => setForm({ ...form, genre: e.target.value })}>
              <option value="">— none —</option>
              {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
            </Select>
          </Field>
          <Field label="Sub-genre">
            <Select value={form.subGenre} onChange={e => setForm({ ...form, subGenre: e.target.value })}>
              <option value="">— none —</option>
              {SUB_GENRES.map(g => <option key={g} value={g}>{g}</option>)}
            </Select>
          </Field>
          <Field label="Primary market">
            <Select value={form.primaryMarket} onChange={e => setForm({ ...form, primaryMarket: e.target.value })}>
              <option value="">— none —</option>
              {MARKETS.map(m => <option key={m} value={m}>{m}</option>)}
            </Select>
          </Field>
          <Field label="Secondary market">
            <Select value={form.secondaryMarket} onChange={e => setForm({ ...form, secondaryMarket: e.target.value })}>
              <option value="">— none —</option>
              {MARKETS.filter(m => m !== form.primaryMarket).map(m => <option key={m} value={m}>{m}</option>)}
            </Select>
          </Field>
          {canSeeDeals && <Field label="Artist share (%)"><Input type="number" min="0" max="100" disabled={!!editing} value={form.royaltyRate} onChange={e => setForm({ ...form, royaltyRate: e.target.value })} /></Field>}
          {canSeeDeals && <Field label="Reporting period">
            <Select disabled={!!editing} value={form.reportingPeriod || 'quarterly'} onChange={e => setForm({ ...form, reportingPeriod: e.target.value })}>
              <option value="monthly">Monthly (cutoff end of each month)</option>
              <option value="quarterly">Quarterly (cutoff 31 Mar, 30 Jun, 30 Sep, 31 Dec)</option>
              <option value="half-yearly">Half-yearly (cutoff 30 Jun, 31 Dec)</option>
            </Select>
          </Field>}
          <Field label={'Statement due (days after cutoff, default ' + DEFAULT_DELIVERY_DAYS[form.reportingPeriod || 'quarterly'] + ')'}><Input type="number" min="1" value={form.deliveryDays} onChange={e => setForm({ ...form, deliveryDays: e.target.value })} placeholder={String(DEFAULT_DELIVERY_DAYS[form.reportingPeriod || 'quarterly'])} /></Field>
          <div className="text-xs" style={{ gridColumn: '1 / -1', color: C.textFaint, marginTop: 6 }}>Socials and streaming (full links)</div>
          {SOCIAL_LINKS.map(l => <Field key={l.key} label={l.label}><Input type="url" value={form[l.key] || ''} onChange={e => setForm(f => ({ ...f, [l.key]: e.target.value }))} placeholder="https://" /></Field>)}
          {canSeeDeals && <Field label="Payout threshold (USD, on the artist’s share after label % and charges)"><Input disabled={!!editing} type="number" min="0" step="0.01" value={form.payoutThreshold} onChange={e => setForm({ ...form, payoutThreshold: e.target.value })} placeholder="0 = pay any amount" /></Field>}
          {canSeeDeals && <><Field label="Funding tier">
            <Select disabled={!!editing} value={form.fundingTier} onChange={e => setForm({ ...form, fundingTier: e.target.value, dealType: (DEAL_TYPES[e.target.value] || [])[0] || '' })}>
              {FUNDING_TIERS.map(t => <option key={t} value={t}>{t}</option>)}
            </Select>
          </Field>
          <Field label="Deal">
            <Select disabled={!!editing} value={form.dealType || ''} onChange={e => setForm({ ...form, dealType: e.target.value })}>
              <option value="">Not set</option>
              {(DEAL_TYPES[form.fundingTier || 'Non-Funded'] || []).map(t => <option key={t} value={t}>{t}</option>)}
            </Select>
          </Field></>}
          {editing && canSeeDeals && <div className="imss-span-2" style={{ color: C.textDim, fontSize: 14 }}>Split, funding and deal change through <b style={{ color: C.text }}>Record a deal change</b> on the artist’s profile, from the month the new deal starts.</div>}
          {canSeeDeals && form.fundingTier === 'Funded' && (
            <Field label="Annual budget"><Input type="number" min="0" step="0.01" value={form.annualBudget} onChange={e => setForm({ ...form, annualBudget: e.target.value })} placeholder="Total allocated for this artist" /></Field>
          )}
          <Field label="Signed date"><Input type="date" value={form.signedDate} onChange={e => setForm({ ...form, signedDate: e.target.value })} /></Field>
          <Field label="Contract expiration"><Input type="date" value={form.contractExpiration} onChange={e => setForm({ ...form, contractExpiration: e.target.value })} /></Field>
          <Field label="Sign-in email (artist portal)"><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Dropbox / Drive folder" full><Input type="url" value={form.driveFolder} onChange={e => setForm({ ...form, driveFolder: e.target.value })} placeholder="https://drive.google.com/... or Dropbox link" /></Field>
          <Field label="Product Manager">
            <Select value={form.productManager} onChange={e => setForm({ ...form, productManager: e.target.value })}>
              <option value="">— unassigned —</option>
              {staff.filter(s => s.role === 'Product Manager').map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </Select>
          </Field>
          <Field label="A&amp;R">
            <Select value={form.anr} onChange={e => setForm({ ...form, anr: e.target.value })}>
              <option value="">— unassigned —</option>
              {staff.filter(s => s.role === 'A&R').map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </Select>
          </Field>
          <Field label="Label rep">
            <Select value={form.labelRep || ''} onChange={e => setForm({ ...form, labelRep: e.target.value })}>
              <option value="">— none —</option>
              {staff.filter(s => s.role === 'Label Rep' && s.status !== 'Archived').map(s => <option key={s.id} value={s.id}>{s.name}{s.company ? ' · ' + s.company : ''}</option>)}
            </Select>
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
              {ARTIST_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </Select>
          </Field>
          <Field label="Notes" full><TextArea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></Field>
          {formError && <div className="imss-span-2" role="alert" style={{ color: C.red, fontSize: 14 }}>{formError}</div>}
          <div className="imss-span-2 flex gap-2 mt-1">
            <Btn variant="primary" type="submit">{editing ? 'Save changes' : 'Add artist'}</Btn>
            <Btn variant="ghost" onClick={closeForm}>Cancel</Btn>
          </div>
        </form>
      )}

      <ExportBar filename="imss-roster" headers={['Name', 'Genre', 'Sub-genre', 'Status', ...(canSeeDeals ? ['Royalty %', 'Funding Tier'] : []), 'Primary Market', 'Secondary Market', 'Product Manager', 'A&R', 'Signed Date', 'Contract Expiration', 'Email']} rows={filtered.map(a => [
        a.name,
        a.genre || '',
        a.subGenre || '',
        a.status,
        ...(canSeeDeals ? [a.royaltyRate, dealLabel(a)] : []),
        a.primaryMarket || '',
        a.secondaryMarket || '',
        a.productManager || '',
        a.anr || '',
        a.signedDate || '',
        a.contractExpiration || '',
        a.email || '',
      ])} />

      <div className="flex justify-end gap-1 mb-4">
        <SegmentedToggle options={[{ id: 'grid', label: 'Grid' }, { id: 'table', label: 'Table' }]} value={view} onChange={setView} />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Users} title={filtersActive ? 'No matching artists' : 'No artists yet'} description={filtersActive ? 'Try a different filter or search term.' : 'Add your first signing to start tracking releases and royalties.'} />
      ) : view === 'grid' ? (
        <div className="grid gap-4 imss-card-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
          {filtered.map(a => {
            const releaseCount = catalog.filter(c => c.artistId === a.id).length;
            return (
              <button key={a.id} onClick={() => setDetailId(a.id)} className="text-left rounded border p-4" style={{ background: C.panel, borderColor: C.border, cursor: 'pointer' }}>
                <div className="flex items-center gap-3 mb-3">
                  <Avatar name={a.name} photoUrl={a.photoUrl} size={48} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
                    <div className="text-xs" style={{ color: C.textFaint }}>{a.genre || 'No genre set'}{a.subGenre ? ' · ' + a.subGenre : ''}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap mb-2">
                  <Badge tone={artistStatusTone(a.status)}>{a.status}</Badge>
                  {canSeeDeals && <Badge>{a.royaltyRate}% royalty</Badge>}
                  {canSeeDeals && <Badge tone={a.fundingTier === 'Funded' ? 'teal' : 'default'}>{dealLabel(a)}</Badge>}
                  {a.contractExpiration && expirationStatus(a.contractExpiration).label !== 'Active' && (
                    <Badge tone={expirationStatus(a.contractExpiration).tone}>{expirationStatus(a.contractExpiration).label}</Badge>
                  )}
                </div>
                {(a.primaryMarket || a.secondaryMarket) && (
                  <div className="flex items-center gap-1.5 flex-wrap mb-2">
                    {a.primaryMarket && <Badge tone="teal"><Globe size={10} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />{a.primaryMarket}</Badge>}
                    {a.secondaryMarket && <Badge>+ {a.secondaryMarket}</Badge>}
                  </div>
                )}
                {(a.productManager || a.anr) && (
                  <div className="text-xs mb-2" style={{ color: C.textFaint, lineHeight: 1.5 }}>
                    {a.productManager && <div>PM: {a.productManager}</div>}
                    {a.anr && <div>A&amp;R: {a.anr}</div>}
                  </div>
                )}
                <div className="text-xs" style={{ color: C.textFaint }}>
                  {releaseCount} release{releaseCount === 1 ? '' : 's'} · Signed {formatDate(a.signedDate)}
                  {a.contractExpiration && <div>Contract expires {formatDate(a.contractExpiration)}</div>}
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="rounded border overflow-x-auto" style={{ borderColor: C.border, background: C.panel }}>
          <table className="w-full" style={{ minWidth: 680 }}>
            <thead><tr>
              <Th></Th><Th>Artist</Th><Th>Genre</Th><Th>Market</Th><Th>Team</Th>{canSeeDeals && <Th align="right">Royalty</Th>}<Th>Signed</Th><Th>Contract</Th><Th align="right">Releases</Th><Th>Status</Th>{canSeeDeals && <Th>Funding</Th>}<Th align="right">Actions</Th>
            </tr></thead>
            <tbody>
              {filtered.map(a => {
                const releaseCount = catalog.filter(c => c.artistId === a.id).length;
                return (
                  <tr key={a.id}>
                    <Td><Avatar name={a.name} photoUrl={a.photoUrl} size={32} /></Td>
                    <Td><button onClick={() => setDetailId(a.id)} style={{ color: C.text, fontWeight: 500, textAlign: 'left' }}>{a.name}</button></Td>
                    <Td>{a.genre || '—'}{a.subGenre && <div className="text-xs" style={{ color: C.textFaint }}>{a.subGenre}</div>}</Td>
                    <Td>{a.primaryMarket || '—'}{a.secondaryMarket && <div className="text-xs" style={{ color: C.textFaint }}>+ {a.secondaryMarket}</div>}</Td>
                    <Td>
                      {!a.productManager && !a.anr ? '—' : (
                        <div style={{ lineHeight: 1.5, fontSize: 12 }}>
                          {a.productManager && <div>PM: {a.productManager}</div>}
                          {a.anr && <div style={{ color: C.textFaint }}>A&amp;R: {a.anr}</div>}
                        </div>
                      )}
                    </Td>
                    {canSeeDeals && <Td align="right" mono>{a.royaltyRate}%</Td>}
                    <Td mono>{formatDate(a.signedDate)}</Td>
                    <Td>
                      {!a.contractExpiration ? '—' : (
                        <div style={{ lineHeight: 1.5 }}>
                          <div style={{ fontFamily: MONO_FONT, fontSize: 12 }}>{formatDate(a.contractExpiration)}</div>
                          {expirationStatus(a.contractExpiration).label !== 'Active' && <Badge tone={expirationStatus(a.contractExpiration).tone}>{expirationStatus(a.contractExpiration).label}</Badge>}
                        </div>
                      )}
                    </Td>
                    <Td align="right">{releaseCount}</Td>
                    <Td><Badge tone={artistStatusTone(a.status)}>{a.status}</Badge></Td>
                    {canSeeDeals && <Td><Badge tone={a.fundingTier === 'Funded' ? 'teal' : 'default'}>{dealLabel(a)}</Badge></Td>}
                    <Td align="right">
                      {confirmId === a.id ? (
                        <ConfirmInline label="Archive? They lose sign-in; their history stays." onConfirm={() => remove(a.id)} onCancel={() => setConfirmId(null)} />
                      ) : canEdit ? (
                        <span className="inline-flex gap-3 justify-end">
                          <button aria-label="Edit" title="Edit" onClick={() => openEdit(a)} style={{ color: C.textDim }}><Pencil size={14} /></button>
                          {a.status === 'Archived' ? <button onClick={() => restore(a.id)} style={{ color: C.amber, fontSize: 13 }}>Restore</button> : <button onClick={() => setConfirmId(a.id)} aria-label={'Archive ' + a.name} title="Archive" style={{ color: C.textDim }}><Archive size={14} /></button>}
                        </span>
                      ) : <span style={{ color: C.textFaint }}>—</span>}
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

import { ReportingLagNote, MonthPicker, MONTH_SUPPORTED, ReleaseCountdown } from '../../ui.jsx';
import { Megaphone, ChevronRight, Eye, LogOut, Wallet } from 'lucide-react';
import { dealLabel, formatCents, formatDate, formatNumber, monthLabel } from '../../constants.js';
import { artistSpend } from '../../finance.js';
import { NotificationBell } from '../Notifications.jsx';
import { C, MONO_FONT } from '../../theme.js';
import { Badge, Btn, Td, Th } from '../../ui.jsx';
import { breakdownLabel } from '../StatementFiles.jsx';

// The artist portal's overview tab (state lives in ArtistPortalShell).
export function OverviewTab({ artistCatalog = [], DASH_PRESETS, activePreset, applyDashRange, artist, balance, budgetRemaining, creditLine, dashBestMonth, dashCountries, dashDraft, dashError, dashGross, dashLabel, dashReleased, dashRetailers, dashTopSongs, dashUnits, dismissDeal, invoices, invoicesDue, isFunded, latestDeal, ledger, lifetime, monthLong, myNotices, needsToKnow, onLogout, openReleaseRevenue, paid, payouts, pctLabel, platformTotals, rateLabel, recoupment, releasedByType, revenue, setDashDraft, setTab, showDealBanner, streams, totalStreams }) {
  return (
          <div>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h1 className="imss-portal-title">Dashboard</h1>
              <div className="flex items-center gap-2">
                <Badge tone={isFunded ? 'teal' : 'default'}>{dealLabel(artist)}</Badge>
                <span className="imss-desktop-only"><span className="flex items-center gap-2"><NotificationBell routes={{ budget: 'budget', notice: 'overview', deal: 'profile', earnings: 'revenue', statement: 'statements', invoice: 'invoices', submission: 'releases', request: 'requests' }} onOpen={setTab} /><button onClick={e => window.dispatchEvent(new CustomEvent('imss:open-account', { detail: e.currentTarget.getBoundingClientRect() }))} aria-label={'Your account: ' + artist.name} className="inline-flex items-center justify-center" style={{ width: 40, height: 40, borderRadius: 9999, background: C.amberSoft, color: C.amber, fontWeight: 700, fontSize: 14, flex: '0 0 auto' }}>{String(artist.name || '?').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()}</button></span></span>
              </div>
            </div>
            <ReportingLagNote />
            <ReleaseCountdown releases={artistCatalog} title="Your release countdown" />

            {showDealBanner && (
              <section aria-label="Your deal has been updated" className="rounded mb-6" style={{ background: C.amberSoft, padding: '18px 20px' }}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 17, letterSpacing: '-0.02em' }}>Your deal has been updated</div>
                    <p className="mt-1" style={{ fontSize: 15, lineHeight: 1.5 }}>
                      From your <b>{monthLong(latestDeal.from)}</b> earnings, your share of net earnings is <b>{pctLabel(latestDeal.artistPct)}</b>{latestDeal.was && latestDeal.was.artistPct != null ? <> (previously {pctLabel(latestDeal.was.artistPct)})</> : null}. Deal: <b>{dealLabel(latestDeal)}</b>.
                    </p>
                    <p style={{ fontSize: 14, color: C.textDim }}>Earnings before {monthLong(latestDeal.from)} stay at your previous terms. Your full deal history is on your Profile.</p>
                  </div>
                  <div className="flex gap-2">
                    <Btn variant="ghost" onClick={() => setTab('profile')}>See deal history</Btn>
                    <Btn variant="ghost" onClick={dismissDeal}>Got it</Btn>
                  </div>
                </div>
              </section>
            )}

            <section aria-label="What you are owed" className="rounded border mb-6 imss-owed-card" style={{ background: C.panel, borderColor: C.border }}>
              <div className="imss-owed-head">
                <div>
                  <div className="text-sm" style={{ color: C.textDim }}>{balance > 0 ? 'You’re owed' : 'Balance'}</div>
                  <div className="imss-owed" style={{ color: balance > 0 ? C.amber : C.text }}>{formatCents(Math.max(0, balance))}</div>
                </div>
                <div className="flex gap-2 flex-wrap imss-print-hide mt-4">
                  <Btn variant="ghost" onClick={() => setTab('statements')}><Eye size={14} /> Get a statement</Btn>
                  <Btn variant="ghost" onClick={() => setTab('payouts')}><Wallet size={14} /> Payouts</Btn>
                </div>
              </div>
              <ol className="imss-sum" aria-label="How your balance is worked out">
                <li><span>Gross</span><b>{formatCents(lifetime.gross)}</b></li>
                <li><span>Inbound Banking Charge</span><b>−{formatCents(lifetime.swift)}</b></li>
                <li><span>Net</span><b>{formatCents(lifetime.gross - lifetime.swift)}</b></li>
                <li className="imss-sum-key"><span>Your earnings ({rateLabel(revenue)})</span><b style={{ color: C.teal }}>{formatCents(lifetime.artistShare)}</b></li>
                {recoupment.recouped > 0 && <li><span>Recouped expenses</span><b>−{formatCents(recoupment.recouped)}</b></li>}
                {artistSpend(artist, ledger, invoices).repaidCash > 0 && <li><span>Repaid in cash <span style={{ color: C.textDim }}>· at the label’s request, not from your earnings</span></span><b style={{ color: C.textDim }}>{formatCents(artistSpend(artist, ledger, invoices).repaidCash)}</b></li>}
                <li><span>Paid to you</span><b>{paid > 0 ? '−' : ''}{formatCents(paid)}</b></li>
                <li className="imss-sum-total"><span>{balance > 0 ? 'You’re owed' : 'Balance'}</span><b style={{ color: balance > 0 ? C.amber : C.text }}>{formatCents(Math.max(0, balance))}</b></li>
              </ol>
            </section>

            {invoicesDue > 0 && (
              <button onClick={() => setTab('invoices')} className="w-full text-left rounded border px-4 py-3 mb-6 text-sm" style={{ borderColor: C.border, background: C.panel, color: C.text }}>
                Approved invoices waiting to be paid: <span style={{ fontFamily: MONO_FONT, color: C.amber, fontWeight: 600 }}>{formatCents(invoicesDue)}</span> <span style={{ color: C.textDim }}>· see Invoices</span>
              </button>
            )}

            {(myNotices.length > 0 || needsToKnow.length > 0) && (
              <section aria-label="Notices" className="mb-6 flex flex-col gap-2">
                {needsToKnow.map((n, i) => (
                  <div key={'k' + i} className="rounded border px-4 py-3 text-sm" style={{ borderColor: C.amber, background: C.amberSoft, color: C.text }}>{n.text}</div>
                ))}
                {myNotices.map(n => (
                  <div key={n.id} role="note" className="rounded border flex gap-3" style={{ borderColor: C.amberLine || 'var(--amber-line)', background: C.amberSoft, padding: '14px 16px' }}>
                    <span aria-hidden="true" style={{ flex: '0 0 auto', width: 36, height: 36, borderRadius: 9999, background: C.amberFill, color: C.onAmber, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Megaphone size={18} /></span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="flex items-baseline justify-between gap-3 flex-wrap">
                        <div style={{ fontWeight: 700, fontSize: 16, color: C.text }}>{n.title}</div>
                        <div className="text-xs" style={{ color: C.textDim }}>{formatDate(n.createdAt)}</div>
                      </div>
                      <div className="mt-1" style={{ color: C.text, fontSize: 15, lineHeight: 1.45, maxWidth: '70ch', whiteSpace: 'pre-wrap' }}>{n.message}</div>
                    </div>
                  </div>
                ))}
              </section>
            )}

            <form className="imss-dash-range" aria-label="Date selection" onSubmit={e => { e.preventDefault(); applyDashRange(dashDraft); }}>
              <label className="imss-dash-field">From{MONTH_SUPPORTED ? <input type="month" value={dashDraft.from} max={dashDraft.to || undefined} onChange={e => setDashDraft(d => ({ ...d, from: e.target.value }))} /> : <MonthPicker aria-label="From" value={dashDraft.from} max={dashDraft.to || undefined} onChange={e => setDashDraft(d => ({ ...d, from: e.target.value }))} />}</label>
              <span className="imss-dash-to" aria-hidden="true">to</span>
              <label className="imss-dash-field">To{MONTH_SUPPORTED ? <input type="month" value={dashDraft.to} min={dashDraft.from || undefined} onChange={e => setDashDraft(d => ({ ...d, to: e.target.value }))} /> : <MonthPicker aria-label="To" value={dashDraft.to} min={dashDraft.from || undefined} onChange={e => setDashDraft(d => ({ ...d, to: e.target.value }))} />}</label>
              <Btn variant="primary" type="submit">Update</Btn>
              <div className="imss-dash-presets" role="group" aria-label="Quick ranges">
                {DASH_PRESETS.map(p => (
                  <button key={p.id} type="button" onClick={() => applyDashRange(p.range())} aria-pressed={activePreset === p.id} className={'imss-dash-preset' + (activePreset === p.id ? ' is-on' : '')}>{p.label}</button>
                ))}
              </div>
            </form>
            {dashError && <div className="text-sm mb-3" role="alert" style={{ color: C.red }}>{dashError}</div>}
            <p className="text-sm mb-4" style={{ color: C.textDim }}>Balance is all time. Everything below shows <span style={{ color: C.text, fontWeight: 600 }}>{dashLabel}</span>.{dashRetailers[0] && dashCountries[0] ? <> Most of your money came from <span style={{ color: C.text }}>{dashRetailers[0].name}</span> in <span style={{ color: C.text }}>{breakdownLabel('countries', dashCountries[0].code)}</span>{dashUnits > 0 ? <>, across <span style={{ color: C.text }}>{dashUnits.toLocaleString('en-US')}</span> streams and sales</> : null}.</> : null}</p>

            <div className="imss-dash-stats mb-6">
              <div className="rounded border imss-dash-stat" style={{ background: C.panel, borderColor: C.border }}>
                <div className="imss-dash-lab">Songs released</div>
                <div className="imss-dash-fig">{dashReleased.length}</div>
                <div className="imss-dash-sub">{releasedByType.length ? releasedByType.map(([t, n]) => n + ' ' + t.split(' ').map(w => w === 'EP' ? w : w.toLowerCase()).join(' ') + (n === 1 ? '' : 's')).join(' · ') : 'None in this period'}</div>
              </div>
              <div className="rounded border imss-dash-stat" style={{ background: C.panel, borderColor: C.border }}>
                <div className="imss-dash-lab">Top earning retailer</div>
                <div className="imss-dash-fig imss-dash-fig-text">{dashRetailers[0] ? dashRetailers[0].name : '—'}</div>
                <div className="imss-dash-sub">{dashRetailers[0] ? formatCents(dashRetailers[0].value) + ' gross' + (dashGross > 0 ? ' · ' + (dashRetailers[0].value / dashGross * 100).toFixed(1) + '% of your revenue' : '') : 'No retailer breakdown yet'}</div>
              </div>
              <div className="rounded border imss-dash-stat" style={{ background: C.panel, borderColor: C.border }}>
                <div className="imss-dash-lab">Top country</div>
                <div className="imss-dash-fig imss-dash-fig-text">{dashCountries[0] ? breakdownLabel('countries', dashCountries[0].code) : '—'}</div>
                <div className="imss-dash-sub">{dashCountries[0] ? formatCents(dashCountries[0].value) + ' gross' + (dashGross > 0 ? ' · ' + (dashCountries[0].value / dashGross * 100).toFixed(1) + '%' : '') + ' · ' + dashCountries.length + ' countries' : 'No country breakdown yet'}</div>
              </div>
              <div className="rounded border imss-dash-stat" style={{ background: C.panel, borderColor: C.border }}>
                <div className="imss-dash-lab">Best month</div>
                <div className="imss-dash-fig">{dashBestMonth ? formatCents(dashBestMonth[1]) : '—'}</div>
                <div className="imss-dash-sub">{dashBestMonth ? monthLabel(dashBestMonth[0]) + ' · your earnings' : 'No earnings in this period'}</div>
              </div>
            </div>

            <div className="imss-dash-two mb-6">
              <section aria-labelledby="top-songs-h" className="rounded border overflow-hidden" style={{ background: C.panel, borderColor: C.border }}>
                <div className="imss-dash-ph">
                  <h2 id="top-songs-h">Top songs by revenue</h2>
                  <button type="button" onClick={() => setTab('revenue')} className="imss-dash-link">All songs <ChevronRight size={14} aria-hidden="true" /></button>
                </div>
                {dashTopSongs.length === 0 ? (
                  <div className="px-4 pb-5 text-sm" style={{ color: C.textDim }}>No revenue in this period. Try a wider range.</div>
                ) : (
                  <table className="w-full imss-dash-songs" style={{ tableLayout: 'fixed' }}>
                    <colgroup><col className="imss-dash-rank" style={{ width: 44 }} /><col /><col style={{ width: '20%' }} /><col style={{ width: '18%' }} /><col style={{ width: '20%' }} /></colgroup>
                    <thead><tr><Th align="right">#</Th><Th>Song</Th><Th align="right">Streams &amp; sales</Th><Th align="right">Gross</Th><Th align="right">Your earnings</Th></tr></thead>
                    <tbody>
                      {dashTopSongs.map((t, i) => { const c = creditLine(t.title); return (
                        <tr key={t.title} className="imss-dash-song" onClick={() => openReleaseRevenue(t.title)}>
                          <Td align="right" mono><span style={{ color: C.textDim }}>{i + 1}</span></Td>
                          <Td>
                            <button type="button" onClick={e => { e.stopPropagation(); openReleaseRevenue(t.title); }} className="imss-dash-songbtn">{t.title}</button>
                            <div className="text-xs mt-0.5" style={{ color: C.textDim, overflowWrap: 'anywhere' }}>{c.primaries}{c.feats.length > 0 && <span style={{ color: C.text }}> feat. {c.feats.join(', ')}</span>}</div>
                          </Td>
                          <Td align="right" mono>{t.units > 0 ? t.units.toLocaleString('en-US') : '—'}</Td>
                          <Td align="right" mono>{formatCents(t.gross)}</Td>
                          <Td align="right" mono><span style={{ color: C.teal, fontWeight: 600 }}>{formatCents(t.artistShare)}</span></Td>
                        </tr>
                      ); })}
                    </tbody>
                  </table>
                )}
              </section>

              <section aria-labelledby="top-retail-h" className="rounded border overflow-hidden" style={{ background: C.panel, borderColor: C.border }}>
                <div className="imss-dash-ph"><h2 id="top-retail-h">Top earning retailers</h2></div>
                {dashRetailers.length === 0 ? (
                  <div className="px-4 pb-5 text-sm" style={{ color: C.textDim, maxWidth: '60ch' }}>Retailer breakdowns appear for revenue the label imports from distributor statements from now on. Earlier revenue was recorded per song only.</div>
                ) : (
                  <ul className="imss-dash-retail">
                    {dashRetailers.slice(0, 6).map(r => (
                      <li key={r.name}>
                        <span className="imss-dash-retail-name">{r.name}</span>
                        <span className="imss-ledger-bar" aria-hidden="true"><span style={{ width: Math.max(2, r.value / dashRetailers[0].value * 100) + '%' }}></span></span>
                        <span className="imss-dash-retail-amt">{formatCents(r.value)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            {platformTotals.length > 0 && (
              <section aria-labelledby="streams-h" className="rounded border overflow-hidden mb-6" style={{ background: C.panel, borderColor: C.border }}>
                <div className="imss-dash-ph"><h2 id="streams-h">Streams by platform</h2><span className="text-xs" style={{ color: C.textDim }}>{formatNumber(totalStreams)} all time</span></div>
                <ul className="imss-dash-retail">
                  {[...platformTotals].sort((x, y) => y.value - x.value).map(p => (
                    <li key={p.name}>
                      <span className="imss-dash-retail-name">{p.name}</span>
                      <span className="imss-ledger-bar" aria-hidden="true"><span style={{ width: Math.max(2, p.value / Math.max(...platformTotals.map(q => q.value)) * 100) + '%' }}></span></span>
                      <span className="imss-dash-retail-amt">{formatNumber(p.value)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {isFunded && (
              <div className="text-sm" style={{ color: C.textDim }}>
                Budget: <span style={{ fontFamily: MONO_FONT, color: budgetRemaining < 0 ? C.red : C.text }}>{formatCents(budgetRemaining)}</span> left of {formatCents(artist.annualBudget || 0)}. <button onClick={() => setTab('budget')} style={{ color: C.amber, textDecoration: 'underline', textUnderlineOffset: 3 }}>See expenses</button>
              </div>
            )}
          </div>
  );
}

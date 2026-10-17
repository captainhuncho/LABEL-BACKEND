import { ClipboardList, DollarSign, FileText, Wallet } from 'lucide-react';
import { formatCents, monthLabel } from '../../constants.js';
import { revenueBreakdown } from '../../finance.js';
import { C } from '../../theme.js';
import { Badge, Btn, EmptyState, ExportBar, Field, Input, KPICard, Select, Td, Th } from '../../ui.jsx';
import { DealSpanNote } from '../ArtistStatement.jsx';
import { BREAKDOWN_FIELDS, RevenueBreakdownTable } from '../StatementFiles.jsx';

// The artist portal's revenue tab (state lives in ArtistPortalShell).
export function RevenueTab({ EMPTY_REV_FILTERS, artist, artistCatalog, filteredMyRevenue, filteredRevTotals, generateRevenue, myRevenue, rateLabel, resetRevFilters, revByProduct, revByType, revError, revFilters, revFiltersActive, revGenerated, revGroupBy, revPeriodLabel, revTypes, revenue, setRevError, setRevFilters, setRevGenerated, setRevGroupBy, splitOf, sumSplits }) {
  return (
          <div>
            <div className="imss-print-hide rounded border p-4 mb-4" style={{ background: C.panel, borderColor: C.border }}>
              <div className="text-xs mb-3" style={{ color: C.textFaint }}>What do you want to see?</div>
              <div className="imss-form-grid gap-3">
                <Field label="From"><Input type="date" value={revFilters.startDate} onChange={e => setRevFilters({ ...revFilters, startDate: e.target.value })} /></Field>
                <Field label="To"><Input type="date" value={revFilters.endDate} onChange={e => setRevFilters({ ...revFilters, endDate: e.target.value })} /></Field>
                <Field label="Type">
                  <Select value={revFilters.type} onChange={e => setRevFilters({ ...revFilters, type: e.target.value })}>
                    <option value="all">All types</option>
                    {revTypes.map(t => <option key={t} value={t}>{t}</option>)}
                  </Select>
                </Field>
                <Field label="Product">
                  <Select value={revFilters.product} onChange={e => setRevFilters({ ...revFilters, product: e.target.value })}>
                    <option value="all">All products</option>
                    {artistCatalog.map(c => <option key={c.id} value={c.title}>{c.title}</option>)}
                  </Select>
                </Field>
              </div>
              {revError && (
                <div className="rounded px-3 py-2 text-xs mt-3" style={{ background: C.redSoft, color: C.red, border: '1px solid ' + C.red }}>{revError}</div>
              )}
              <div className="flex gap-2 flex-wrap mt-4">
                <Btn variant="primary" onClick={generateRevenue}>
                  <FileText size={14} /> {revGenerated ? 'Regenerate' : 'Generate'}
                </Btn>
                {revGenerated && <Btn variant="ghost" onClick={resetRevFilters}>Clear</Btn>}
              </div>
            </div>

            {!revGenerated ? (
              <EmptyState icon={DollarSign} title="Pick a period, then generate"
                description="Choose the dates — and a type or product if you want to narrow it — then hit Generate to see exactly that revenue." />
            ) : (
            <>
            <div className="flex flex-wrap gap-3 mb-6">
              <div className="w-full"><DealSpanNote artist={artist} rows={filteredMyRevenue} active={revGenerated && revGenerated.deal ? revGenerated.deal : null}
                onPick={p => { const f = { ...EMPTY_REV_FILTERS, startDate: p.from ? p.from + '-01' : '', endDate: p.to ? p.to + '-28' : '', deal: p }; setRevFilters(f); setRevGenerated(f); setRevError(''); }} /></div>
              <KPICard icon={DollarSign} label={revFiltersActive ? 'Gross in this period' : 'Total gross'} value={formatCents(filteredRevTotals.gross)} />
              <KPICard icon={Wallet} label="Inbound Banking Charge" value={formatCents(filteredRevTotals.charge)} />
              <KPICard icon={DollarSign} label={'Your earnings (' + rateLabel(filteredMyRevenue) + ')'} value={formatCents(filteredRevTotals.artistShare)} tone="teal" />
              <KPICard icon={ClipboardList} label="Entries" value={filteredMyRevenue.length} />
            </div>

            <div className="flex items-baseline justify-between gap-3 flex-wrap mb-3">
              <div style={{ fontWeight: 600 }}>{revPeriodLabel()}</div>
              <div className="text-xs" style={{ color: C.textFaint }}>Showing {filteredMyRevenue.length} of {myRevenue.length} entries</div>
            </div>

            <div className="imss-print-hide flex items-center gap-1 mb-4 flex-wrap">
              {[['none', 'Flat'], ['product', 'By song'], ['source', 'By release type'], ['stores', 'By platform'], ['countries', 'By country'], ['types', 'By format'], ['models', 'By model'], ['salesMonths', 'By month earned']].map(([id, label]) => (
                <button key={id} onClick={() => setRevGroupBy(id)} className="text-sm px-3 py-1.5 rounded"
                  style={{ background: revGroupBy === id ? C.amberSoft : 'transparent', color: revGroupBy === id ? C.amber : C.textDim, border: '1px solid ' + (revGroupBy === id ? 'transparent' : C.border), fontWeight: revGroupBy === id ? 600 : 500 }}>
                  {label}
                </button>
              ))}
            </div>

            <ExportBar filename={(artist.name || 'artist').replace(/\s+/g, '-').toLowerCase() + '-revenue'} headers={['Month', 'Type', 'Product', 'Gross', 'Inbound Banking Charge', 'Your earnings']} rows={filteredMyRevenue.map(r => { const x = splitOf(r); return [r.month, r.type, r.title, x.gross, x.charge, x.artistShare]; })} />

            {filteredMyRevenue.length === 0 ? (
              <EmptyState icon={DollarSign} title="Nothing in that period" description="No revenue was logged for what you picked. Try a wider date range, or clear the type and product filters." />
            ) : revGroupBy === 'none' ? (
              <div className="rounded border overflow-x-auto" style={{ borderColor: C.border, background: C.panel }}>
                <table className="w-full" style={{ minWidth: 820 }}>
                  <thead><tr><Th>Month</Th><Th>Type</Th><Th>Product</Th><Th align="right">Gross</Th><Th align="right">Inbound Banking Charge</Th><Th align="right">Your earnings</Th></tr></thead>
                  <tbody>
                    {filteredMyRevenue.map((r, i) => { const x = splitOf(r); return (
                      <tr key={i}>
                        <Td mono>{monthLabel(r.month)}</Td>
                        <Td><Badge>{r.type}</Badge></Td>
                        <Td>{r.title}</Td>
                        <Td align="right" mono>{formatCents(x.gross)}</Td>
                        <Td align="right" mono>−{formatCents(x.charge)}</Td>
                        <Td align="right" mono><span style={{ color: C.teal, fontWeight: 600 }}>{formatCents(x.artistShare)}</span></Td>
                      </tr>
                    ); })}
                  </tbody>
                </table>
              </div>
            ) : BREAKDOWN_FIELDS[revGroupBy] ? (
              <RevenueBreakdownTable parts={revenueBreakdown(filteredMyRevenue, revGroupBy, splitOf)} label={BREAKDOWN_FIELDS[revGroupBy]} format={revGroupBy} />
            ) : revGroupBy === 'source' ? (
              <div className="rounded border overflow-x-auto" style={{ borderColor: C.border, background: C.panel }}>
                <table className="w-full" style={{ minWidth: 320 }}>
                  <thead><tr><Th>Type</Th><Th align="right">Entries</Th><Th align="right">Gross</Th><Th align="right">Your earnings</Th></tr></thead>
                  <tbody>
                    {revByType.map(s => { const rows = filteredMyRevenue.filter(r => r.type === s.type); return (
                      <tr key={s.type}>
                        <Td><Badge>{s.type}</Badge></Td>
                        <Td align="right" mono>{rows.length}</Td>
                        <Td align="right" mono>{formatCents(s.value)}</Td>
                        <Td align="right" mono><span style={{ color: C.teal, fontWeight: 600 }}>{formatCents(sumSplits(rows).artistShare)}</span></Td>
                      </tr>
                    ); })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {revByProduct.map(p => { const t = sumSplits(p.entries); return (
                  <div key={p.title} className="rounded border overflow-x-auto" style={{ background: C.panel, borderColor: C.border }}>
                    <div className="px-3 pt-3 pb-1" style={{ fontWeight: 600 }}>{p.title}</div>
                    {/* Fixed column widths so every product card lines up with the next. */}
                    <table className="w-full" style={{ tableLayout: 'fixed', minWidth: 420 }}>
                      <colgroup><col style={{ width: '22%' }} /><col style={{ width: '28%' }} /><col style={{ width: '25%' }} /><col style={{ width: '25%' }} /></colgroup>
                      <thead><tr><Th>Month</Th><Th>Type</Th><Th align="right">Gross</Th><Th align="right">Your earnings</Th></tr></thead>
                      <tbody>
                        {p.entries.sort((a, b) => (b.month || '').localeCompare(a.month || '')).map((r, i) => (
                          <tr key={i}>
                            <Td mono>{monthLabel(r.month)}</Td>
                            <Td><Badge>{r.type}</Badge></Td>
                            <Td align="right" mono>{formatCents(r.earning)}</Td>
                            <Td align="right" mono><span style={{ color: C.teal }}>{formatCents(splitOf(r).artistShare)}</span></Td>
                          </tr>
                        ))}
                        <tr>
                          <Td><span style={{ fontWeight: 600 }}>Total</span></Td>
                          <Td>{''}</Td>
                          <Td align="right" mono><span style={{ fontWeight: 600 }}>{formatCents(t.gross)}</span></Td>
                          <Td align="right" mono><span style={{ color: C.teal, fontWeight: 600 }}>{formatCents(t.artistShare)}</span></Td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ); })}
              </div>
            )}
            </>
            )}
          </div>
  );
}

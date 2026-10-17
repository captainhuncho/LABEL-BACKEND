import { Calendar, DollarSign, TrendingUp } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatCents, monthLabel } from '../../constants.js';
import { C } from '../../theme.js';
import { EmptyState, ExportBar, KPICard, Td, Th } from '../../ui.jsx';
import { pctTxt } from '../ArtistStatement.jsx';

// The artist portal's earnings tab (state lives in ArtistPortalShell).
export function EarningsTab({ artist, earningsByMonth, lifetime, revenue }) {
  return (
          <div>
            <p className="text-sm mb-5" style={{ color: C.textDim, maxWidth: '70ch' }}>What you made each month across all your songs, after the Inbound Banking Charge and the label’s share.</p>
            <div className="flex flex-wrap gap-3 mb-6">
              <KPICard icon={DollarSign} label="Your earnings, all time" value={formatCents(lifetime.artistShare)} tone="teal" />
              <KPICard icon={TrendingUp} label={earningsByMonth[0] ? 'Latest month · ' + monthLabel(earningsByMonth[0].month) : 'Latest month'} value={formatCents(earningsByMonth[0] ? earningsByMonth[0].artistShare : 0)} />
              <KPICard icon={Calendar} label="Months with earnings" value={earningsByMonth.length} />
            </div>
            {earningsByMonth.length === 0 ? (
              <EmptyState icon={TrendingUp} title="No earnings yet" description="Once revenue for your songs is recorded, each month’s total shows here." />
            ) : (
              <>
                <section aria-label="Your earnings by month chart" className="rounded border p-4 mb-6" style={{ background: C.panel, borderColor: C.border }}>
                  <div style={{ height: 220 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={[...earningsByMonth].reverse().map(m => ({ month: monthLabel(m.month), value: m.artistShare }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                        <XAxis dataKey="month" tick={{ fill: C.textDim, fontSize: 11 }} axisLine={{ stroke: C.border }} tickLine={false} />
                        <YAxis tick={{ fill: C.textDim, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? '$' + Math.round(v / 1000) + 'k' : '$' + Math.round(v)} />
                        <Tooltip cursor={{ fill: 'var(--hover)' }} contentStyle={{ background: C.panel2, border: '1px solid ' + C.border, borderRadius: 12, fontSize: 13, color: C.text }} labelStyle={{ color: C.text }} formatter={(v) => [formatCents(v), 'Your earnings']} />
                        <Bar dataKey="value" fill={C.teal} radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </section>
                <ExportBar filename={(artist.name || 'artist').replace(/\s+/g, '-').toLowerCase() + '-earnings-by-month'} headers={['Month', 'Gross', 'Inbound Banking Charge', 'Your earnings', 'Running total']} rows={earningsByMonth.map(m => [m.month, m.gross, m.charge, m.artistShare, m.running])} />
                <div className="rounded border overflow-x-auto" style={{ borderColor: C.border, background: C.panel }}>
                  <table className="w-full" style={{ minWidth: 720 }}>
                    <thead><tr><Th>Month</Th><Th align="right">Gross</Th><Th align="right">Inbound Banking Charge</Th><Th align="right">Your share</Th><Th align="right">Your earnings</Th><Th align="right">Running total</Th></tr></thead>
                    <tbody>
                      {earningsByMonth.map(m => (
                        <tr key={m.month}>
                          <Td mono>{monthLabel(m.month)}</Td>
                          <Td align="right" mono>{formatCents(m.gross)}</Td>
                          <Td align="right" mono>−{formatCents(m.charge)}</Td>
                          <Td align="right" mono>{pctTxt(m.rate)}</Td>
                          <Td align="right" mono><span style={{ color: C.teal, fontWeight: 600 }}>{formatCents(m.artistShare)}</span></Td>
                          <Td align="right" mono>{formatCents(m.running)}</Td>
                        </tr>
                      ))}
                      <tr>
                        <Td><span style={{ fontWeight: 600 }}>Total</span></Td>
                        <Td align="right" mono><span style={{ fontWeight: 600 }}>{formatCents(lifetime.gross)}</span></Td>
                        <Td align="right" mono><span style={{ fontWeight: 600 }}>−{formatCents(lifetime.swift)}</span></Td>
                        <Td>{''}</Td>
                        <Td align="right" mono><span style={{ color: C.teal, fontWeight: 700 }}>{formatCents(lifetime.artistShare)}</span></Td>
                        <Td>{''}</Td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
  );
}

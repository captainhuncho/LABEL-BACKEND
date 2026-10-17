import { DollarSign, Wallet } from 'lucide-react';
import { formatCents } from '../../constants.js';
import { C } from '../../theme.js';
import { Badge, KPICard, Td, Th } from '../../ui.jsx';

// The artist portal's payouts tab (state lives in ArtistPortalShell).
export function PayoutsTab({ balance, lifetime, myPayouts, paid, payouts, recoupment, remainingRecoupable }) {
  return (
          <div>
            <div className="flex flex-wrap gap-3 mb-6">
              {/* These add up: earnings − recouped − paid = balance due. */}
              <KPICard icon={DollarSign} label="Your earnings" value={formatCents(lifetime.artistShare)} sub="All time, your share after charges" />
              {recoupment.recouped > 0 && <KPICard icon={Wallet} label="Recouped" value={'−' + formatCents(recoupment.recouped)} sub="Taken from earnings to cover spend on you" />}
              <KPICard icon={DollarSign} label="Paid to date" value={(paid > 0 ? '−' : '') + formatCents(paid)} tone="teal" />
              <KPICard icon={Wallet} label="Balance due" value={formatCents(Math.max(0, balance))} tone={balance > 0 ? 'amber' : undefined} sub="Payable to you now" />
            </div>

            {remainingRecoupable > 0 ? (
              <div className="rounded mb-6" style={{ background: C.amberSoft, padding: '14px 18px', fontSize: 15 }}>
                <b>{formatCents(remainingRecoupable)} of spend on you is still to be recouped.</b> It comes out of future royalties before anything more is payable. The full breakdown is under Expenses.
              </div>
            ) : recoupment.recouped > 0 ? (
              <div className="rounded mb-6" style={{ background: C.panel, padding: '14px 18px', fontSize: 15, color: C.textDim }}>
                All {formatCents(recoupment.recouped)} of spend on you has been recouped from your earnings, so nothing is outstanding. The full breakdown is under Expenses.
              </div>
            ) : null}

            <div className="rounded border" style={{ background: C.panel, borderColor: C.border }}>
              <div className="text-xs px-4 pt-4 pb-2" style={{ color: C.textFaint }}>Payout history</div>
              {myPayouts.length === 0 ? (
                <div className="p-4 text-sm" style={{ color: C.textDim }}>No payouts recorded yet.</div>
              ) : (
                <table className="w-full">
                  <thead><tr><Th>Period</Th><Th>Status</Th><Th align="right">Amount</Th></tr></thead>
                  <tbody>
                    {myPayouts.map(p => (
                      <tr key={p.id}>
                        <Td mono>{p.periodStart} – {p.periodEnd}</Td>
                        <Td><Badge tone={p.status === 'paid' ? 'teal' : undefined}>{p.status}</Badge></Td>
                        <Td align="right" mono>{formatCents(p.artistShare)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
  );
}

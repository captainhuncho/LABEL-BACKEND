import { FileText, Plus, Wallet } from 'lucide-react';
import { formatCents, formatDate } from '../../constants.js';
import { artistSpend } from '../../finance.js';
import { C } from '../../theme.js';
import { Badge, Btn, EmptyState, KPICard, Td, Th } from '../../ui.jsx';
import { invoiceStatus, artistInvoiceStatus, INVOICE_TONES } from '../Invoices.jsx';

// The artist portal's expenses tab (state lives in ArtistPortalShell).
export function ExpensesTab({ artist, emptyInvoice, invoices, ledger, myExpenseClaims, myExpenses, paid, payouts, remainingRecoupable, setInvoiceForm, setInvoiceSent, setTab }) {
  return (
          <div>
            <p className="text-sm mb-5" style={{ color: C.textDim, maxWidth: '70ch' }}>Money spent on your career, by the label and by you. Everything spent on you, by the label and through your approved expense claims, is recouped from your royalties before payouts.</p>
            <div className="flex flex-wrap gap-3 mb-6">
              {(() => {
                // Approved spend: what the label spent on the artist plus the artist's own claims once approved for payment.
                const { byLabel, claims: approvedClaims } = artistSpend(artist, ledger, invoices);
                return <KPICard icon={Wallet} label="Artist’s approved spend" value={formatCents(byLabel + approvedClaims)} sub={formatCents(byLabel) + ' by the label · ' + formatCents(approvedClaims) + ' your approved claims'} />;
              })()}
              <KPICard icon={Wallet} label="Still being recouped" value={formatCents(remainingRecoupable)} tone={remainingRecoupable > 0 ? 'amber' : undefined} sub="From your royalties, not paid in cash" />
              {artistSpend(artist, ledger, invoices).repaidCash > 0 && <KPICard icon={Wallet} label="Repaid in cash" value={formatCents(artistSpend(artist, ledger, invoices).repaidCash)} sub="At the label’s request; not taken from your earnings" />}
              <KPICard icon={FileText} label="Claimed by you" value={formatCents(myExpenseClaims.reduce((t, i) => t + (Number(i.amount) || 0), 0))} sub={formatCents(myExpenseClaims.filter(i => i.status === 'Paid').reduce((t, i) => t + (Number(i.amount) || 0), 0)) + ' paid to you · recouped from royalties'} />
            </div>

            <h2 className="mb-3" style={{ fontWeight: 600, fontSize: 17 }}>Paid by the label</h2>
            {myExpenses.length === 0 ? (
              <div className="mb-8"><EmptyState icon={Wallet} title="Nothing spent yet" description="Advances, marketing and other costs the label pays for you will be listed here." /></div>
            ) : (
              <div className="rounded border overflow-x-auto mb-8" style={{ borderColor: C.border, background: C.panel }}>
                <table className="w-full" style={{ minWidth: 620 }}>
                  <thead><tr><Th>Date</Th><Th>Category</Th><Th>Description</Th><Th>Recoupable</Th><Th align="right">Amount</Th></tr></thead>
                  <tbody>
                    {myExpenses.map(x => (
                      <tr key={x.id}>
                        <Td mono>{formatDate(x.date)}</Td>
                        <Td>{x.category}</Td>
                        <Td>{x.description || '—'}</Td>
                        <Td><Badge tone="amber">Recouped</Badge></Td>
                        <Td align="right" mono>{formatCents(x.amount)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex items-baseline justify-between gap-3 flex-wrap mb-3">
              <h2 style={{ fontWeight: 600, fontSize: 17 }}>Paid by you</h2>
              <Btn variant="ghost" onClick={() => { setInvoiceForm({ ...emptyInvoice, kind: 'expense' }); setInvoiceSent(false); setTab('invoices'); }}><Plus size={14} /> Claim an expense</Btn>
            </div>
            {myExpenseClaims.length === 0 ? (
              <EmptyState icon={FileText} title="No expense claims" description="Spent your own money on something the label agreed to cover? Submit an expense claim from Invoices." />
            ) : (
              <div className="rounded border overflow-x-auto" style={{ borderColor: C.border, background: C.panel }}>
                <table className="w-full" style={{ minWidth: 560 }}>
                  <thead><tr><Th>Date</Th><Th>Description</Th><Th>Status</Th><Th align="right">Amount</Th></tr></thead>
                  <tbody>
                    {myExpenseClaims.map(i => (
                      <tr key={i.id}>
                        <Td mono>{formatDate(i.invoiceDate)}</Td>
                        <Td>{i.title}</Td>
                        <Td><Badge tone={INVOICE_TONES[invoiceStatus(i)]}>{artistInvoiceStatus(i)}</Badge></Td>
                        <Td align="right" mono>{formatCents(i.amount)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
  );
}

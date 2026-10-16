import { DollarSign } from 'lucide-react';
import { useState } from 'react';
import { C } from '../theme.js';
import { EmptyState, Field, SectionHeader, Select } from '../ui.jsx';
import { ArtistStatementView } from './ArtistStatement.jsx';

export function StatementsSection({ roster, revenue, masterGross, ledger, payouts, statementFiles = [], invoices = [] }) {
  const activeArtists = roster.filter(a => a.status === 'Active');
  const defaultArtist = activeArtists[0] || roster[0] || null;
  const [selectedArtist, setSelectedArtist] = useState(defaultArtist ? defaultArtist.id : '');
  const artist = roster.find(a => a.id === selectedArtist) || null;

  return (
    <div>
      <SectionHeader title="Statements" artistNote="nothing. This is your preview; artists get statements through Payouts → Send to artist." description="A per-artist royalty statement, generated on demand from revenue and money received." />
      <div className="rounded border p-4 mb-6 imss-print-hide" style={{ background: C.panel, borderColor: C.border }}>
        <Field label="Artist">
          <Select value={selectedArtist} onChange={e => setSelectedArtist(e.target.value)}>
            {roster.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
        </Field>
      </div>
      {artist ? (
        <ArtistStatementView invoices={invoices} artist={artist} revenue={revenue} masterGross={masterGross} ledger={ledger} payouts={payouts} statementFiles={statementFiles} requireGenerate forTeam />
      ) : (
        <EmptyState icon={DollarSign} title="No artists on roster" description="Add an artist to the roster to generate a statement." />
      )}
    </div>
  );
}

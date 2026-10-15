// Artist portal for a signed-in artist. The database's artist_portal() returns
// only this artist's own data; new requests go through artist_add().
import { useEffect, useState } from 'react';
import { ArtistPortalShell } from './App.jsx';
import { supabase } from './storage.js';
import { C, HEADING_FONT } from './theme.js';

export default function ArtistApp({ signOut }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  async function load() {
    const { data: portal, error: err } = await supabase.rpc('artist_portal');
    if (err) setError('Could not load your data. Try again in a moment.');
    else setData(portal);
  }
  useEffect(() => { load(); }, []);

  // The portal hands back the whole list; only the items it just added are sent.
  const adder = (section) => async (next) => {
    const known = new Set((data[section] || []).map(x => x.id));
    for (const item of next.filter(x => !known.has(x.id))) {
      const { error: err } = await supabase.rpc('artist_add', { section_key: section, item });
      if (err) { setError('Could not send that. Please try again.'); return; }
    }
    load();
  };

  if (error) return <div className="p-8 text-sm" role="alert" style={{ color: C.text, fontFamily: HEADING_FONT }}>{error}</div>;
  if (!data) return null;

  return (
    <ArtistPortalShell
      artist={data.artist} roster={[data.artist]} catalog={data.catalog} revenue={data.revenue}
      streams={data.streams} masterGross={data.masterGross} payouts={data.payouts} ledger={data.ledger}
      notices={data.notices} labelSettings={data.labelSettings || {}}
      profileRequests={data.profileRequests} updateProfileRequests={adder('profileRequests')}
      artistRequests={data.artistRequests} updateArtistRequests={adder('artistRequests')}
      releaseSubmissions={data.releaseSubmissions} updateReleaseSubmissions={adder('releaseSubmissions')}
      invoices={data.invoices || []} updateInvoices={adder('invoices')}
      replyToSubmission={async (id, message) => {
        const { error: err } = await supabase.rpc('artist_reply_submission', { submission_id: id, message });
        if (err) { setError('Could not send your reply. Please try again.'); return; }
        load();
      }}
      onLogout={signOut}
    />
  );
}

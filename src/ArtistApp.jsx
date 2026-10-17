// Artist portal for a signed-in artist. The database's artist_portal() returns
// only this artist's own data; new requests go through artist_add().
import { useEffect, useState } from 'react';
import { ArtistPortalShell } from './sections/ArtistPortal.jsx';
import { supabase } from './storage.js';
import { logActivity, logSignIn } from './audit.js';
import { useStepUp } from './Mfa.jsx';

// Invoices and profile changes (payout details) need a fresh passkey or code.
const SENSITIVE = new Set(['invoices', 'profileRequests']);

const WHAT = { profileRequests: 'requested a profile change', artistRequests: 'sent a request', releaseSubmissions: 'submitted a release', invoices: 'submitted an invoice' };

import { C, HEADING_FONT } from './theme.js';

export default function ArtistApp({ signOut }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [stepUpDialog, askStepUp] = useStepUp();

  async function load() {
    const { data: portal, error: err } = await supabase.rpc('artist_portal');
    if (err) setError('Could not load your data. Try again in a moment.');
    else { setData(portal); if (portal && portal.artist) logSignIn('artist', portal.artist.name); }
  }
  useEffect(() => { load(); }, []);

  // The portal hands back the whole list; only the items it just added are sent.
  const adder = (section) => async (next) => {
    const known = new Set((data[section] || []).map(x => x.id));
    for (const item of next.filter(x => !known.has(x.id))) {
      if (SENSITIVE.has(section) && !(await askStepUp())) { load(); return; }
      let { error: err } = await supabase.rpc('artist_add', { section_key: section, item });
      // The database says the check is too old: ask once more, then retry.
      if (err && /confirm_identity/.test(err.message || '') && await askStepUp()) ({ error: err } = await supabase.rpc('artist_add', { section_key: section, item }));
      if (err) { setError(/confirm_identity/.test(err.message || '') ? 'Not sent: confirm it’s you with your passkey or code, then try again.' : 'Could not send that. Please try again.'); return; }
      logActivity(WHAT[section] || 'added to ' + section, item.title || item.category || item.description || '');
    }
    load();
  };

  if (error) return <div className="p-8 text-sm" role="alert" style={{ color: C.text, fontFamily: HEADING_FONT }}>{error}</div>;
  if (!data) return null;

  return (
    <>{stepUpDialog}
    <ArtistPortalShell
      artist={data.artist} roster={[data.artist]} catalog={data.catalog} revenue={data.revenue}
      streams={data.streams} masterGross={data.masterGross} payouts={data.payouts} ledger={data.ledger}
      notices={data.notices} labelSettings={data.labelSettings || {}}
      profileRequests={data.profileRequests} updateProfileRequests={adder('profileRequests')}
      artistRequests={data.artistRequests} updateArtistRequests={adder('artistRequests')}
      releaseSubmissions={data.releaseSubmissions} updateReleaseSubmissions={adder('releaseSubmissions')}
      invoices={data.invoices || []} updateInvoices={adder('invoices')}
      statementFiles={data.statementFiles || []}
      dealChanges={data.dealChanges || []}
      replyToSubmission={async (id, message) => {
        const { error: err } = await supabase.rpc('artist_reply_submission', { submission_id: id, message });
        if (err) { setError('Could not send your reply. Please try again.'); return; }
        logActivity('replied on a release submission', '');
        load();
      }}
      replyToInvoice={async (id, message) => {
        const { error: err } = await supabase.rpc('artist_reply_invoice', { invoice_id: id, message });
        if (err) { setError('Could not send your message. Please try again.'); return; }
        logActivity('messaged about an invoice', '');
        load();
      }}
      onLogout={signOut}
    /></>
  );
}

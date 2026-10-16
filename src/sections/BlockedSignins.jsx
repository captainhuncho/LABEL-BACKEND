// Blocked sign-ins (Admin only): uninvited emails that tried to sign in in the
// last 30 days, kept on the server by the Before User Created hook. Allowing one
// puts the email on the Team list or an artist's Roster entry; the server then
// drops it from this list by itself.
import { useEffect, useState } from 'react';
import { ShieldOff } from 'lucide-react';
import { supabase } from '../storage.js';
import { logActivity } from '../audit.js';
import { formatDate } from '../constants.js';
import { C } from '../theme.js';
import { Btn, Select, Td, Th } from '../ui.jsx';

export function BlockedSignins({ roster = [], updateRoster, onAddTeam }) {
  const [rows, setRows] = useState(null);
  const [pick, setPick] = useState({});
  const [error, setError] = useState('');
  async function load() {
    if (!supabase) { setRows([]); return; }
    const { data, error: err } = await supabase.rpc('blocked_signins_list');
    if (err) { setError('Could not load blocked sign-ins.'); setRows([]); } else setRows(data || []);
  }
  useEffect(() => { load(); }, []);
  async function dismiss(email) {
    await supabase.rpc('blocked_signin_dismiss', { addr: email });
    logActivity('dismissed a blocked sign-in', '');
    load();
  }
  function giveToArtist(email) {
    const a = roster.find(x => x.id === pick[email]);
    if (!a) { setError('Choose the artist first.'); return; }
    if (a.email && !window.confirm(a.name + ' already signs in with ' + a.email + '. Replace it? Their old address loses sign-in.')) return;
    updateRoster(roster.map(x => x.id === a.id ? { ...x, email } : x));
    logActivity('allowed a blocked sign-in for an artist', a.name, a.id);
    setTimeout(load, 1500);
  }
  if (!rows || rows.length === 0) return error ? <div role="alert" style={{ color: C.red, fontSize: 14 }} className="mb-4">{error}</div> : null;
  return (
    <section aria-label="Blocked sign-ins" className="rounded mb-6" style={{ background: C.panel }}>
      <div className="imss-dash-ph"><h2 className="inline-flex items-center gap-2"><ShieldOff size={16} aria-hidden="true" /> Blocked sign-ins</h2><span style={{ color: C.textDim, fontSize: 13 }}>Kept 30 days · only Admins see this</span></div>
      <div className="overflow-x-auto" style={{ borderTop: '1px solid ' + C.border }}>
        <table className="w-full" style={{ minWidth: 760 }}>
          <thead><tr><Th>Email</Th><Th>Tried with</Th><Th>Last try</Th><Th>Tries</Th><Th align="right">Allow</Th></tr></thead>
          <tbody>{rows.map(r => (
            <tr key={r.email}>
              <Td>{r.email}</Td>
              <Td>{r.method === 'google' ? 'Google' : 'Email link'}</Td>
              <Td mono>{formatDate(String(r.last_at).slice(0, 10))}</Td>
              <Td mono>{r.attempts}</Td>
              <Td align="right">
                <span className="inline-flex items-center gap-2 flex-wrap justify-end">
                  <Btn variant="ghost" onClick={() => onAddTeam(r.email)}>Add to team</Btn>
                  <span style={{ minWidth: 150 }}><Select value={pick[r.email] || ''} onChange={e => setPick(p => ({ ...p, [r.email]: e.target.value }))} aria-label={'Artist for ' + r.email}><option value="">Give to artist…</option>{roster.filter(a => a.status !== 'Archived').map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></span>
                  {pick[r.email] && <Btn variant="primary" onClick={() => giveToArtist(r.email)}>Allow</Btn>}
                  <button onClick={() => dismiss(r.email)} style={{ color: C.textDim, fontSize: 13 }}>Dismiss</button>
                </span>
              </Td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      {error && <div role="alert" className="px-4 py-3" style={{ color: C.red, fontSize: 14 }}>{error}</div>}
    </section>
  );
}

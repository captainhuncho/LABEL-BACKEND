// Passkeys: sign in with Face ID, fingerprint or the device's screen lock.
// Someone signs in once (Google or email), then adds a passkey here; next time
// they use "Sign in with passkey". Invite-only still applies: a passkey belongs
// to an existing, invited account.
import { useEffect, useState } from 'react';
import { KeyRound, Trash2 } from 'lucide-react';
import { supabase } from './storage.js';
import { logActivity } from './audit.js';
import { formatDate } from './constants.js';
import { C } from './theme.js';
import { Btn } from './ui.jsx';

export const passkeysSupported = () => typeof window !== 'undefined' && !!window.PublicKeyCredential && !!supabase;

export function PasskeySettings() {
  const [list, setList] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  async function load() {
    const { data, error } = await supabase.auth.passkey.list();
    setList(error ? [] : (data && (data.passkeys || data)) || []);
  }
  useEffect(() => { if (passkeysSupported()) load(); }, []);
  if (!passkeysSupported()) return null;
  async function add() {
    setBusy(true); setMsg('');
    const { error } = await supabase.auth.registerPasskey();
    setBusy(false);
    if (error) { setMsg(/abort|cancel|not allowed/i.test(error.message || '') ? 'Cancelled.' : 'Couldn’t add a passkey on this device.'); return; }
    logActivity('added a passkey', '');
    setMsg('Passkey added. Next time, choose “Sign in with passkey”.');
    load();
  }
  async function remove(id) {
    const { error } = await supabase.auth.passkey.delete({ passkeyId: id });
    if (!error) { logActivity('removed a passkey', ''); load(); }
  }
  return (
    <section aria-label="Passkeys" className="rounded p-5 mb-6" style={{ background: C.panel }}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="inline-flex items-center gap-2" style={{ fontWeight: 600, fontSize: 17 }}><KeyRound size={16} aria-hidden="true" /> Passkeys</h2>
          <p style={{ color: C.textDim, fontSize: 14, marginTop: 2 }}>Sign in with Face ID, your fingerprint or this device’s screen lock.</p>
        </div>
        <Btn variant="primary" onClick={add} disabled={busy}>{busy ? 'Follow your device…' : 'Add a passkey'}</Btn>
      </div>
      {msg && <div className="mt-3" role="status" style={{ color: /Couldn|Cancel/.test(msg) ? C.amber : C.teal, fontSize: 14 }}>{msg}</div>}
      {list && list.length > 0 && (
        <ul className="mt-3" style={{ borderTop: '1px solid ' + C.border }}>
          {list.map(p => (
            <li key={p.id} className="flex items-center justify-between gap-3" style={{ padding: '10px 0', borderBottom: '1px solid ' + C.border, fontSize: 14 }}>
              <span>{p.friendly_name || 'Passkey'} <span style={{ color: C.textDim }}>· added {formatDate(String(p.created_at).slice(0, 10))}{p.last_used_at ? ' · last used ' + formatDate(String(p.last_used_at).slice(0, 10)) : ''}</span></span>
              <button onClick={() => remove(p.id)} aria-label="Remove this passkey" style={{ color: C.textDim }}><Trash2 size={14} /></button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

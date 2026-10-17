// Two-factor sign-in with an authenticator app (6-digit codes).
// Team: required; set up on first sign-in, then asked for after Google or email
// sign-in. A passkey sign-in already counts. Artists: optional (Profile).
// The database enforces it for the team (private.second_factor_ok).
import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { supabase } from './storage.js';
import { C, CANVAS_GRADIENT, GLOBAL_STYLES, HEADING_FONT, LOGO_DATA_URI } from './theme.js';
import { Btn } from './ui.jsx';

const usedPasskey = methods => (methods || []).some(m => /webauthn|passkey/i.test(typeof m === 'string' ? m : m.method));

export async function mfaState() {
  const [{ data: aal }, { data: f }] = await Promise.all([supabase.auth.mfa.getAuthenticatorAssuranceLevel(), supabase.auth.mfa.listFactors()]);
  const totp = ((f && f.totp) || []).find(x => x.status === 'verified') || null;
  return { done: aal.currentLevel === 'aal2' || usedPasskey(aal.currentAuthenticationMethods), totp };
}

function CodeInput({ onSubmit, busy, label }) {
  const [code, setCode] = useState('');
  return (
    <form onSubmit={e => { e.preventDefault(); if (code.length === 6) onSubmit(code); }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <input aria-label="6-digit code" inputMode="numeric" autoComplete="one-time-code" autoFocus maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} placeholder="123456"
        style={{ width: 200, textAlign: 'center', letterSpacing: '0.3em', fontSize: 24, background: 'var(--field)', color: C.text, border: '1px solid var(--field-line)', borderRadius: 12, padding: '12px 14px' }} />
      <Btn variant="primary" type="submit" disabled={busy || code.length !== 6}>{busy ? 'Checking…' : label}</Btn>
    </form>
  );
}

function Shell({ title, children, onSignOut }) {
  return (
    <div className="imss-gate" style={{ background: CANVAS_GRADIENT, fontFamily: HEADING_FONT, color: C.text, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 16px', overflowY: 'auto' }}>
      <style>{GLOBAL_STYLES}</style>
      <main style={{ width: '100%', maxWidth: 380, margin: 'auto 0', textAlign: 'center' }}>
        <img src={LOGO_DATA_URI} alt="IMSS Records" style={{ height: 56, width: 'auto', display: 'block', margin: '0 auto 28px', filter: 'var(--logo-filter)' }} />
        <h1 className="inline-flex items-center gap-2" style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}><ShieldCheck size={20} aria-hidden="true" /> {title}</h1>
        {children}
        <button onClick={onSignOut} style={{ color: C.textDim, fontSize: 14, marginTop: 24 }}>Sign out</button>
      </main>
    </div>
  );
}

// Wraps the app: shows the code step when needed, otherwise the app.
export function MfaGate({ access, signOut, children }) {
  const [st, setSt] = useState(null);       // { done, totp }
  const [enroll, setEnroll] = useState(null); // { id, qr, secret }
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function refresh() { try { setSt(await mfaState()); } catch (e) { setSt({ done: false, totp: null, failed: true }); } }
  useEffect(() => { refresh(); }, []);
  // Team without a factor: start setting one up straight away.
  useEffect(() => {
    if (!st || st.done || st.totp || access !== 'team' || enroll) return;
    supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Authenticator app' }).then(({ data, error }) => {
      if (error) setErr('Could not start two-factor set-up. Sign out and in again.');
      else setEnroll({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    });
  }, [st, access, enroll]);

  async function verify(factorId, code) {
    setBusy(true); setErr('');
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    setBusy(false);
    if (error) { setErr('That code didn’t work. Check the time on your phone and try the newest code.'); return; }
    window.location.reload(); // fresh session with the second factor
  }

  if (!st) return null;
  if (st.done) return children;
  if (st.totp) return (
    <Shell title="Enter your code" onSignOut={signOut}>
      <p style={{ color: C.textDim, fontSize: 15, margin: '10px 0 20px' }}>Open your authenticator app and enter the 6-digit code for IMSS Records.</p>
      <CodeInput busy={busy} label="Continue" onSubmit={code => verify(st.totp.id, code)} />
      {err && <div role="alert" style={{ color: C.red, fontSize: 14, marginTop: 14 }}>{err}</div>}
    </Shell>
  );
  if (access !== 'team') return children; // artists: optional
  return (
    <Shell title="Set up two-factor sign-in" onSignOut={signOut}>
      <p style={{ color: C.textDim, fontSize: 15, margin: '10px 0 16px', lineHeight: 1.5 }}>The team signs in with a second step. Scan this with an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password), then enter the 6-digit code it shows.</p>
      {enroll ? <>
        <img src={enroll.qr} alt="QR code for your authenticator app" style={{ width: 180, height: 180, margin: '0 auto 10px', background: '#fff', borderRadius: 12, padding: 8 }} />
        <div style={{ color: C.textDim, fontSize: 12, marginBottom: 16, wordBreak: 'break-all' }}>Can’t scan? Enter this key: <span style={{ fontFamily: 'monospace', color: C.text }}>{enroll.secret}</span></div>
        <CodeInput busy={busy} label="Turn on" onSubmit={code => verify(enroll.id, code)} />
      </> : <div style={{ color: C.textDim }}>Preparing…</div>}
      {err && <div role="alert" style={{ color: C.red, fontSize: 14, marginTop: 14 }}>{err}</div>}
    </Shell>
  );
}

// Artist (or team) settings: turn the code on or off.
export function TwoFactorSettings() {
  const [st, setSt] = useState(null);
  const [enroll, setEnroll] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  useEffect(() => { if (supabase) mfaState().then(setSt, () => setSt(null)); }, []);
  if (!supabase || !st) return null;
  async function start() {
    setMsg('');
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Authenticator app' });
    if (error) setMsg('Could not start set-up. Try again.'); else setEnroll({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  }
  async function finish(code) {
    setBusy(true);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: enroll.id, code });
    setBusy(false);
    if (error) { setMsg('That code didn’t work. Try the newest code.'); return; }
    setEnroll(null); setMsg('Two-factor sign-in is on.'); setSt(await mfaState());
  }
  return (
    <section aria-label="Two-factor sign-in" className="rounded p-5 mb-6" style={{ background: C.panel }}>
      <h2 className="inline-flex items-center gap-2" style={{ fontWeight: 600, fontSize: 17 }}><ShieldCheck size={16} aria-hidden="true" /> Two-factor sign-in</h2>
      <p style={{ color: C.textDim, fontSize: 14, marginTop: 2 }}>{st.totp ? 'On. After signing in with Google or email, you’ll enter a 6-digit code from your authenticator app.' : 'Add a 6-digit code from an authenticator app after you sign in, for extra protection.'}</p>
      {!st.totp && !enroll && <div className="mt-3"><Btn variant="primary" onClick={start}>Turn on two-factor</Btn></div>}
      {enroll && <div className="mt-3" style={{ textAlign: 'center' }}>
        <img src={enroll.qr} alt="QR code for your authenticator app" style={{ width: 170, height: 170, margin: '0 auto 8px', background: '#fff', borderRadius: 12, padding: 8 }} />
        <div style={{ color: C.textDim, fontSize: 12, marginBottom: 12, wordBreak: 'break-all' }}>Key: <span style={{ fontFamily: 'monospace', color: C.text }}>{enroll.secret}</span></div>
        <CodeInput busy={busy} label="Turn on" onSubmit={finish} />
      </div>}
      {msg && <div className="mt-3" role="status" style={{ color: /didn|Could/.test(msg) ? C.amber : C.teal, fontSize: 14 }}>{msg}</div>}
    </section>
  );
}

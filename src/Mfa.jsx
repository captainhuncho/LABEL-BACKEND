// Second step after Google or email sign-in, for the team and artists.
// Passkey first (Face ID, fingerprint, screen lock); an authenticator app's
// 6-digit code is the alternative. Signing in with a passkey already counts.
// The database enforces it (private.second_factor_ok); invoices and payout
// changes ask again if the last check is over 10 minutes old.
import { useEffect, useRef, useState } from 'react';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { supabase } from './storage.js';
import { logActivity } from './audit.js';
import { C, CANVAS_GRADIENT, GLOBAL_STYLES, HEADING_FONT, LOGO_DATA_URI } from './theme.js';
import { Btn } from './ui.jsx';

const isFactor = m => /webauthn|passkey|totp/i.test(typeof m === 'string' ? m : m.method);
const canPasskey = () => typeof window !== 'undefined' && !!window.PublicKeyCredential;

export async function mfaState() {
  const [{ data: aal }, { data: f }, pk] = await Promise.all([
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(), supabase.auth.mfa.listFactors(),
    canPasskey() ? supabase.auth.passkey.list().catch(() => ({ data: [] })) : { data: [] },
  ]);
  const methods = aal.currentAuthenticationMethods || [];
  const passkeys = (pk.data && (pk.data.passkeys || pk.data)) || [];
  const totp = ((f && f.totp) || []).find(x => x.status === 'verified') || null;
  const latest = Math.max(0, ...methods.filter(isFactor).map(m => Number(m.timestamp) || 0));
  return { done: aal.currentLevel === 'aal2' || methods.some(isFactor), totp, passkeys: Array.isArray(passkeys) ? passkeys : [], recent: latest > Date.now() / 1000 - 540 };
}

// Passkey check for the person already signed in. A passkey for a different
// account on this device would switch accounts, so that is refused.
async function passkeyCheck() {
  const { data: before } = await supabase.auth.getUser();
  const { data, error } = await supabase.auth.signInWithPasskey();
  if (error) return /abort|cancel|not allowed/i.test(error.message || '') ? 'Cancelled.' : 'That passkey didn’t work on this device.';
  const after = (data && data.user) || (await supabase.auth.getUser()).data.user;
  if (!after || !before.user || after.id !== before.user.id) { await supabase.auth.signOut(); return 'That passkey belongs to a different account. Sign in again.'; }
  return '';
}
async function addPasskey() {
  const { error } = await supabase.auth.registerPasskey();
  if (error) return /abort|cancel|not allowed/i.test(error.message || '') ? 'Cancelled.' : 'Couldn’t add a passkey on this device. Use an authenticator app instead.';
  logActivity('added a passkey', '');
  return passkeyCheck();
}

function CodeInput({ onSubmit, busy, label }) {
  const [code, setCode] = useState('');
  return (
    <form onSubmit={e => { e.preventDefault(); if (code.length === 6) onSubmit(code); }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <input aria-label="6-digit code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} placeholder="123456"
        style={{ width: 200, textAlign: 'center', letterSpacing: '0.3em', fontSize: 24, background: 'var(--field)', color: C.text, border: '1px solid var(--field-line)', borderRadius: 12, padding: '12px 14px' }} />
      <Btn variant="primary" type="submit" disabled={busy || code.length !== 6}>{busy ? 'Checking…' : label}</Btn>
    </form>
  );
}

// The choices: passkey or code to confirm; or set one up. onDone runs after success.
function SecondStep({ st, onDone, artist }) {
  const [enroll, setEnroll] = useState(null); // { id, qr, secret }
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const has = st.passkeys.length > 0 || st.totp;
  async function run(fn) { setBusy(true); setErr(''); const e = await fn(); setBusy(false); if (e) setErr(e); else onDone(); }
  async function verify(factorId, code) {
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    return error ? 'That code didn’t work. Check the time on your phone and try the newest code.' : '';
  }
  async function startApp() {
    setErr('');
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Authenticator app' });
    if (error) setErr('Could not start set-up. Try again.'); else setEnroll({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  }
  const link = { color: C.textDim, fontSize: 14, marginTop: 14 };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      {enroll ? <>
        <p style={{ color: C.textDim, fontSize: 15, lineHeight: 1.5 }}>Scan this with an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password), then enter the 6-digit code it shows.</p>
        <img src={enroll.qr} alt="QR code for your authenticator app" style={{ width: 180, height: 180, background: '#fff', borderRadius: 12, padding: 8 }} />
        <div style={{ color: C.textDim, fontSize: 12, wordBreak: 'break-all' }}>Can’t scan? Key: <span style={{ fontFamily: 'monospace', color: C.text }}>{enroll.secret}</span></div>
        <CodeInput busy={busy} label="Turn on" onSubmit={code => run(() => verify(enroll.id, code))} />
        <button type="button" onClick={() => setEnroll(null)} style={link}>Back</button>
      </> : has ? <>
        {st.passkeys.length > 0 && canPasskey() && <Btn variant="primary" disabled={busy} onClick={() => run(passkeyCheck)}><KeyRound size={15} /> {busy ? 'Follow your device…' : 'Continue with passkey'}</Btn>}
        {st.totp && <>
          {st.passkeys.length > 0 && <div style={{ color: C.textDim, fontSize: 13 }}>or enter the code from your authenticator app</div>}
          <CodeInput busy={busy} label="Continue" onSubmit={code => run(() => verify(st.totp.id, code))} />
        </>}
        {!st.totp && st.passkeys.length > 0 && <button type="button" onClick={startApp} style={link}>No passkey on this device? Use an authenticator app</button>}
      </> : <>
        <p style={{ color: C.textDim, fontSize: 15, lineHeight: 1.5 }}>Add a passkey so it’s really you signing in. It uses Face ID, your fingerprint or this device’s screen lock: nothing to remember.</p>
        {canPasskey() && <Btn variant="primary" disabled={busy} onClick={() => run(addPasskey)}><KeyRound size={15} /> {busy ? 'Follow your device…' : 'Set up a passkey'}</Btn>}
        <button type="button" onClick={startApp} style={link}>Use an authenticator app instead</button>
      </>}
      {err && <div role="alert" style={{ color: C.red, fontSize: 14 }}>{err}</div>}
      {artist && <div style={{ color: C.textDim, fontSize: 13, marginTop: 6 }}>Lost your phone or passkey? Contact your Product Manager.</div>}
    </div>
  );
}

function Shell({ title, children, onSignOut }) {
  return (
    <div className="imss-gate" style={{ background: CANVAS_GRADIENT, fontFamily: HEADING_FONT, color: C.text, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 16px', overflowY: 'auto' }}>
      <style>{GLOBAL_STYLES}</style>
      <main style={{ width: '100%', maxWidth: 380, margin: 'auto 0', textAlign: 'center' }}>
        <img src={LOGO_DATA_URI} alt="IMSS Records" style={{ height: 56, width: 'auto', display: 'block', margin: '0 auto 28px', filter: 'var(--logo-filter)' }} />
        <h1 className="inline-flex items-center gap-2" style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 16 }}><ShieldCheck size={20} aria-hidden="true" /> {title}</h1>
        {children}
        <button onClick={onSignOut} style={{ color: C.textDim, fontSize: 14, marginTop: 24 }}>Sign out</button>
      </main>
    </div>
  );
}

// Wraps the app: the second step when the session doesn't have it yet.
export function MfaGate({ access, signOut, children }) {
  const [st, setSt] = useState(null);
  useEffect(() => { mfaState().then(setSt, () => setSt({ done: false, totp: null, passkeys: [] })); }, []);
  if (!st) return null;
  if (st.done) return children;
  const has = st.passkeys.length > 0 || st.totp;
  return (
    <Shell title={has ? 'Confirm it’s you' : 'Secure your account'} onSignOut={signOut}>
      <SecondStep st={st} artist={access === 'artist'} onDone={() => window.location.reload()} />
    </Shell>
  );
}

// For sensitive actions (invoices, payout changes): ask() resolves true once
// the person has confirmed with a passkey or code in the last few minutes.
export function useStepUp() {
  const [st, setSt] = useState(null);
  const resolver = useRef(null);
  async function ask() {
    const s = await mfaState();
    if (s.recent) return true;
    setSt(s);
    return new Promise(res => { resolver.current = res; });
  }
  function finish(ok) { setSt(null); if (resolver.current) resolver.current(ok); resolver.current = null; }
  const el = st && (
    <div role="dialog" aria-modal="true" aria-label="Confirm it’s you" style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="rounded p-6" style={{ background: C.panel, color: C.text, width: '100%', maxWidth: 380, textAlign: 'center', fontFamily: HEADING_FONT }}>
        <h2 className="inline-flex items-center gap-2" style={{ fontWeight: 700, fontSize: 19, marginBottom: 6 }}><ShieldCheck size={18} aria-hidden="true" /> Confirm it’s you</h2>
        <p style={{ color: C.textDim, fontSize: 14, marginBottom: 16 }}>Invoices and payout details need a quick check.</p>
        <SecondStep st={st} artist onDone={() => finish(true)} />
        <button type="button" onClick={() => finish(false)} style={{ color: C.textDim, fontSize: 14, marginTop: 16 }}>Cancel</button>
      </div>
    </div>
  );
  return [el, ask];
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

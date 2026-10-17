// Email-link sign-in in front of the dashboard. Without Supabase configured it
// renders the dashboard straight away (local, single-browser mode).
import { useEffect, useState } from 'react';
import { KeyRound, Mail } from 'lucide-react';
import { passkeysSupported } from './Passkeys.jsx';
import { MfaGate } from './Mfa.jsx';
import { supabase } from './storage.js';
import { C, CANVAS_GRADIENT, GLOBAL_STYLES, HEADING_FONT, LOGO_DATA_URI } from './theme.js';

// Two addresses, one app: artist.imssrecords.com is the artist portal ("For
// Artists"), ops.imssrecords.com is for the team. Artists who sign in on ops
// are turned away as invite only; team members on the artist address go to ops.
// `?site=artist` previews the artist address locally.
export const isArtistSite = () => window.location.hostname.startsWith('artist.') || (import.meta.env.DEV && new URLSearchParams(window.location.search).get('site') === 'artist');
const OPS_URL = 'https://ops.imssrecords.com';

export default function AuthGate({ children }) {
  const [authEmail, setAuthEmail] = useState(null);
  // 'team', 'artist', or null (signed in but on neither list); undefined while checking.
  const [access, setAccess] = useState(undefined);
  const [checking, setChecking] = useState(!!supabase);
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [emailMode, setEmailMode] = useState(false);
  const [code, setCode] = useState('');
  // Uninvited: the database refuses to create the account, so nothing about the
  // attempt (not even the email) is kept, and no email is sent.
  const [linkError, setLinkError] = useState(() => {
    const u = window.location.search + window.location.hash;
    if (/otp_expired|expired/i.test(u)) return 'That sign-in link has expired or was already used. Ask for a new one.';
    if (/error=/.test(u) && !/Database(\+|%20| )error|invite_only/i.test(u)) return 'Sign-in didn’t finish. Please try again.';
    return '';
  });
  const [denied, setDenied] = useState(() => /Database(\+|%20| )error|invite_only/i.test(window.location.search + window.location.hash));
  useEffect(() => { if ((denied || linkError) && /error/.test(window.location.search + window.location.hash)) window.history.replaceState(null, '', '/' + (import.meta.env.DEV && isArtistSite() ? '?site=artist' : '')); }, [denied, linkError]);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setAuthEmail(data.session ? data.session.user.email : null);
      setChecking(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthEmail(session ? session.user.email : null);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!supabase || !authEmail) return;
    setAccess(undefined);
    // A failed check is a site problem, not "not invited".
    supabase.rpc('my_access').then(({ data, error: err }) => setAccess(err ? 'error' : data));
  }, [authEmail]);

  // Signed in, but not on the Team list or an artist's Roster entry: sign them
  // straight back out and say why on the sign-in page.
  useEffect(() => {
    if (!supabase || !authEmail || access === undefined) return;
    if (access === 'error') { setError('We couldn’t open your account just now. Try again in a moment.'); supabase.auth.signOut(); return; }
    if ((access === 'team' || access === 'rep') && isArtistSite()) { window.location.replace(OPS_URL); return; }
    if (access === null || (access === 'artist' && !isArtistSite())) { setDenied(true); supabase.auth.signOut(); }
  }, [authEmail, access]);

  if (!supabase) return children({ authEmail: null, access: 'team', signOut: null });
  if (checking) return null;
  const signOut = () => supabase.auth.signOut();
  if (authEmail && access === undefined) return null;
  if (authEmail && access && access !== 'error' && !(access === 'artist' && !isArtistSite()) && !((access === 'team' || access === 'rep') && isArtistSite())) return <MfaGate access={access} signOut={signOut}>{children({ authEmail, access, signOut })}</MfaGate>;
  if (authEmail) return null; // not invited: the effect above signs them out

  // Google sign-in: the Google account's email must be on the Team list or an
  // artist's Roster entry, exactly as with an email link (my_access decides).
  async function signInWithGoogle() {
    setError(''); setDenied(false); setLinkError('');
    const { error: err } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin, queryParams: { prompt: 'select_account' } } });
    if (err) setError(/not enabled|provider/i.test(err.message) ? 'Google sign-in isn’t switched on yet. Use the email link for now.' : err.message);
  }
  async function signInWithPasskey() {
    setError(''); setDenied(false); setLinkError(''); setBusy(true);
    const { error: err } = await supabase.auth.signInWithPasskey();
    setBusy(false);
    if (err && !/abort|cancel|not allowed/i.test(err.message || '')) setError('No passkey found for this device. Sign in with Google or email, then add one.');
  }
  async function sendLink(e) {
    e.preventDefault();
    setError(''); setDenied(false); setLinkError('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Enter your email address.'); return; }
    setBusy(true);
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    setBusy(false);
    if (err && /Database error|invite_only|not allowed|signups/i.test(err.message)) { setDenied(true); setEmail(''); setEmailMode(false); return; }
    if (err) setError(/rate|seconds/i.test(err.message) ? 'Please wait a minute before asking for another code.' : 'Something went wrong. Try again.');
    else { setSent(true); setCode(''); }
  }
  async function verifyCode(e) {
    e.preventDefault();
    setError(''); setBusy(true);
    const { error: err } = await supabase.auth.verifyOtp({ email: email.trim(), token: code, type: 'email' });
    setBusy(false);
    if (err) setError(/expired/i.test(err.message) ? 'That code has expired. Send a new one.' : 'That code didn’t work. Check the newest email and try again.');
  }

  const G = () => (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 7l7.2 5.6c4.2-3.9 7.1-9.6 7.1-17.1z"/><path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.2-5.6c-2 1.4-4.7 2.3-8.7 2.3-6.2 0-11.5-4.1-13.4-9.8l-7.9 6.1C6.6 42.6 14.6 48 24 48z"/></svg>
  );
  const btn = { minWidth: 280, borderRadius: 8, padding: '11px 22px', fontSize: 16, fontWeight: 500, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 };
  // Invite-only: people here already know why. Logo, a line, one button; email is the fallback.
  return (
    <div className="imss-gate" style={{ background: CANVAS_GRADIENT, fontFamily: HEADING_FONT, color: C.text, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 16px', overflowY: 'auto' }}>
      <style>{GLOBAL_STYLES}</style>
      <main style={{ width: '100%', maxWidth: 360, margin: 'auto 0', textAlign: 'center' }}>
        <a href="/" aria-label="IMSS Records" style={{ display: 'inline-block' }}><img src={LOGO_DATA_URI} alt="" style={{ height: 76, width: 'auto', display: 'block', filter: 'var(--logo-filter)' }} /></a>
        {isArtistSite() && <div style={{ marginTop: 14, fontSize: 15, fontWeight: 600, letterSpacing: '0.02em', color: C.textDim }}>For Artists</div>}
        <div style={{ height: 1, width: 280, maxWidth: '100%', background: C.border, margin: '36px auto 44px' }} />
        {sent ? (
          <form onSubmit={verifyCode} noValidate style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <p role="status" style={{ fontSize: 17, lineHeight: 1.5, marginBottom: 6 }}>Enter the code we sent to <b>{email.trim()}</b>.</p>
            <input aria-label="Sign-in code" inputMode="numeric" autoComplete="one-time-code" autoFocus maxLength={10} value={code} onChange={e => { setCode(e.target.value.replace(/\D/g, '')); setError(''); }} placeholder="Code"
              style={{ ...btn, width: 280, background: 'var(--field)', color: C.text, border: '1px solid var(--field-line)', fontSize: 22, letterSpacing: '0.3em', textAlign: 'center', cursor: 'text', opacity: 1 }} />
            <button type="submit" disabled={busy || code.length < 6} style={{ ...btn, width: 280, background: C.text, color: C.bg, opacity: busy || code.length < 6 ? 0.6 : 1 }}>{busy ? 'Checking…' : 'Sign in'}</button>
            <button type="button" disabled={busy} onClick={sendLink} style={{ color: C.textDim, fontSize: 14, marginTop: 6 }}>Send a new code</button>
            <button type="button" onClick={() => { setSent(false); setError(''); setCode(''); }} style={{ color: C.textDim, fontSize: 14 }}>Use a different email</button>
          </form>
        ) : emailMode ? (
          <form onSubmit={sendLink} noValidate style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <input aria-label="Email" type="email" required autoFocus autoComplete="email" inputMode="email" value={email} onChange={e => { setEmail(e.target.value); setError(''); }} placeholder="Email address"
              style={{ ...btn, width: 280, background: 'var(--field)', color: C.text, border: '1px solid var(--field-line)', fontWeight: 400, textAlign: 'center', cursor: 'text', opacity: 1 }} />
            <button type="submit" disabled={busy} style={{ ...btn, width: 280, background: C.text, color: C.bg }}>{busy ? 'Sending…' : 'Email me a sign-in code'}</button>
            <button type="button" onClick={() => { setEmailMode(false); setError(''); }} style={{ color: C.textDim, fontSize: 14, marginTop: 6 }}>Back</button>
          </form>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <button type="button" onClick={signInWithGoogle} disabled={busy} style={{ ...btn, background: C.text, color: C.bg }}><G /> Sign in with Google</button>
            <button type="button" onClick={() => setEmailMode(true)} style={{ ...btn, background: 'transparent', color: C.text, border: '1px solid var(--hairline-strong)' }}><Mail size={18} aria-hidden="true" /> Sign in with email</button>
            {passkeysSupported() && <button type="button" onClick={signInWithPasskey} disabled={busy} style={{ ...btn, background: 'transparent', color: C.text, border: '1px solid var(--hairline-strong)' }}><KeyRound size={18} aria-hidden="true" /> Sign in with passkey</button>}
          </div>
        )}
        {denied && !sent && <div role="alert" style={{ color: C.red, fontSize: 14, lineHeight: 1.5, marginTop: 20 }}>This platform is invite only.</div>}
        {(error || linkError) && <div role="alert" style={{ color: C.red, fontSize: 14, marginTop: 16 }}>{error || linkError}</div>}
        {/* Artists whose email is set up but can't get in: send them to their PM (never named here). */}
        {isArtistSite() && (error || linkError) && !/^Enter your email/.test(error) && !denied && <div style={{ color: C.textDim, fontSize: 14, marginTop: 8 }}>Still having trouble signing in? Contact your Product Manager.</div>}
      </main>
    </div>
  );
}

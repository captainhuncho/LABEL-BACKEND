// Email-link sign-in in front of the dashboard. Without Supabase configured it
// renders the dashboard straight away (local, single-browser mode).
import { LegalFooter } from './Legal.jsx';
import { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import { supabase } from './storage.js';
import { C, CANVAS_GRADIENT, GLOBAL_STYLES, HEADING_FONT, LOGO_DATA_URI } from './theme.js';
import { Btn } from './ui.jsx';

export default function AuthGate({ children }) {
  const [authEmail, setAuthEmail] = useState(null);
  // 'team', 'artist', or null (signed in but on neither list); undefined while checking.
  const [access, setAccess] = useState(undefined);
  const [checking, setChecking] = useState(!!supabase);
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

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
    supabase.rpc('my_access').then(({ data, error: err }) => setAccess(err ? null : data));
  }, [authEmail]);

  if (!supabase) return children({ authEmail: null, access: 'team', signOut: null });
  if (checking) return null;
  const signOut = () => supabase.auth.signOut();
  if (authEmail && access === undefined) return null;
  if (authEmail && access) return children({ authEmail, access, signOut });
  if (authEmail) {
    return (
      <div className="p-8 text-sm" style={{ color: C.text, fontFamily: HEADING_FONT }} role="alert">
        <style>{GLOBAL_STYLES}</style>
        <p className="mb-3">{authEmail} isn't set up for IMSS Records yet. Ask the label to add this email to your artist profile or the team list.</p>
        <Btn variant="ghost" onClick={signOut}>Sign out</Btn>
      </div>
    );
  }

  // Google sign-in: the Google account's email must be on the Team list or an
  // artist's Roster entry, exactly as with an email link (my_access decides).
  async function signInWithGoogle() {
    setError('');
    const { error: err } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin, queryParams: { prompt: 'select_account' } } });
    if (err) setError(/not enabled|provider/i.test(err.message) ? 'Google sign-in isn’t switched on yet. Use the email link for now.' : err.message);
  }
  async function sendLink(e) {
    e.preventDefault();
    setError('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Enter your email address.'); return; }
    setBusy(true);
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    setBusy(false);
    if (err) setError(/rate|seconds/i.test(err.message) ? 'Please wait a minute before asking for another link.' : err.message);
    else setSent(true);
  }

  const G = () => (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 7l7.2 5.6c4.2-3.9 7.1-9.6 7.1-17.1z"/><path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.2-5.6c-2 1.4-4.7 2.3-8.7 2.3-6.2 0-11.5-4.1-13.4-9.8l-7.9 6.1C6.6 42.6 14.6 48 24 48z"/></svg>
  );
  const wide = { width: '100%', borderRadius: 980, padding: '13px 18px', fontSize: 17, fontWeight: 500, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 };
  return (
    <div className="imss-gate" style={{ background: CANVAS_GRADIENT, fontFamily: HEADING_FONT, color: C.text, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 16px', overflowY: 'auto' }}>
      <style>{GLOBAL_STYLES}</style>
      <main className="imss-signin-card" style={{ width: '100%', maxWidth: 440, margin: 'auto 0 0' }}>
        <img src={LOGO_DATA_URI} alt="IMSS Records" style={{ height: 44, width: 'auto', display: 'block', margin: '0 auto 24px', filter: 'var(--logo-filter)' }} />
        <div style={{ textAlign: 'center', marginBottom: 14 }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: C.amberSoft, color: C.amber, borderRadius: 980, padding: '5px 12px', fontSize: 13, fontWeight: 600 }}><Lock size={13} aria-hidden="true" /> Invite only</span></div>
        {sent ? (
          <div role="status" style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1.15 }}>Check your email</h1>
            <p style={{ color: C.textDim, fontSize: 17, lineHeight: 1.5, marginTop: 10 }}>We sent a sign-in link to <b style={{ color: C.text }}>{email.trim()}</b>. It works once and expires in 10 minutes.</p>
            <button type="button" onClick={() => { setSent(false); setError(''); }} style={{ color: C.amber, fontSize: 15, marginTop: 22 }}>Use a different email</button>
          </div>
        ) : (
          <>
            <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1.15, textAlign: 'center' }}>Sign in</h1>
            <p style={{ color: C.textDim, fontSize: 17, lineHeight: 1.45, marginTop: 8, textAlign: 'center' }}>For the label team and invited artists.</p>
            <div style={{ marginTop: 28 }}>
              <button type="button" onClick={signInWithGoogle} disabled={busy} style={{ ...wide, background: C.text, color: C.bg }}><G /> Continue with Google</button>
              <div className="flex items-center gap-3" style={{ color: C.textFaint, fontSize: 13, margin: '20px 0' }}><span style={{ flex: 1, height: 1, background: C.border }} />or use your email<span style={{ flex: 1, height: 1, background: C.border }} /></div>
              <form onSubmit={sendLink} noValidate>
                <label htmlFor="signin-email" className="sr-only" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Email</label>
                <input id="signin-email" type="email" required autoComplete="email" inputMode="email" value={email} onChange={e => { setEmail(e.target.value); setError(''); }} placeholder="Email address"
                  style={{ width: '100%', background: 'var(--field)', color: C.text, border: '1px solid var(--field-line)', borderRadius: 14, padding: '14px 16px', fontSize: 17, fontFamily: HEADING_FONT }} />
                <button type="submit" disabled={busy} style={{ ...wide, marginTop: 12, background: C.amberFill, color: C.onAmber, fontWeight: 600 }}>{busy ? 'Sending…' : 'Email me a sign-in link'}</button>
              </form>
              {error && <div role="alert" style={{ color: C.red, fontSize: 14, marginTop: 12, textAlign: 'center' }}>{error}</div>}
              <p style={{ color: C.textFaint, fontSize: 13, lineHeight: 1.5, marginTop: 18, textAlign: 'center' }}>Access is by invitation only. Sign in with the email IMSS Records invited; there’s no sign-up and no password.</p>
            </div>
          </>
        )}
      </main>
      <div style={{ width: '100%', maxWidth: 440, margin: '0 0 auto' }}><LegalFooter /></div>
    </div>
  );
}

// Email-link sign-in in front of the dashboard. Without Supabase configured it
// renders the dashboard straight away (local, single-browser mode).
import { useEffect, useState } from 'react';
import { Mail } from 'lucide-react';
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
  const [emailMode, setEmailMode] = useState(false);

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
  const btn = { minWidth: 280, borderRadius: 8, padding: '11px 22px', fontSize: 16, fontWeight: 500, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 };
  // Invite-only: people here already know why. Logo, a line, one button; email is the fallback.
  return (
    <div className="imss-gate" style={{ background: CANVAS_GRADIENT, fontFamily: HEADING_FONT, color: C.text, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 16px', overflowY: 'auto' }}>
      <style>{GLOBAL_STYLES}</style>
      <main style={{ width: '100%', maxWidth: 360, margin: 'auto 0', textAlign: 'center' }}>
        <img src={LOGO_DATA_URI} alt="IMSS Records" style={{ height: 76, width: 'auto', display: 'block', margin: '0 auto', filter: 'var(--logo-filter)' }} />
        <div style={{ height: 1, background: C.border, margin: '36px 0 44px' }} />
        {sent ? (
          <div role="status">
            <p style={{ fontSize: 17, lineHeight: 1.5 }}>Check <b>{email.trim()}</b> for your sign-in link.</p>
            <button type="button" onClick={() => { setSent(false); setError(''); }} style={{ color: C.textDim, fontSize: 14, marginTop: 16 }}>Use a different email</button>
          </div>
        ) : emailMode ? (
          <form onSubmit={sendLink} noValidate style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <input aria-label="Email" type="email" required autoFocus autoComplete="email" inputMode="email" value={email} onChange={e => { setEmail(e.target.value); setError(''); }} placeholder="Email address"
              style={{ ...btn, width: 280, background: 'var(--field)', color: C.text, border: '1px solid var(--field-line)', fontWeight: 400, textAlign: 'left', cursor: 'text', opacity: 1 }} />
            <button type="submit" disabled={busy} style={{ ...btn, width: 280, background: C.text, color: C.bg }}>{busy ? 'Sending…' : 'Email me a sign-in link'}</button>
            <button type="button" onClick={() => { setEmailMode(false); setError(''); }} style={{ color: C.textDim, fontSize: 14, marginTop: 6 }}>Back</button>
          </form>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <button type="button" onClick={signInWithGoogle} disabled={busy} style={{ ...btn, background: C.text, color: C.bg }}><G /> Sign in with Google</button>
            <button type="button" onClick={() => setEmailMode(true)} style={{ ...btn, background: 'transparent', color: C.text, border: '1px solid var(--hairline-strong)' }}><Mail size={18} aria-hidden="true" /> Sign in with email</button>
          </div>
        )}
        {error && <div role="alert" style={{ color: C.red, fontSize: 14, marginTop: 16 }}>{error}</div>}
      </main>
      {/* Kept: Google sign-in needs the privacy policy linked from the page. */}
      <nav aria-label="Legal" style={{ display: 'flex', gap: 18, fontSize: 12, color: C.textFaint }}>
        <a href="/privacy" style={{ color: 'inherit' }}>Privacy</a><a href="/terms" style={{ color: 'inherit' }}>Terms</a><span>© {new Date().getFullYear()} IMSS Records</span>
      </nav>
    </div>
  );
}

// Email-link sign-in in front of the dashboard. Without Supabase configured it
// renders the dashboard straight away (local, single-browser mode).
import { LegalFooter } from './Legal.jsx';
import { useEffect, useState } from 'react';
import { supabase } from './storage.js';
import { C, CANVAS_GRADIENT, GLOBAL_STYLES, HEADING_FONT, LOGO_DATA_URI } from './theme.js';
import { Btn, Field, Input } from './ui.jsx';

export default function AuthGate({ children }) {
  const [authEmail, setAuthEmail] = useState(null);
  // 'team', 'artist', or null (signed in but on neither list); undefined while checking.
  const [access, setAccess] = useState(undefined);
  const [checking, setChecking] = useState(!!supabase);
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

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
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    if (err) setError(err.message);
    else setSent(true);
  }

  return (
    <div style={{ background: CANVAS_GRADIENT, fontFamily: HEADING_FONT, color: C.text }} className="w-full rounded-lg border flex items-center justify-center imss-gate">
      <style>{GLOBAL_STYLES}</style>
      <div className="imss-glass-layer w-full" style={{ maxWidth: 380, padding: 24 }}>
        <div className="flex items-center gap-2 mb-1 justify-center">
          <img src={LOGO_DATA_URI} alt="IMSS Records" style={{ height: 34, width: 'auto' }} />
        </div>
        {sent ? (
          <div className="text-sm text-center" style={{ color: C.textDim }} role="status">
            Check <strong>{email.trim()}</strong> for a sign-in link. You can close this tab.
          </div>
        ) : (
          <div className="rounded border p-4" style={{ background: C.panel, borderColor: C.borderLight }}>
          <button type="button" onClick={signInWithGoogle} className="w-full inline-flex items-center justify-center gap-2" style={{ background: C.bg, color: C.text, border: '1px solid ' + C.border, borderRadius: 980, padding: '10px 16px', fontSize: 15, fontWeight: 500 }}>
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 7l7.2 5.6c4.2-3.9 7.1-9.6 7.1-17.1z"/><path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.2-5.6c-2 1.4-4.7 2.3-8.7 2.3-6.2 0-11.5-4.1-13.4-9.8l-7.9 6.1C6.6 42.6 14.6 48 24 48z"/></svg>
            Continue with Google
          </button>
          <div className="flex items-center gap-3 my-3" style={{ color: C.textDim, fontSize: 12 }}><span style={{ flex: 1, height: 1, background: C.border }} />or<span style={{ flex: 1, height: 1, background: C.border }} /></div>
          <form onSubmit={sendLink}>
            <Field label="Email">
              <Input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
            </Field>
            {error && <div className="text-xs mt-2" style={{ color: C.red }} role="alert">{error}</div>}
            <div className="mt-3"><Btn variant="primary" type="submit">Email me a sign-in link</Btn></div>
          </form>
          </div>
        )}
        <LegalFooter />
      </div>
    </div>
  );
}

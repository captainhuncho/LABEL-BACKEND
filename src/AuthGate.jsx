// Email-link sign-in in front of the dashboard. Without Supabase configured it
// renders the dashboard straight away (local, single-browser mode).
import { useEffect, useState } from 'react';
import { supabase } from './storage.js';
import { C, CANVAS_GRADIENT, GLOBAL_STYLES, HEADING_FONT, LOGO_DATA_URI } from './theme.js';
import { Btn, Field, Input } from './ui.jsx';

export default function AuthGate({ children }) {
  const [authEmail, setAuthEmail] = useState(null);
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

  if (!supabase) return children({ authEmail: null, signOut: null });
  if (checking) return null;
  if (authEmail) return children({ authEmail, signOut: () => supabase.auth.signOut() });

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
          <form onSubmit={sendLink} className="rounded border p-4" style={{ background: C.panel, borderColor: C.borderLight }}>
            <Field label="Work email">
              <Input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@imssrecords.co" />
            </Field>
            {error && <div className="text-xs mt-2" style={{ color: C.red }} role="alert">{error}</div>}
            <div className="mt-3"><Btn variant="primary" type="submit">Email me a sign-in link</Btn></div>
          </form>
        )}
      </div>
    </div>
  );
}

// The one loading screen from sign-in until the page is ready: the logo,
// centred, with "Loading…" under it. Every sign-in step shows this same screen,
// so nothing flashes blank. After 8 s on a slow connection it offers Retry.
import { useEffect, useState } from 'react';
import { C, GLOBAL_STYLES, LOGO_DATA_URI } from './theme.js';

const CSS = `
.imss-ld { position: fixed; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px; background: var(--bg); color: var(--text); }
.imss-ld-logo { height: 64px; width: auto; filter: var(--logo-filter); animation: imss-ld-in .5s ease-out both; }
.imss-ld-text { font-size: 15px; color: var(--text-2); animation: imss-ld-pulse 1.6s ease-in-out infinite; }
@keyframes imss-ld-in { from { opacity: 0; transform: scale(.97); } to { opacity: 1; transform: none; } }
@keyframes imss-ld-pulse { 0%, 100% { opacity: .55; } 50% { opacity: 1; } }
@media (max-width: 767px) { .imss-ld-logo { height: 40px; } .imss-ld { gap: 14px; } }
@media (prefers-reduced-motion: reduce) { .imss-ld-logo, .imss-ld-text { animation: none; } }
`;

// variant is accepted for the callers; every variant looks the same.
export default function LoadingScreen() {
  const [slow, setSlow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setSlow(true), 8000); return () => clearTimeout(t); }, []);
  return (
    <div className="imss-ld" role="status" aria-live="polite">
      <style>{GLOBAL_STYLES + CSS}</style>
      <img className="imss-ld-logo" src={LOGO_DATA_URI} alt="IMSS Records" />
      <div className="imss-ld-text">A Different Approach</div>
      <span className="sr-only">Loading</span>
      {slow && (
        <div className="text-sm" style={{ color: C.textDim }}>
          Still loading. Check your connection, or <button onClick={() => window.location.reload()} style={{ color: C.amber, fontWeight: 600 }}>retry</button>.
        </div>
      )}
    </div>
  );
}

// Spots a newer deploy and gets every open tab onto it, so nobody keeps
// working (or publishing money figures) on old code.
import { useEffect, useState } from 'react';
import { C } from './theme.js';

export const isStale = () => window.__imssStale === true;

export default function UpdateBanner() {
  const [stale, setStale] = useState(false);
  useEffect(() => {
    if (import.meta.env.DEV) return;
    let done = false;
    async function check() {
      if (done) return;
      try {
        const res = await fetch('/version.json', { cache: 'no-store' });
        const { id } = await res.json();
        if (id && id !== __BUILD_ID__) { done = true; window.__imssStale = true; setStale(true); }
      } catch (e) { /* offline: try again later */ }
    }
    // Coming back to the tab with a new version waiting: reload straight away.
    function onFocus() { if (window.__imssStale) window.location.reload(); else check(); }
    check();
    const timer = setInterval(check, 60000);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') onFocus(); });
    return () => { clearInterval(timer); window.removeEventListener('focus', onFocus); };
  }, []);
  if (!stale) return null;
  return (
    <div role="alert" style={{ position: 'fixed', left: 16, right: 16, bottom: 16, zIndex: 1000, background: C.panel, border: '1px solid ' + C.amber, borderRadius: 12, padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', color: C.text, fontSize: 14 }}>
      <span><b>A new version of IMSS Records is out.</b> Reload to keep working; saving is paused until you do.</span>
      <button onClick={() => window.location.reload()} style={{ background: C.amberFill, color: C.onAmber, fontWeight: 600, borderRadius: 980, padding: '8px 16px' }}>Reload now</button>
    </div>
  );
}

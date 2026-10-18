// The one loading screen from sign-in until the page is ready: a faint outline
// of the page that's coming (ops, artist portal or label rep view) with a thin
// progress line, so nothing flashes blank. After 8 s on a slow connection it
// says so and offers Retry.
import { useEffect, useState } from 'react';
import { C, GLOBAL_STYLES, LOGO_DATA_URI } from './theme.js';

const CSS = `
.imss-ld { position: fixed; inset: 0; display: flex; background: var(--bg); color: var(--text); overflow: hidden; z-index: 1; }
.imss-ld-bar { position: fixed; top: 0; left: 0; height: 3px; width: 40%; background: var(--amber-fill, #E7A23D); border-radius: 0 3px 3px 0; animation: imss-ld-bar 1.4s ease-in-out infinite; z-index: 2; }
@keyframes imss-ld-bar { 0% { transform: translateX(-100%); } 100% { transform: translateX(260%); } }
.imss-ld-side { width: 248px; flex: 0 0 248px; padding: 22px 16px; border-right: 1px solid var(--hairline); display: flex; flex-direction: column; gap: 10px; }
.imss-ld-main { flex: 1; min-width: 0; padding: 28px 32px; display: flex; flex-direction: column; gap: 18px; max-width: 1280px; }
.imss-ld-b { background: var(--fill, rgba(120,120,128,.12)); border-radius: 10px; position: relative; overflow: hidden; }
.imss-ld-b::after { content: ''; position: absolute; inset: 0; transform: translateX(-100%); background: linear-gradient(90deg, transparent, rgba(255,255,255,.35), transparent); animation: imss-ld-shine 1.6s ease-in-out infinite; }
@keyframes imss-ld-shine { to { transform: translateX(100%); } }
.imss-ld-row { display: flex; gap: 14px; }
.imss-ld-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
.imss-ld-tabs { display: none; }
.imss-ld-phone-logo { display: none; }
.imss-ld-slow { position: fixed; left: 50%; bottom: 32px; transform: translateX(-50%); z-index: 3; display: flex; align-items: center; gap: 12px; padding: 10px 16px; border-radius: 980px; background: var(--panel); box-shadow: 0 2px 16px rgba(0,0,0,.14); font-size: 14px; white-space: nowrap; }
@media (max-width: 767px) {
  .imss-ld-side { display: none; }
  .imss-ld-phone-logo { display: block; }
  .imss-ld-main { padding: 18px 16px 90px; }
  .imss-ld-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .imss-ld-tabs { display: flex; position: fixed; left: 0; right: 0; bottom: 0; height: 64px; border-top: 1px solid var(--hairline); background: var(--panel); justify-content: space-around; align-items: center; }
}
@media (prefers-reduced-motion: reduce) { .imss-ld-bar, .imss-ld-b::after { animation: none; } }
`;

const B = ({ w = '100%', h = 14, r = 10, style }) => <div className="imss-ld-b" style={{ width: w, height: h, borderRadius: r, ...style }} />;

function Side({ variant }) {
  return (
    <aside className="imss-ld-side">
      <img src={LOGO_DATA_URI} alt="" style={{ height: 30, width: 'auto', alignSelf: 'flex-start', marginBottom: 14, opacity: 0.9, filter: 'var(--logo-filter)' }} />
      {variant === 'artist' && <div className="imss-ld-row" style={{ alignItems: 'center', marginBottom: 8 }}><B w={40} h={40} r={20} /><div style={{ flex: 1 }}><B w="70%" h={12} /><B w="45%" h={10} style={{ marginTop: 6 }} /></div></div>}
      {Array.from({ length: variant === 'artist' ? 10 : 14 }, (_, i) => <B key={i} w={i % 5 === 0 && variant === 'ops' ? '40%' : `${62 + ((i * 13) % 30)}%`} h={i % 5 === 0 && variant === 'ops' ? 9 : 14} style={{ marginTop: i % 5 === 0 && variant === 'ops' && i ? 10 : 0 }} />)}
    </aside>
  );
}

function Main({ variant }) {
  if (variant === 'rep') return (
    <main className="imss-ld-main">
      <img src={LOGO_DATA_URI} alt="" style={{ height: 30, width: 'auto', alignSelf: 'flex-start', opacity: 0.9, filter: 'var(--logo-filter)' }} />
      <B w={260} h={30} />
      <B w="55%" h={12} />
      <div className="imss-ld-b" style={{ height: 380, borderRadius: 14 }} />
    </main>
  );
  const logo = <img className="imss-ld-phone-logo" src={LOGO_DATA_URI} alt="" style={{ height: 26, width: 'auto', opacity: 0.9, filter: 'var(--logo-filter)' }} />;
  if (variant === 'artist') return (
    <main className="imss-ld-main">
      {logo}
      <B w={200} h={32} />
      <B w="70%" h={12} />
      <div className="imss-ld-b" style={{ height: 230, borderRadius: 18 }} />
      <div className="imss-ld-grid"><B h={96} r={14} /><B h={96} r={14} /><B h={96} r={14} /><B h={96} r={14} /></div>
      <div className="imss-ld-b" style={{ height: 220, borderRadius: 14 }} />
    </main>
  );
  return (
    <main className="imss-ld-main">
      {logo}
      <div className="imss-ld-row" style={{ alignItems: 'center' }}><B w={320} h={38} r={19} /><div style={{ flex: 1 }} /><B w={38} h={38} r={19} /><B w={38} h={38} r={19} /></div>
      <B w={240} h={32} />
      <B w="60%" h={12} />
      <div className="imss-ld-grid"><B h={104} r={14} /><B h={104} r={14} /><B h={104} r={14} /><B h={104} r={14} /></div>
      <div className="imss-ld-b" style={{ height: 300, borderRadius: 14 }} />
    </main>
  );
}

// variant: 'ops' (default), 'artist' or 'rep'.
export default function LoadingScreen({ variant = 'ops' }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setSlow(true), 8000); return () => clearTimeout(t); }, []);
  return (
    <div className="imss-ld" role="status" aria-live="polite" aria-label="Loading">
      <style>{GLOBAL_STYLES + CSS}</style>
      <div className="imss-ld-bar" />
      {variant !== 'rep' && <Side variant={variant} />}
      <Main variant={variant} />
      {variant !== 'rep' && <nav className="imss-ld-tabs" aria-hidden="true">{[0, 1, 2, 3, 4].map(i => <B key={i} w={36} h={24} r={8} />)}</nav>}
      {slow && (
        <div className="imss-ld-slow">
          <span style={{ color: C.textDim }}>Still loading… check your connection.</span>
          <button onClick={() => window.location.reload()} style={{ color: C.amber, fontWeight: 600 }}>Retry</button>
        </div>
      )}
    </div>
  );
}

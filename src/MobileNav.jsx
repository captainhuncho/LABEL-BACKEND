// Phones: a bottom tab bar (four main pages for this person + More) and a
// More sheet with search and every other page in its sidebar group.
// Desktop keeps the sidebar; this renders nothing above 767px (CSS).
import { useEffect, useRef, useState } from 'react';
import { MoreHorizontal, Search, X } from 'lucide-react';
import { C } from './theme.js';

// The four tabs per role, in order; pages the person can't open are skipped
// and the fallback list fills the gaps.
const PRIMARY = {
  Admin: ['overview', 'invoices', 'payouts', 'tasks'],
  Legal: ['deals', 'roster', 'tasks', 'activity'],
  Finance: ['mastergross', 'revenue', 'payouts', 'invoices'],
  'Product Manager': ['roster', 'artist-requests', 'tasks', 'invoices'],
  'A&R': ['roster', 'submissions', 'catalog', 'calendar'],
  'Label Manager': ['roster', 'submissions', 'catalog', 'calendar'],
  Marketing: ['catalog', 'submissions', 'calendar', 'notices'],
  artist: ['overview', 'revenue', 'statements', 'invoices'],
};
const FALLBACK = ['overview', 'tasks', 'roster', 'invoices', 'notices', 'calendar', 'streams'];

export function primaryTabs(nav, role) {
  if (nav.length <= 5) return nav;
  const ids = new Set(nav.map(n => n.id));
  const pick = [];
  for (const id of [...(PRIMARY[role] || []), ...FALLBACK, ...nav.map(n => n.id)]) {
    if (ids.has(id) && !pick.includes(id)) pick.push(id);
    if (pick.length === 4) break;
  }
  return pick.map(id => nav.find(n => n.id === id));
}

function Badge({ n }) {
  if (!n) return null;
  return <span aria-label={n + ' need attention'} style={{ position: 'absolute', top: -6, left: 14, background: C.amberFill, color: C.onAmber, borderRadius: 9999, fontSize: 11, fontWeight: 700, minWidth: 18, height: 18, padding: '0 5px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{n > 99 ? '99+' : n}</span>;
}

export function MobileNav({ nav, active, setActive, role, badges = {}, account = [] }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const sheetRef = useRef(null);
  const moreRef = useRef(null);
  const tabs = primaryTabs(nav, role);
  const rest = nav.filter(n => !tabs.includes(n));
  const hasMore = rest.length > 0 || account.length > 0;
  const activeInMore = !tabs.some(t => t.id === active);
  const moreBadge = rest.reduce((s, n) => s + (badges[n.id] || 0), 0);

  useEffect(() => {
    if (!open) return;
    const key = e => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', key);
    if (sheetRef.current) sheetRef.current.focus();
    return () => document.removeEventListener('keydown', key);
  }, [open]);
  function close() { setOpen(false); setQ(''); if (moreRef.current) moreRef.current.focus(); }
  function go(id) { setActive(id); setOpen(false); setQ(''); }

  const term = q.trim().toLowerCase();
  const shown = term ? nav.filter(n => n.label.toLowerCase().includes(term) || (n.group || '').toLowerCase().includes(term)) : rest;
  const groups = [];
  shown.forEach(n => { const g = term ? 'Results' : (n.group || 'Pages'); let grp = groups.find(x => x.name === g); if (!grp) groups.push(grp = { name: g, items: [] }); grp.items.push(n); });

  const tabBtn = (isActive) => ({ flex: 1, minWidth: 0, minHeight: 50, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, fontSize: 11, fontWeight: isActive ? 600 : 500, color: isActive ? C.amber : C.textDim });
  return (
    <>
      <nav aria-label="Primary" className="imss-bottombar">
        {tabs.map(t => {
          const Icon = t.icon, isActive = active === t.id;
          return (
            <button key={t.id} onClick={() => go(t.id)} aria-current={isActive ? 'page' : undefined} style={tabBtn(isActive)}>
              <span style={{ position: 'relative', display: 'inline-flex' }}><Icon size={22} strokeWidth={isActive ? 2.2 : 1.8} /><Badge n={badges[t.id]} /></span>
              <span style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 2px' }}>{t.label}</span>
            </button>
          );
        })}
        {hasMore && (
          <button ref={moreRef} onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open} aria-current={activeInMore ? 'page' : undefined} style={tabBtn(activeInMore || open)}>
            <span style={{ position: 'relative', display: 'inline-flex' }}><MoreHorizontal size={22} /><Badge n={moreBadge} /></span>
            <span>More</span>
          </button>
        )}
      </nav>

      {open && (
        <div className="imss-sheet-scrim" onClick={close}>
          <div ref={sheetRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="All pages" className="imss-sheet" onClick={e => e.stopPropagation()}>
            <div style={{ width: 36, height: 5, borderRadius: 3, background: C.borderStrong || 'var(--hairline-strong)', margin: '8px auto 6px' }} aria-hidden="true" />
            <div className="flex items-center gap-2" style={{ padding: '4px 16px 10px' }}>
              <label className="flex items-center gap-2" style={{ flex: 1, background: 'var(--fill)', borderRadius: 12, padding: '0 12px', minHeight: 44 }}>
                <Search size={16} color={C.textDim} aria-hidden="true" />
                <input value={q} onChange={e => setQ(e.target.value)} placeholder="Find a page" aria-label="Find a page" style={{ flex: 1, background: 'transparent', border: 0, outline: 'none', color: C.text, minHeight: 0 }} />
              </label>
              <button onClick={close} aria-label="Close" style={{ color: C.textDim, width: 44, height: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><X size={20} /></button>
            </div>
            <div className="imss-sheet-list">
              {groups.length === 0 && <p style={{ color: C.textDim, padding: '12px 20px' }}>No page called “{q}”.</p>}
              {groups.map(g => (
                <section key={g.name} aria-label={g.name}>
                  <h3 style={{ color: C.textDim, fontSize: 13, fontWeight: 600, padding: '12px 20px 6px' }}>{g.name}</h3>
                  <ul className="imss-sheet-group">
                    {g.items.map(n => {
                      const Icon = n.icon, isActive = active === n.id;
                      return (
                        <li key={n.id}>
                          <button onClick={() => go(n.id)} aria-current={isActive ? 'page' : undefined} className="imss-sheet-row" style={{ color: isActive ? C.amber : C.text, background: isActive ? C.amberSoft : 'transparent', fontWeight: isActive ? 600 : 400 }}>
                            <Icon size={19} aria-hidden="true" style={{ color: isActive ? C.amber : C.textDim }} />
                            <span style={{ flex: 1, textAlign: 'left' }}>{n.label}</span>
                            {badges[n.id] > 0 && <span style={{ color: C.amber, fontSize: 13, fontWeight: 600 }}>{badges[n.id]}</span>}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
              {!term && account.length > 0 && (
                <section aria-label="Account">
                  <h3 style={{ color: C.textDim, fontSize: 13, fontWeight: 600, padding: '12px 20px 6px' }}>Account</h3>
                  <ul className="imss-sheet-group">
                    {account.map(a => {
                      const Icon = a.icon;
                      return <li key={a.label}><button onClick={() => { setOpen(false); a.onClick(); }} className="imss-sheet-row" style={{ color: a.danger ? C.red : C.text }}><Icon size={19} aria-hidden="true" style={{ color: a.danger ? C.red : C.textDim }} /><span style={{ flex: 1, textAlign: 'left' }}>{a.label}</span></button></li>;
                    })}
                  </ul>
                </section>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

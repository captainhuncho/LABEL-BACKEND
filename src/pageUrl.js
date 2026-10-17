// Each page has its own address (ops.imssrecords.com/payouts,
// artist.imssrecords.com/royalties), named after the page. Changing page adds a
// history step, so the browser's back button and swipe-back move between pages.
import { useEffect, useRef } from 'react';

export const pageSlug = label => String(label).toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export function usePageUrl(pages, active, setActive) {
  const first = useRef(true);
  const bySlug = slug => pages.find(p => pageSlug(p.label) === slug);
  const current = () => decodeURIComponent(window.location.pathname.replace(/^\/+|\/+$/g, ''));

  // Opening an address goes to that page.
  useEffect(() => {
    const p = bySlug(current());
    if (p && p.id !== active) setActive(p.id);
    const back = () => { const q = bySlug(current()); if (q) setActive(q.id); };
    window.addEventListener('popstate', back);
    return () => window.removeEventListener('popstate', back);
    // eslint-disable-next-line
  }, [pages.map(p => p.id).join()]);

  // The address follows the page (and drops any leftover # from sign-in).
  useEffect(() => {
    const p = pages.find(x => x.id === active);
    if (!p) return;
    const path = '/' + pageSlug(p.label) + window.location.search;
    if (window.location.pathname + window.location.search === path && !window.location.hash) { first.current = false; return; }
    const keep = first.current || !bySlug(current()); // the first fix-up and unknown addresses don't add a back step
    window.history[keep ? 'replaceState' : 'pushState'](null, '', path);
    first.current = false;
    // eslint-disable-next-line
  }, [active, pages.length]);
}

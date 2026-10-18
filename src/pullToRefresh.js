// Pull down from the top of the page to reload (phones and tablets).
// The app scrolls inside .imss-content, so the browser's own pull-to-refresh
// never fires; this adds it back for every screen, ops and artist portal.
const TRIGGER = 70; // px of pull before release reloads

export function installPullToRefresh() {
  let startY = null, box = null, pull = 0;
  const pill = document.createElement('div');
  pill.setAttribute('aria-hidden', 'true');
  pill.style.cssText = 'position:fixed;top:0;left:50%;z-index:9999;transform:translate(-50%,-48px);padding:8px 14px;border-radius:980px;background:var(--panel,#fff);color:var(--text,#1d1d1f);box-shadow:0 2px 12px rgba(0,0,0,.18);font:600 13px -apple-system,system-ui,sans-serif;pointer-events:none;transition:transform .2s';
  document.body.appendChild(pill);
  const show = y => { pill.style.transition = 'none'; pill.style.transform = `translate(-50%,${Math.min(y, TRIGGER + 20) - 40}px)`; };
  const hide = () => { pill.style.transition = 'transform .2s'; pill.style.transform = 'translate(-50%,-48px)'; };

  document.addEventListener('touchstart', e => {
    box = e.target.closest && e.target.closest('.imss-content');
    // Only from the very top, and not inside a sheet, dialog or a field being edited.
    const busy = e.target.closest && e.target.closest('input, textarea, select, [role="dialog"], .imss-sheet-list');
    startY = box && box.scrollTop <= 0 && !busy && e.touches.length === 1 ? e.touches[0].clientY : null;
    pull = 0;
  }, { passive: true });

  document.addEventListener('touchmove', e => {
    if (startY === null) return;
    if (box.scrollTop > 0) { startY = null; hide(); return; }
    pull = (e.touches[0].clientY - startY) * 0.5;
    if (pull <= 0) { hide(); return; }
    pill.textContent = pull >= TRIGGER ? 'Release to refresh' : 'Pull to refresh';
    show(pull);
  }, { passive: true });

  document.addEventListener('touchend', () => {
    if (startY !== null && pull >= TRIGGER) {
      pill.textContent = 'Refreshing…';
      window.location.reload();
    } else hide();
    startY = null; pull = 0;
  }, { passive: true });

  // Desktop: keep scrolling up (trackpad or wheel) past the top. A gesture
  // only counts if it starts at the top, so scrolling up to the top never reloads.
  let wheel = 0, atTopAtStart = false, endTimer = null;
  document.addEventListener('wheel', e => {
    const b = e.target.closest && e.target.closest('.imss-content');
    if (!b || (e.target.closest && e.target.closest('[role="dialog"], .imss-sheet-list'))) return;
    if (endTimer === null) { atTopAtStart = b.scrollTop <= 0; wheel = 0; }
    clearTimeout(endTimer);
    endTimer = setTimeout(() => {
      endTimer = null;
      if (wheel >= TRIGGER) { pill.textContent = 'Refreshing…'; window.location.reload(); } else hide();
      wheel = 0;
    }, 250);
    if (!atTopAtStart || b.scrollTop > 0 || e.deltaY >= 0) { if (e.deltaY > 0) { wheel = 0; hide(); } return; }
    wheel += -e.deltaY * 0.25;
    pill.textContent = wheel >= TRIGGER ? 'Let go to refresh' : 'Keep scrolling up to refresh';
    show(wheel);
  }, { passive: true });
}

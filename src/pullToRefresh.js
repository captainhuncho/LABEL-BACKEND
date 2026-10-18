// Pull down from the top of the page to reload (phones and tablets).
// The app scrolls inside .imss-content, so the browser's own pull-to-refresh
// never fires; this adds it back for every screen, ops and artist portal.
// It must feel like a deliberate pull, not a scroll that happens to reach the top:
// the page has to be resting at the top before the gesture starts, the pull is
// heavy (resists), straight down, and only shows after a small dead zone.
const TRIGGER = 90;      // px of (resisted) pull before release reloads
const DEAD_ZONE = 24;    // px of pull before anything shows
const SETTLE_MS = 500;   // the page must have been still at the top this long
const RESIST = 0.35;     // finger travel → pull distance

export function installPullToRefresh() {
  let startY = null, startX = 0, box = null, pull = 0;
  let lastScroll = 0;
  document.addEventListener('scroll', () => { lastScroll = Date.now(); }, { capture: true, passive: true });
  const settledAtTop = b => b.scrollTop <= 0 && Date.now() - lastScroll > SETTLE_MS;

  const pill = document.createElement('div');
  pill.setAttribute('aria-hidden', 'true');
  pill.style.cssText = 'position:fixed;top:0;left:50%;z-index:9999;transform:translate(-50%,-48px);padding:8px 14px;border-radius:980px;background:var(--panel,#fff);color:var(--text,#1d1d1f);box-shadow:0 2px 12px rgba(0,0,0,.18);font:600 13px -apple-system,system-ui,sans-serif;pointer-events:none;transition:transform .2s';
  document.body.appendChild(pill);
  const show = y => { pill.style.transition = 'none'; pill.style.transform = `translate(-50%,${Math.min(y, TRIGGER + 20) - 50}px)`; };
  const hide = () => { pill.style.transition = 'transform .2s'; pill.style.transform = 'translate(-50%,-48px)'; };

  document.addEventListener('touchstart', e => {
    box = e.target.closest && e.target.closest('.imss-content');
    // Only from the very top, and not inside a sheet, dialog or a field being edited.
    const busy = e.target.closest && e.target.closest('input, textarea, select, [role="dialog"], .imss-sheet-list');
    startY = box && settledAtTop(box) && !busy && e.touches.length === 1 ? e.touches[0].clientY : null;
    startX = startY === null ? 0 : e.touches[0].clientX;
    pull = 0;
  }, { passive: true });

  document.addEventListener('touchmove', e => {
    if (startY === null) return;
    const dy = e.touches[0].clientY - startY, dx = Math.abs(e.touches[0].clientX - startX);
    // A sideways swipe or any scroll cancels it.
    if (box.scrollTop > 0 || dx > Math.max(30, dy * 0.6)) { startY = null; hide(); return; }
    pull = dy * RESIST;
    if (pull < DEAD_ZONE) { hide(); return; }
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

  // Desktop mouse: press on the page (not a control or text field), drag down,
  // let go. Only the release refreshes; dragging back up before letting go cancels.
  let mStartY = null, mBox = null, mPull = 0;
  document.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    const b = e.target.closest && e.target.closest('.imss-content');
    const busy = e.target.closest && e.target.closest('input, textarea, select, button, a, label, [contenteditable], [role="dialog"], .imss-sheet-list, table');
    mStartY = b && !busy && settledAtTop(b) ? e.clientY : null; mBox = b; mPull = 0;
  });
  document.addEventListener('pointermove', e => {
    if (mStartY === null || e.pointerType !== 'mouse') return;
    if (mBox.scrollTop > 0) { mStartY = null; hide(); return; }
    mPull = (e.clientY - mStartY) * RESIST * 1.4;
    if (mPull < DEAD_ZONE) { hide(); return; }
    window.getSelection && window.getSelection().removeAllRanges(); // a pull, not a text selection
    pill.textContent = mPull >= TRIGGER ? 'Release to refresh' : 'Pull to refresh';
    show(mPull);
  });
  const mouseUp = () => {
    if (mStartY !== null && mPull >= TRIGGER) { pill.textContent = 'Refreshing…'; window.location.reload(); } else hide();
    mStartY = null; mPull = 0;
  };
  document.addEventListener('pointerup', mouseUp);
  document.addEventListener('pointercancel', () => { mStartY = null; mPull = 0; hide(); });

  // Desktop: keep scrolling up (trackpad or wheel) past the top. A gesture only
  // counts if the page was already resting at the top when it began, so
  // scrolling up to the top never reloads.
  let wheel = 0, atTopAtStart = false, endTimer = null;
  document.addEventListener('wheel', e => {
    const b = e.target.closest && e.target.closest('.imss-content');
    if (!b || (e.target.closest && e.target.closest('[role="dialog"], .imss-sheet-list'))) return;
    if (endTimer === null) { atTopAtStart = settledAtTop(b); wheel = 0; }
    clearTimeout(endTimer);
    endTimer = setTimeout(() => {
      endTimer = null;
      if (wheel >= TRIGGER) { pill.textContent = 'Refreshing…'; window.location.reload(); } else hide();
      wheel = 0;
    }, 250);
    if (!atTopAtStart || b.scrollTop > 0 || e.deltaY >= 0) { if (e.deltaY > 0) { wheel = 0; hide(); } return; }
    wheel += -e.deltaY * 0.12;
    if (wheel < DEAD_ZONE) return;
    // Trackpad: lifting the fingers (the gesture ending) is the release.
    pill.textContent = wheel >= TRIGGER ? 'Release to refresh' : 'Pull to refresh';
    show(wheel);
  }, { passive: true });
}

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
  let mStartY = null, mBox = null, mPull = 0, wBox = null;
  let lastScroll = 0;
  document.addEventListener('scroll', () => { lastScroll = Date.now(); }, { capture: true, passive: true });
  const settledAtTop = b => b.scrollTop <= 0 && Date.now() - lastScroll > SETTLE_MS;

  // iPhone-style: the page itself stretches down as you pull, a ring above it
  // fills up, and the page springs back when you let go (or stays put and the
  // ring spins while it refreshes).
  const ring = document.createElement('div');
  ring.setAttribute('aria-hidden', 'true');
  ring.style.cssText = 'position:fixed;z-index:9999;width:30px;height:30px;margin-left:-15px;pointer-events:none;opacity:0;transition:opacity .2s';
  ring.innerHTML = '<svg viewBox="0 0 30 30" width="30" height="30" style="display:block"><circle cx="15" cy="15" r="11" fill="none" stroke="var(--hairline,#d2d2d7)" stroke-width="3"/><circle class="p" cx="15" cy="15" r="11" fill="none" stroke="var(--amber-fill,#E7A23D)" stroke-width="3" stroke-linecap="round" stroke-dasharray="69.1" stroke-dashoffset="69.1" transform="rotate(-90 15 15)"/><path class="a" d="M15 9v11m-4-4 4 4 4-4" fill="none" stroke="var(--text-2,#68686d)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="transform-origin:15px 15px;transition:transform .2s"/></svg>';
  document.body.appendChild(ring);
  const prog = ring.querySelector('.p'), arrow = ring.querySelector('.a');
  if (!document.getElementById('imss-ptr-style')) {
    const st = document.createElement('style'); st.id = 'imss-ptr-style';
    st.textContent = '@keyframes imss-ptr-spin{to{transform:rotate(360deg)}} @media (prefers-reduced-motion: reduce){.imss-ptr-spring{transition:none!important}}';
    document.head.appendChild(st);
  }
  let pulled = null; // the content element currently stretched
  const contentOf = b => (b && b.firstElementChild) || b;
  const show = (y, b = box || mBox || wBox) => {
    if (!b) return;
    const el = contentOf(b); pulled = el;
    el.style.transition = 'none'; el.style.translate = `0 ${y}px`; // translate, not transform: the page's entrance animation owns transform
    const r = b.getBoundingClientRect();
    ring.style.left = (r.left + r.width / 2) + 'px'; ring.style.top = (r.top + Math.max(6, y / 2 - 15)) + 'px';
    ring.style.opacity = y >= DEAD_ZONE ? '1' : '0'; ring.style.animation = '';
    const p = Math.min(1, y / TRIGGER);
    prog.setAttribute('stroke-dashoffset', String(69.1 * (1 - p)));
    arrow.style.transform = p >= 1 ? 'rotate(180deg)' : 'rotate(0deg)';
  };
  const springBack = () => {
    if (pulled) { pulled.classList.add('imss-ptr-spring'); pulled.style.transition = 'translate .35s cubic-bezier(.2,.9,.3,1.2)'; pulled.style.translate = ''; }
    ring.style.opacity = '0';
  };
  const refreshing = () => {
    if (pulled) { pulled.style.transition = 'translate .25s ease-out'; pulled.style.translate = '0 56px'; }
    arrow.style.opacity = '0'; prog.setAttribute('stroke-dashoffset', '17');
    ring.style.animation = 'imss-ptr-spin .8s linear infinite';
    window.location.reload();
  };

  // Trackpad only: a small Refresh button, since fingers lifting can't be seen.
  const pill = document.createElement('button');
  pill.type = 'button'; pill.textContent = 'Refresh';
  pill.style.cssText = 'position:fixed;top:0;left:50%;z-index:9999;transform:translate(-50%,-56px);padding:8px 16px;border-radius:980px;border:0;background:var(--amber-fill,#E7A23D);color:var(--on-amber,#1d1d1f);box-shadow:0 2px 12px rgba(0,0,0,.18);font:600 14px -apple-system,system-ui,sans-serif;cursor:pointer;transition:transform .25s';
  pill.tabIndex = -1;
  pill.onclick = () => refreshing();
  document.body.appendChild(pill);
  let offerTimer = null;
  const hide = () => { clearTimeout(offerTimer); springBack(); pill.style.transform = 'translate(-50%,-56px)'; };
  const offerButton = () => {
    springBack();
    pill.style.transform = 'translate(-50%,16px)';
    clearTimeout(offerTimer); offerTimer = setTimeout(() => { pill.style.transform = 'translate(-50%,-56px)'; }, 4000);
  };

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
    if (pull < DEAD_ZONE) { if (pulled) show(0, box); return; }
    show(pull, box);
  }, { passive: true });

  document.addEventListener('touchend', () => {
    if (startY !== null && pull >= TRIGGER) refreshing(); else if (startY !== null) hide();
    startY = null; pull = 0;
  }, { passive: true });

  // Desktop mouse: press on the page (not a control or text field), drag down,
  // let go. Only the release refreshes; dragging back up before letting go cancels.
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
    if (mPull < DEAD_ZONE) { if (pulled) show(0, mBox); return; }
    window.getSelection && window.getSelection().removeAllRanges(); // a pull, not a text selection
    show(mPull, mBox);
  });
  const mouseUp = () => {
    if (mStartY !== null && mPull >= TRIGGER) refreshing(); else if (mStartY !== null) hide();
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
    // Never while a drop-down, field or list is in use: scrolling up an open
    // select's list must scroll the list, not pull the page.
    const ae = document.activeElement;
    const inControl = (e.target.closest && e.target.closest('select, input, textarea, [role="listbox"], [role="dialog"], .imss-sheet-list'))
      || (ae && /^(SELECT|INPUT|TEXTAREA)$/.test(ae.tagName));
    if (!b || inControl) return;
    if (endTimer === null) { atTopAtStart = settledAtTop(b); wheel = 0; wBox = b; }
    clearTimeout(endTimer);
    // A browser can't see fingers lift off a trackpad (a still finger looks the
    // same), so the pull only arms it: the pill becomes a Refresh button to click.
    endTimer = setTimeout(() => {
      endTimer = null;
      if (wheel >= TRIGGER) offerButton(); else hide();
      wheel = 0;
    }, 250);
    if (!atTopAtStart || b.scrollTop > 0 || e.deltaY >= 0) { if (e.deltaY > 0 && wheel > 0) { wheel = 0; hide(); } return; }
    wheel += -e.deltaY * 0.12;
    if (wheel < DEAD_ZONE) return;
    show(Math.min(wheel, TRIGGER + 30), b);
  }, { passive: true });
}

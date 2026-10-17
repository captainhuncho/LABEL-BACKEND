// Phones: tables wider than the screen get class .imss-stack (cards, see
// GLOBAL_STYLES) and each cell a data-label from its column header.
const PHONE = '(max-width: 767px)';

function label(table) {
  // A header that is only screen-reader text ("Actions") labels nothing on a card.
  const heads = [...table.querySelectorAll('thead th')].map(th => { const t = th.innerText.trim(), sr = th.querySelector('.sr-only'); return sr && sr.innerText.trim() === t ? '' : t; });
  for (const tr of table.querySelectorAll('tbody tr, tfoot tr')) {
    let col = 0;
    for (const td of tr.children) {
      if (td.getAttribute('data-label') !== (heads[col] || '')) td.setAttribute('data-label', heads[col] || '');
      col += td.colSpan || 1;
    }
  }
}

function check() {
  if (!window.matchMedia(PHONE).matches) return;
  for (const table of document.querySelectorAll('.imss-content table, .imss-portal table')) {
    if (table.classList.contains('imss-keep-table')) continue;
    const box = table.parentElement;
    if (!table.classList.contains('imss-stack') && table.scrollWidth > box.clientWidth + 2) {
      table.classList.add('imss-stack');
      // The bordered, scrolling wrapper would frame cards in a card.
      if (box.querySelectorAll(':scope > table').length === 1 && box.children.length === 1) box.classList.add('imss-stack-wrap');
    }
    if (table.classList.contains('imss-stack')) label(table);
  }
}

export function stackWideTables() {
  let queued = false;
  const run = () => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; check(); }); };
  new MutationObserver(run).observe(document.body, { childList: true, subtree: true, characterData: true });
  window.addEventListener('resize', run);
  run();
}

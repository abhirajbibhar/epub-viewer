import { h } from './dom';
import { S, doc, initDocs, setRenderer, update } from './state';
import { TOOLS } from './annotations';
import { mainToolbar, secondaryToolbar } from './components/toolbar';
import { leftSidebar, rightSidebar } from './components/sidebars';
import { drawerLayer, normalizePanels, syncDrawer } from './components/drawer';
import { menuSheetLayer, syncMenuSheet } from './components/menuSheet';
import { isMobileWidth, useDrawerMode, useSheetMode } from './config';
import { enforceFeatures } from './enforce';
import { fitZoomFor, setZoom } from './commands';
import { viewport } from './components/viewport';
import { setupTooltips } from './components/tooltip';
import { onChange, onClick, onInput, onKeydown } from './actions';
import { flashControls, setupInteractions, syncPageUI } from './interactions';

const target = document.getElementById('pdf-viewer')!;
const root = h('div', { class: 'ep-root' });
target.appendChild(root);

function render(): void {
  // ── capture transient UI state ──
  const scrolls: Record<string, { l: number; t: number; w: number; h: number }> = {};
  root.querySelectorAll<HTMLElement>('[data-scroll]').forEach((el) => {
    scrolls[el.getAttribute('data-scroll')!] = { l: el.scrollLeft, t: el.scrollTop, w: el.scrollWidth, h: el.scrollHeight };
  });
  const ae = document.activeElement as HTMLInputElement | null;
  const focusKey = ae && root.contains(ae) ? ae.getAttribute?.('data-focus') : null;
  const sel = focusKey ? { s: ae!.selectionStart, e: ae!.selectionEnd } : null;

  // ── build ──
  const d = doc();
  enforceFeatures();
  const mobile = useDrawerMode();
  normalizePanels(mobile);
  const classes = ['ep-root'];
  if (isMobileWidth()) classes.push('is-mobile');
  if (S.pointerTool === 'pan') classes.push('tool-pan');
  if (S.pointerTool === 'marquee') classes.push('tool-marquee');
  if (S.tool && TOOLS[S.tool]) classes.push('tool-draw');
  root.className = classes.join(' ');

  const content = h('div', { class: 'ep-content' },
    d && !mobile && S.leftOpen ? leftSidebar(d) : null,
    h('div', { class: 'ep-main' }, d ? viewport() : null),
    d && !mobile && S.right ? rightSidebar(d) : null);

  const parts: (Node | null)[] = [d ? mainToolbar() : null, d ? secondaryToolbar() : null, content];
  // The mobile drawer shell must survive re-renders (otherwise its slide transition never runs),
  // so replace everything except the drawer and menu-sheet layers.
  Array.from(root.children).forEach((c) => { if (c !== drawerLayer && c !== menuSheetLayer) c.remove(); });
  const anchor = drawerLayer.parentNode === root ? drawerLayer : null;
  parts.forEach((n) => { if (n) root.insertBefore(n, anchor); });
  if (!anchor) root.append(drawerLayer, menuSheetLayer);
  syncDrawer(d, mobile);
  syncMenuSheet(useSheetMode());

  // ── restore ──
  const pending = S.pending;
  S.pending = null;
  root.querySelectorAll<HTMLElement>('[data-scroll]').forEach((el) => {
    const key = el.getAttribute('data-scroll')!;
    const prev = scrolls[key];
    if (!prev) return;
    if (key === 'viewport' && pending?.ratio) {
      el.scrollLeft = (prev.l / prev.w) * el.scrollWidth + (el.clientWidth ? 0 : 0);
      el.scrollTop = (prev.t / prev.h) * el.scrollHeight;
    } else { el.scrollLeft = prev.l; el.scrollTop = prev.t; }
  });

  const vp = root.querySelector('.ep-viewport') as HTMLElement | null;
  if (vp && pending) {
    if (pending.page !== undefined) {
      const box = vp.querySelector(`[data-page-box="${pending.page}"]`) as HTMLElement | null;
      if (box) {
        const vr = vp.getBoundingClientRect(), br = box.getBoundingClientRect();
        if (S.layout === 'horizontal') vp.scrollLeft += br.left - vr.left - 24;
        else vp.scrollTop += br.top - vr.top - 16;
      }
      flashControls();
    }
    if (pending.left !== undefined) vp.scrollLeft = pending.left;
    if (pending.top !== undefined) vp.scrollTop = pending.top;
  }
  if (S.scrollHit) {
    S.scrollHit = false;
    (root.querySelector('.ep-mark.is-active') as HTMLElement | null)?.scrollIntoView({ block: 'center', inline: 'center' });
  }

  const wanted = S.focusKey ?? focusKey;
  if (wanted) {
    const el = root.querySelector(`[data-focus="${wanted}"]`) as HTMLInputElement | null;
    if (el) {
      el.focus();
      if (S.focusKey) el.select?.();
      else if (sel && sel.s !== null && sel.e !== null) el.setSelectionRange?.(sel.s, sel.e);
    }
    S.focusKey = null;
  }
  syncPageUI();

  // Fit Width / Fit Page are sticky: when a panel opens or closes, the window resizes or the layout changes,
  // the viewport width changes, so re-fit once (the page then shrinks / grows instead of sliding under a panel).
  if (d && d.fit && !refitting) {
    const z = fitZoomFor(d.fit);
    if (z !== null && z !== d.zoom) {
      refitting = true;
      try { setZoom(z, d.fit); render(); } finally { refitting = false; }
    }
  }
}
let refitting = false;

const theme = new URLSearchParams(location.hash.slice(1)).get('theme');
if (theme === 'dark' || theme === 'light') document.documentElement.setAttribute('data-theme', theme);

initDocs();
setRenderer(render);
root.addEventListener('click', onClick);
root.addEventListener('input', onInput);
root.addEventListener('change', onChange);
document.addEventListener('keydown', onKeydown);
setupTooltips(root);
setupInteractions(root);
render();

// Cross the mobile breakpoint (rotate / resize): switch between inline sidebars and the bottom drawer.
let wasMobile = isMobileWidth();
new ResizeObserver(() => {
  const m = isMobileWidth();
  if (m !== wasMobile) { wasMobile = m; update(); }
  else if (doc()?.fit) update(); // keep Fit Width / Fit Page fitted while the window is resized
}).observe(root);

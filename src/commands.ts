import { S, ZOOMS, BASE_PAGE_W, PAGE_RATIO, doc, update, undo, redo, pushHistory, uid, Mode, RightPanel } from './state';
import { TOOLS } from './annotations';
import { toast } from './components/toast';
import { isEnabled } from './features';

export const MODE_DEFAULT_TOOL: Record<Mode, string | null> = {
  view: null, annotate: 'annotation:add-highlight',
};

/** Sets the zoom. Any manual zoom clears Fit Width / Fit Page; the fit commands pass their own mode so it stays "sticky". */
export function setZoom(z: number, fit: 'width' | 'page' | null = null): void {
  const d = doc();
  if (!d) return;
  d.zoom = clampZoom(z);
  d.fit = fit;
  S.pending = { ratio: true };
}

const clampZoom = (z: number): number => Math.max(25, Math.min(1600, Math.round(z)));

/** Zoom (%) that makes the pages fit the viewport as it is laid out right now (null if it isn't measurable). */
export function fitZoomFor(kind: 'width' | 'page'): number | null {
  const vp = document.querySelector('.ep-viewport') as HTMLElement | null;
  if (!vp || !vp.clientWidth) return null;
  const columns = S.spread === 'none' ? 1 : 2;
  const byWidth = (vp.clientWidth - 48) / (BASE_PAGE_W * columns);
  const byHeight = (vp.clientHeight - 48) / (BASE_PAGE_W * PAGE_RATIO);
  return clampZoom((kind === 'width' ? byWidth : Math.min(byWidth, byHeight)) * 100);
}

export function viewportSize(): { w: number; h: number } {
  const vp = document.querySelector('.ep-viewport') as HTMLElement | null;
  return { w: vp?.clientWidth ?? 800, h: vp?.clientHeight ?? 600 };
}

export function goToPage(n: number): void {
  const d = doc();
  if (!d) return;
  d.page = Math.max(1, Math.min(d.pages, n));
  S.pending = { page: d.page };
}

export function toggleRight(p: Exclude<RightPanel, null>): void {
  S.right = S.right === p ? null : p;
  if (S.right === 'search') S.focusKey = 'search';
}

export function activateTool(id: string | null): void {
  S.tool = id;
  S.pointerTool = 'pointer';
  S.selected = null;
}

export function isActive(id: string): boolean {
  const d = doc();
  switch (id) {
    case 'panel:toggle-sidebar': return S.leftOpen;
    case 'panel:toggle-search': return S.right === 'search';
    case 'panel:toggle-comment': return S.right === 'comment';
    case 'panel:toggle-annotation-style': return S.right === 'style';
    case 'pan:toggle': return S.pointerTool === 'pan';
    case 'pointer:toggle': return S.pointerTool === 'pointer' && !S.tool;
    case 'zoom:marquee': return S.pointerTool === 'marquee';
    case 'zoom:fit-width': return d?.fit === 'width';
    case 'zoom:fit-page': return d?.fit === 'page';
    case 'document:menu': return S.menu === 'document';
    case 'page:settings': return S.menu === 'page';
    case 'zoom:toggle-menu':
    case 'zoom:toggle-menu-mobile': return !!S.menu && S.menu.startsWith('zoom');
    case 'left-action-menu:overflow-menu': return !!S.menu && S.menu.startsWith('left');
    case 'tabs:overflow-menu': return S.menu === 'tabs';
    case 'annotation:overflow-tools': return S.menu === 'annot-more';
    case 'spread:none': case 'spread:two': return S.spread === id.split(':')[1];
    case 'scroll:vertical': return S.layout === 'vertical';
    case 'scroll:horizontal': return S.layout === 'horizontal';
  }
  if (id.startsWith('mode:')) return S.mode === id.slice(5);
  if (/^zoom:\d+$/.test(id)) return !!d && d.zoom === Number(id.slice(5));
  return S.tool === id;
}

export function isDisabled(id: string): boolean {
  const d = doc();
  if (!d) return true;
  switch (id) {
    case 'history:undo': return d.undo.length === 0;
    case 'history:redo': return d.redo.length === 0;
    case 'scroll:previous-page': return d.page <= 1;
    case 'scroll:next-page': return d.page >= d.pages;
    case 'zoom:in': return d.zoom >= 1600;
    case 'zoom:out': return d.zoom <= 25;
  }
  return false;
}

const MENU_TOGGLES: Record<string, string> = {
  'document:menu': 'document', 'page:settings': 'page', 'zoom:toggle-menu': 'zoom', 'zoom:toggle-menu-mobile': 'zoom',
  'left-action-menu:overflow-menu': 'left', 'tabs:overflow-menu': 'tabs', 'annotation:overflow-tools': 'annot-more',
};

export function execute(id: string): void {
  const d = doc();
  if (!isEnabled(id) || isDisabled(id)) return;

  if (MENU_TOGGLES[id]) { update(() => { const m = S.menu, t = MENU_TOGGLES[id]; S.menu = m === t || (t === 'left' && !!m?.startsWith('left')) || (t === 'zoom' && !!m?.startsWith('zoom')) ? null : t; }); return; }

  update(() => {
    S.menu = null;
    if (id.startsWith('mode:')) {
      S.mode = id.slice(5) as Mode;
      activateTool(MODE_DEFAULT_TOOL[S.mode]);
      return;
    }
    if (TOOLS[id]) {
      activateTool(S.tool === id ? null : id);
      return;
    }
    if (/^zoom:\d+$/.test(id)) { setZoom(Number(id.slice(5))); return; }
    switch (id) {
      case 'panel:toggle-sidebar': S.leftOpen = !S.leftOpen; break;
      case 'panel:toggle-search': toggleRight('search'); break;
      case 'panel:toggle-comment': toggleRight('comment'); break;
      case 'panel:toggle-annotation-style': toggleRight('style'); break;
      case 'pan:toggle': S.pointerTool = S.pointerTool === 'pan' ? 'pointer' : 'pan'; S.tool = null; break;
      case 'pointer:toggle': S.pointerTool = 'pointer'; S.tool = null; break;
      case 'zoom:marquee': S.pointerTool = S.pointerTool === 'marquee' ? 'pointer' : 'marquee'; S.tool = null; break;
      case 'zoom:in': if (d) setZoom(ZOOMS.find((z) => z > d.zoom) ?? 1600); break;
      case 'zoom:out': if (d) setZoom([...ZOOMS].reverse().find((z) => z < d.zoom) ?? 25); break;
      case 'zoom:fit-width': setZoom(fitZoomFor('width') ?? 100, 'width'); break;
      case 'zoom:fit-page': setZoom(fitZoomFor('page') ?? 100, 'page'); break;
      case 'spread:none': case 'spread:two': S.spread = id.split(':')[1] as typeof S.spread; S.pending = { page: d?.page }; break;
      case 'scroll:vertical': S.layout = 'vertical'; S.pending = { page: d?.page }; break;
      case 'scroll:horizontal': S.layout = 'horizontal'; S.pending = { page: d?.page }; break;
      case 'scroll:next-page': if (d) goToPage(d.page + 1); break;
      case 'scroll:previous-page': if (d) goToPage(d.page - 1); break;
      case 'history:undo': if (d) undo(d); break;
      case 'history:redo': if (d) redo(d); break;
      case 'document:export': toast('Exporting document\u2026 (demo only, nothing is downloaded)'); break;
      case 'document:capture': toast('Screenshot captured (demo)'); break;
      case 'document:fullscreen':
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen?.();
        break;
    }
  });
}

export { pushHistory, uid };

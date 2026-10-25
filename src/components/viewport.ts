import { h } from '../dom';
import { commandButton } from './buttons';
import { buildLayer } from '../annotations';
import { findHits, Hit } from '../content';
import { categoryEnabled } from '../features';
import { BASE_PAGE_W, Doc, PAGE_RATIO, S, doc } from '../state';

export const hitsFor = (d: Doc): Hit[] => findHits(d.content, S.search.q, S.search.matchCase, S.search.wholeWord);

function paraNodes(text: string, mine: { hit: Hit; idx: number }[]): (Node | string)[] {
  if (!mine.length) return [text];
  const out: (Node | string)[] = [];
  let cur = 0;
  for (const { hit, idx } of mine) {
    out.push(text.slice(cur, hit.start));
    out.push(h('mark', { class: `ep-mark${idx === S.search.active ? ' is-active' : ''}`, 'data-hit': idx }, text.slice(hit.start, hit.start + hit.len)));
    cur = hit.start + hit.len;
  }
  out.push(text.slice(cur));
  return out;
}

function pageBox(d: Doc, n: number, hits: Hit[]): HTMLElement {
  const W = Math.round((BASE_PAGE_W * d.zoom) / 100), H = Math.round(W * PAGE_RATIO);
  const c = d.content[n - 1];

  const inner = h('div', { class: 'ep-page-inner' });
  if (n === 1) {
    inner.append(h('h1', { class: 'ep-ph-title' }, c.heading));
    if (c.sub) inner.append(h('div', { class: 'ep-ph-sub' }, c.sub));
  } else inner.append(h('h2', { class: 'ep-ph' }, c.heading));
  if (c.fig === 1) inner.append(h('div', { class: 'ep-fig' }));
  c.paras.forEach((text, k) => {
    const mine = hits.map((hit, idx) => ({ hit, idx })).filter((x) => x.hit.page === n && x.hit.para === k);
    inner.append(h('p', { class: 'ep-ptext' }, paraNodes(text, mine)));
    if (c.fig === 2 && k === 0) inner.append(h('div', { class: 'ep-fig ep-fig-small' }));
  });
  inner.append(h('div', { class: 'ep-pnum' }, String(n)));

  const page = h('div', { class: 'ep-page ep-page-live', 'data-page': n, style: `width:${W}px;height:${H}px` }, inner, buildLayer(n));
  return h('div', { class: 'ep-page-box', 'data-page-box': n, style: `width:${W}px;height:${H}px` }, page);
}

function rows(total: number): number[][] {
  const out: number[][] = [];
  if (S.spread === 'none') for (let i = 1; i <= total; i++) out.push([i]);
  else for (let i = 1; i <= total; i += 2) out.push(i + 1 <= total ? [i, i + 1] : [i]); // two pages: (1,2) (3,4) ...
  return out;
}

export function viewport(): HTMLElement {
  const d = doc()!;
  const hits = hitsFor(d);
  return h('div', { class: 'ep-viewport-wrap' },
    h('div', { class: 'ep-viewport', 'data-scroll': 'viewport' },
      h('div', { class: `ep-pages is-${S.layout}` },
        rows(d.pages).map((r) => h('div', { class: 'ep-row' }, r.map((n) => pageBox(d, n, hits)))))),
    pageControls(d));
}

function pageControls(d: Doc): HTMLElement | null {
  if (!categoryEnabled('navigation')) return null;
  return h('div', { class: 'ep-overlay ep-overlay-bottom-center' },
    h('div', { class: 'ep-page-controls' },
      commandButton('scroll:previous-page'),
      h('div', { class: 'ep-page-input-wrap' },
        h('input', { class: 'ep-page-input', type: 'text', inputmode: 'numeric', value: String(d.page), 'aria-label': 'Page number', 'data-in': 'page', 'data-focus': 'page' }),
        h('span', { class: 'ep-page-total' }, `\u00a0 ${d.pages}`)),
      commandButton('scroll:next-page')));
}

import { h } from '../dom';
import { icon } from '../icon';
import { hitsFor } from './viewport';
import { buildOutline, OutlineNode } from '../content';
import { Ann, Cmt, Doc, Reply, S, doc } from '../state';
import { categoryEnabled } from '../features';
import { TOOLS, TYPE_LABEL, defaultFor } from '../annotations';

// ───────── left sidebar (table of contents) ─────────
function outlineNode(node: OutlineNode, depth: number): HTMLElement {
  const key = `${node.page}:${node.title}`;
  const has = !!node.children?.length;
  const open = S.outlineOpen[key] ?? depth === 0;
  return h('div', { class: 'ep-outline-node' },
    h('div', { class: 'ep-outline-row', style: `padding-left:${8 + depth * 16}px`, 'data-act': 'outline-go', 'data-arg': node.page },
      has ? h('span', { class: 'ep-outline-toggle', 'data-act': 'outline-toggle', 'data-arg': key, 'data-open': open }, icon(open ? 'chevronDown' : 'chevronRight', { size: 12 })) : h('span', { class: 'ep-outline-spacer' }),
      h('span', { class: 'ep-outline-title' }, node.title)),
    has && open ? node.children!.map((c) => outlineNode(c, depth + 1)) : null);
}

export function leftSidebar(d: Doc): HTMLElement {
  return h('aside', { class: 'ep-sidebar ep-sidebar-left' },
    h('div', { class: 'ep-sidebar-tabs-layout' },
      h('div', { class: 'ep-sidebar-body', 'data-scroll': 'left' },
        h('div', { class: 'ep-outline' }, buildOutline(d.content).map((n) => outlineNode(n, 0))))));
}

// ───────── search ─────────
function checkbox(label: string, key: string, checked: boolean): HTMLElement {
  return h('label', { class: 'ep-checkbox' },
    h('input', { type: 'checkbox', checked, 'data-in': key }),
    h('span', { class: 'ep-checkbox-box' }, icon('check', { size: 14, strokeWidth: 3 })), label);
}

function searchPanel(d: Doc): HTMLElement {
  const hits = hitsFor(d);
  const q = S.search.q;
  const groups = new Map<number, number[]>();
  hits.forEach((x, i) => groups.set(x.page, [...(groups.get(x.page) ?? []), i]));
  return h('div', { class: 'ep-search' },
    h('div', { class: 'ep-search-top' },
      h('div', { class: 'ep-search-input-wrap' },
        h('span', { class: 'ep-search-icon' }, icon('search', { size: 16 })),
        h('input', { class: 'ep-search-input', type: 'text', placeholder: 'Search', value: q, 'data-in': 'search-q', 'data-focus': 'search', autocomplete: 'off' }),
        q ? h('button', { type: 'button', class: 'ep-search-clear', 'aria-label': 'Clear', 'data-act': 'search-clear' }, icon('x', { size: 16 })) : null),
      h('div', { class: 'ep-search-flags' }, checkbox('Case sensitive', 'search-case', S.search.matchCase), checkbox('Whole word', 'search-word', S.search.wholeWord)),
      h('hr', { class: 'ep-hr' }),
      h('div', { class: 'ep-search-summary' },
        h('div', { class: 'ep-search-count' }, q.trim() ? (hits.length ? `${S.search.active + 1} of ${hits.length} results` : 'No results found') : 'Type to search'),
        h('div', { class: 'ep-search-nav' },
          h('button', { type: 'button', class: 'ep-btn', 'aria-label': 'Previous result', disabled: !hits.length, 'data-act': 'search-prev' }, icon('chevronLeft', { size: 16 })),
          h('button', { type: 'button', class: 'ep-btn', 'aria-label': 'Next result', disabled: !hits.length, 'data-act': 'search-next' }, icon('chevronRight', { size: 16 }))))),
    h('div', { class: 'ep-search-results', 'data-scroll': 'right' },
      [...groups.entries()].map(([page, idxs]) =>
        h('div', { class: 'ep-hit-group' },
          h('div', { class: 'ep-hit-page' }, `Page ${page}`),
          h('div', { class: 'ep-hit-list' }, idxs.map((i) => {
            const x = hits[i];
            return h('button', { type: 'button', class: `ep-hit${i === S.search.active ? ' is-active' : ''}`, 'data-act': 'hit-go', 'data-arg': i },
              h('span', {}, '\u2026 ' + x.before, h('span', { class: 'ep-hit-match' }, x.match), x.after + ' \u2026'));
          }))))));
}

// ───────── comments ─────────
const avatar = (name: string, color: string): HTMLElement => h('div', { class: `ep-avatar ${color}` }, name.charAt(0).toUpperCase());

/** The "⋯" button + its Edit / Delete popup. Works for comments and replies (ids are unique). */
function itemMenu(id: string): HTMLElement | null {
  const canEdit = categoryEnabled('comment-edit'), canDelete = categoryEnabled('comment-delete');
  if (!canEdit && !canDelete) return null;
  return h('div', { class: 'ep-anchor' },
    h('button', { type: 'button', class: 'ep-card-menu', 'aria-label': 'Menu', 'data-act': 'comment-menu', 'data-arg': id, 'data-menu-trigger': '1' }, icon('dots', { size: 16 })),
    S.commentMenu === id
      ? h('div', { class: 'ep-menu ep-menu-small', role: 'menu' },
          canEdit ? h('button', { type: 'button', class: 'ep-menu-item', 'data-act': 'comment-edit', 'data-arg': id }, h('span', { class: 'ep-menu-label' }, 'Edit')) : null,
          canDelete ? h('button', { type: 'button', class: 'ep-menu-item', 'data-act': 'comment-delete', 'data-arg': id }, h('span', { class: 'ep-menu-label' }, 'Delete')) : null)
      : null);
}

function editForm(id: string, text: string): HTMLElement {
  return h('div', { class: 'ep-card-edit' },
    h('textarea', { class: 'ep-textarea', rows: 3, 'data-focus': 'comment-edit', 'data-in': 'comment-text', 'data-arg': id }, text),
    h('div', { class: 'ep-card-edit-actions' },
      h('button', { type: 'button', class: 'ep-secondary-btn ep-sm', 'data-act': 'comment-cancel' }, 'Cancel'),
      h('button', { type: 'button', class: 'ep-primary-btn ep-sm', 'data-act': 'comment-save', 'data-arg': id }, 'Save')));
}

function replyItem(r: Reply): HTMLElement {
  const editing = S.editingComment === r.id;
  return h('div', { class: 'ep-reply' },
    avatar(r.author, r.color),
    h('div', { class: 'ep-card-main' },
      h('div', { class: 'ep-card-head' },
        h('div', { class: 'ep-card-author' }, h('h5', {}, r.author), h('span', {}, r.date)),
        itemMenu(r.id)),
      editing ? editForm(r.id, r.text) : h('p', { class: 'ep-card-text' }, r.text)));
}

/** "Add reply" field + send button (always shown under a comment, like EmbedPDF's AnnotationInput). */
function replyForm(c: Cmt): HTMLElement {
  const draft = S.replyDraft[c.id] ?? '';
  return h('div', { class: 'ep-reply-form', 'data-act': 'noop' },
    h('input', { type: 'text', class: 'ep-reply-field', placeholder: 'Add reply', value: draft, 'aria-label': 'Add reply', autocomplete: 'off', 'data-in': 'reply-text', 'data-arg': c.id, 'data-focus': `reply-${c.id}` }),
    h('button', { type: 'button', class: 'ep-reply-send', 'aria-label': 'Send reply', 'data-act': 'reply-send', 'data-arg': c.id, ...(draft.trim() ? {} : { disabled: true }) }, icon('send', { size: 20 })));
}

function commentCard(c: Cmt): HTMLElement {
  const editing = S.editingComment === c.id;
  const selected = !!c.annId && S.selected === c.annId;
  const replies = c.replies ?? [];
  return h('div', { class: `ep-card${selected ? ' is-selected' : ''}`, 'data-act': 'comment-go', 'data-arg': c.id },
    h('div', { class: 'ep-card-body' },
      h('div', { class: 'ep-card-row' },
        avatar(c.author, c.color),
        h('div', { class: 'ep-card-main' },
          h('div', { class: 'ep-card-head' },
            h('div', { class: 'ep-card-author' }, h('h4', {}, c.author), h('span', {}, c.date)),
            itemMenu(c.id)),
          editing ? editForm(c.id, c.text) : h('p', { class: 'ep-card-text' }, c.text))),
      replies.length ? h('div', { class: 'ep-reply-list' }, replies.map(replyItem)) : null,
      categoryEnabled('comment-reply') && !editing ? replyForm(c) : null));
}

function commentPanel(d: Doc): HTMLElement {
  if (!d.comments.length)
    return h('div', { class: 'ep-comments ep-comments-empty' }, h('div', { class: 'ep-empty-icon small' }, icon('comment', { size: 28 })),
      h('p', { class: 'ep-card-text' }, 'No comments yet.'), h('p', { class: 'ep-hint' }, 'Switch to Annotate and pick the comment tool, then click on a page.'));
  const pages = [...new Set(d.comments.map((c) => c.page))].sort((a, b) => a - b);
  return h('div', { class: 'ep-comments', 'data-scroll': 'right' }, pages.map((p) => {
    const list = d.comments.filter((c) => c.page === p);
    return h('div', { class: 'ep-comment-page' },
      h('div', { class: 'ep-comment-page-head' }, h('h3', {}, `Page ${p}`), h('p', {}, `${list.length} comment${list.length === 1 ? '' : 's'}`)),
      h('div', { class: 'ep-comment-list' }, list.map(commentCard)));
  }));
}

// ───────── style panel ─────────
const SWATCHES = ['#E44234', '#FF9500', '#FFCD45', '#34C759', '#00C7BE', '#3B82F6', '#AF52DE', '#FF2D92', '#8E8E93', '#000000'];
const BLENDS = ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten'];
const NO_WIDTH = ['highlight', 'text', 'insertText', 'comment'];
const HAS_BLEND = ['highlight', 'inkhl'];

export function styleTarget(d: Doc): { type: string; style: { color: string; opacity: number; width: number; blend: string }; ann: Ann | null } | null {
  const ann = d.anns.find((a) => a.id === S.selected) ?? null;
  if (ann) return { type: ann.type, style: ann, ann };
  if (S.tool && TOOLS[S.tool]) return { type: TOOLS[S.tool].type, style: defaultFor(TOOLS[S.tool].type), ann: null };
  return null;
}

function section(label: string, value: string | null, control: Node, valueId?: string): HTMLElement {
  return h('div', { class: 'ep-style-section' },
    h('div', { class: 'ep-style-label-row' }, h('label', { class: 'ep-style-label' }, label), value ? h('span', { class: 'ep-style-value', id: valueId }, value) : null), control);
}

function stylePanel(d: Doc): HTMLElement {
  const t = styleTarget(d);
  if (!t) return h('div', { class: 'ep-style' }, h('h3', { class: 'ep-style-title' }, 'Annotation Styles'), h('p', { class: 'ep-hint' }, 'Pick an annotation tool or select an annotation on the page to edit its style.'));
  const s = t.style;
  return h('div', { class: 'ep-style' },
    h('h3', { class: 'ep-style-title' }, `${TYPE_LABEL[t.type] ?? t.type} Styles`),
    section('Color', null, h('div', { class: 'ep-swatches' }, SWATCHES.map((c) => h('button', { type: 'button', class: `ep-swatch${c.toLowerCase() === s.color.toLowerCase() ? ' is-selected' : ''}`, style: `background:${c}`, 'aria-label': c, 'data-act': 'style-color', 'data-arg': c })))),
    section('Opacity', `${Math.round(s.opacity * 100)}%`, h('input', { class: 'ep-range', type: 'range', min: 10, max: 100, value: Math.round(s.opacity * 100), 'data-in': 'style-opacity' }), 'style-opacity-v'),
    NO_WIDTH.includes(t.type) ? null : section('Stroke width', `${s.width}px`, h('input', { class: 'ep-range', type: 'range', min: 1, max: 24, value: s.width, 'data-in': 'style-width' }), 'style-width-v'),
    HAS_BLEND.includes(t.type)
      ? section('Blend mode', null, h('select', { class: 'ep-select', 'data-in': 'style-blend' }, BLENDS.map((b) => h('option', { value: b, selected: b === s.blend }, b.charAt(0).toUpperCase() + b.slice(1)))))
      : null);
}

export function rightSidebar(d: Doc): HTMLElement {
  const body = S.right === 'search' ? searchPanel(d) : S.right === 'comment' ? commentPanel(d) : stylePanel(d);
  return h('aside', { class: 'ep-sidebar ep-sidebar-right' }, body);
}

export { doc };

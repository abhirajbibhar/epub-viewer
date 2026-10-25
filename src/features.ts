import { config } from './config';

/**
 * Feature switchboard. Every command carries hierarchical categories (same scheme as EmbedPDF's
 * command registry): 'document' > 'document-export', 'annotation' > 'annotation-ink', ...
 * A command is enabled only if NONE of its categories is disabled.
 */

/** Friendly names accepted in config.disabledCategories / #disable=... */
export const ALIASES: Record<string, string> = {
  export: 'document-export', download: 'document-export', screenshot: 'document-capture', fullscreen: 'document-fullscreen',
  view: 'mode-view', annotate: 'mode-annotate',
  search: 'panel-search', comments: 'panel-comment', sidebar: 'panel-sidebar',
  replies: 'comment-reply', reply: 'comment-reply',
  undo: 'history-undo', redo: 'history-redo',
};

const MARKUP = ['highlight', 'underline', 'strikeout', 'squiggly', 'insert-text', 'replace-text'];
const INK = ['ink', 'ink-highlighter'];
const TEXT = ['text', 'callout'];
const MODE_EXTRA: Record<string, string[]> = { annotate: ['annotation'] };

export function categoriesOf(id: string): string[] {
  const [ns, name = ''] = id.split(':');
  switch (ns) {
    case 'document': return ['document', `document-${name}`];
    case 'zoom':
      if (/^\d+$/.test(name)) return ['zoom', 'zoom-level', `zoom-level-${name}`];
      if (name.startsWith('toggle-menu')) return ['zoom', 'zoom-menu'];
      return ['zoom', `zoom-${name}`];
    case 'pan': return ['tools', 'pan'];
    case 'pointer': return ['tools', 'pointer'];
    case 'left-action-menu': return ['ui', 'ui-menu'];
    case 'panel': return ['panel', `panel-${name.replace('toggle-', '')}`];
    case 'page': return ['page', `page-${name}`];
    case 'spread': return ['page', 'spread', `spread-${name}`];
    case 'scroll':
      return name === 'next-page' || name === 'previous-page'
        ? ['page', 'navigation', name === 'next-page' ? 'navigation-next' : 'navigation-previous']
        : ['page', 'scroll', `scroll-${name}`];
    case 'mode': return ['mode', `mode-${name}`, ...(MODE_EXTRA[name] ?? [])];
    case 'tabs': return ['mode', 'mode-menu'];
    case 'annotation': {
      if (name === 'overflow-tools') return ['annotation', 'ui-menu'];
      const t = name.replace('add-', '');
      const group = MARKUP.includes(t) ? 'annotation-markup' : INK.includes(t) ? 'annotation-ink' : TEXT.includes(t) ? 'annotation-text' : t === 'comment' ? 'annotation-comment' : '';
      return ['annotation', ...(group ? [group] : []), `annotation-${t}`];
    }
    case 'history': return ['history', `history-${name}`];
    default: return [];
  }
}

const disabled = new Set(
  config.disabledCategories.map((c) => c.trim().toLowerCase()).filter(Boolean).map((c) => ALIASES[c] ?? c),
);

export const disabledCategories = (): string[] => [...disabled];

/** Is this category (or alias) switched on? */
export function categoryEnabled(cat: string): boolean {
  const c = cat.toLowerCase();
  return !disabled.has(ALIASES[c] ?? c);
}

/** Is this command switched on? */
export function isEnabled(id: string): boolean {
  return categoriesOf(id).every(categoryEnabled);
}

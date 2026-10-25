# PDF Viewer UI – interactive demo (TypeScript + HTML + CSS)

A front-end-only recreation of the EmbedPDF viewer chrome. There is **no PDF engine**: pages are generated,
searchable placeholder text, but every control around them behaves like the real thing.

## Run it

`dist/app.js` is pre-built, so just open `index.html`.

```bash
npm install
npm run build      # src/main.ts -> dist/app.js (esbuild bundle)
npm run watch
npm run typecheck
```

## What works

This build is trimmed for use as an **EPUB / book reader shell** (the page area is meant to be replaced by foliate.js).

- **Menus**: document (screenshot, export, fullscreen), page layout, zoom, mode overflow, annotation overflow; click outside / Esc closes them
- **Tools**: Pointer, Pan (drag to scroll), Marquee zoom, zoom in/out/presets/fit page/fit width, Ctrl+wheel zoom
- **Zoom**: Fit Width / Fit Page are sticky: they re-fit when a panel opens or closes or the window resizes; any manual zoom cancels them
- **Layout**: single page or two-page spread (pages 1+2, 3+4 …), vertical / horizontal scroll
- **Sidebars**: table of contents (left); search, comments, annotation styles (right)
- **Search**: live results, case / whole-word toggles, next / previous, highlighted matches on the pages
- **Comments**: add with the comment tool, edit, delete, reply threads, jump to page
- **Modes**: View and Annotate (highlight, underline, strikethrough, squiggly, insert / replace text, ink, ink highlighter, text, callout, comment); select, move, delete (Del), undo / redo
- **Style panel**: colour, opacity, stroke width and blend mode for the selected annotation or the active tool
- **Responsive** (container-width) toolbar and light / dark theme (`index.html#theme=dark` to force)

Shortcuts: Ctrl+F search, Ctrl+Z / Ctrl+Shift+Z undo / redo, Ctrl +/- zoom, Esc cancel, Del delete.

**Permanently removed** (code deleted, not just hidden): document tabs, Open, Close, Print, Security, thumbnails, page rotation,
odd / even spreads, and the Shapes, Insert, Form and Redact modes (with their tools, panels, dialogs and styles).

## Layout

```
index.html
src/config.ts        feature switches + mobile options (edit DEFAULT_CONFIG)
src/features.ts      command categories (print, annotation, ...) and enable checks
src/enforce.ts       resets state that points at a disabled feature
css/theme.css        colour tokens
css/viewer.css       styles
src/state.ts         central state + history
src/commands.ts      command registry (execute / isActive / isDisabled)
src/actions.ts       click / input / keyboard handlers
src/interactions.ts  pointer drawing, pan, marquee, scroll tracking
src/annotations.ts   annotation model + SVG/HTML layer renderer
src/content.ts       generated page text, outline, search
src/components/      drawer (mobile sidebar drawer), menuSheet (mobile menu sheet), toolbar, menus, sidebars, viewport, toast, tooltip
src/icons.ts         SVG icons extracted from the original components
```

## Mobile UI (container width < 768px)

Mirrors EmbedPDF's native behaviour: instead of side panels and dropdowns, the viewer uses bottom sheets.

- **Sidebar drawer** (`components/drawer.ts`): table of contents, search, comments and annotation styles slide up
  from the bottom with a backdrop and a drag handle. Snap points: closed / half / full (velocity + position based).
- **Menu sheet** (`components/menuSheet.ts`): document, page, zoom and mode menus slide up, wrap their content (max 80%),
  show a back arrow + title for submenus and are dismissed by dragging down, tapping the backdrop, or Esc.

- **Toolbar overflow** (< 640px): Annotate keeps its core tools and moves the rest into a "⋯" menu (opens as a bottom sheet).
- **Touch / notch:** `viewport-fit=cover` + safe-area padding; drawing, pan and marquee tools disable page scrolling while active; sheets don't scroll-chain into the page; Esc closes the drawer.

Both shells are created once and kept across `render()` calls, otherwise the slide transition could never run.

## Enabling / disabling features

Edit `DEFAULT_CONFIG` in `src/config.ts`, or set it from the page before the bundle loads:

```html
<script>
  window.PDF_VIEWER_CONFIG = {
    disabledCategories: ['export', 'screenshot', 'comments'],
    mobile: { menuSheet: true, sidebarDrawer: true, drawer: { initialSnap: 'half', resizable: true } },
  };
</script>
<script src="dist/app.js"></script>
```

Quick test without editing anything: `index.html#disable=export,search`.

Disabling a category removes every button, menu item, keyboard shortcut and panel that belongs to it (children included);
empty menus, section titles and stray dividers disappear with it.

| Category (alias) | What goes away |
| --- | --- |
| `document` | whole document menu · `document-export` (`export`) · `document-capture` (`screenshot`) · `document-fullscreen` (`fullscreen`) |
| `mode-view` (`view`) · `mode-annotate` | the View / Annotate tab |
| `annotation` | Annotate mode and all tools · finer: `annotation-markup`, `annotation-ink`, `annotation-text`, `annotation-comment` |
| `panel-sidebar` (`sidebar`) | table-of-contents sidebar |
| `panel-search` (`search`) · `panel-comment` (`comments`) · `panel-annotation-style` | right-hand panels (and Ctrl+F) |
| `comment-reply` (`replies`) · `comment-edit` · `comment-delete` | the "Add reply" field · entries in a comment's / reply's menu |
| `zoom` | zoom toolbar, zoom menu, Ctrl+wheel · finer: `zoom-in`, `zoom-out`, `zoom-level`, `zoom-fit-page`, `zoom-fit-width`, `zoom-marquee` |
| `page` | page menu · `spread`, `scroll`, `navigation` (the prev / next / page-number pill) |
| `tools` | pan + pointer · `history` (`undo`, `redo`) |

Mobile options: `mobile.breakpoint`, `mobile.sidebarDrawer` (false = inline sidebars), `mobile.menuSheet` (false = dropdowns),
`mobile.drawer.initialSnap` (`'half'` / `'full'`) and `mobile.drawer.resizable`.

### Comment replies

Every comment has a reply thread and an "Add reply" field (Enter or the send button). Replies have the same Edit / Delete menu as comments.
Unsent text survives re-renders. Selecting a comment focuses its reply field on desktop (not on touch devices, to avoid popping the keyboard).

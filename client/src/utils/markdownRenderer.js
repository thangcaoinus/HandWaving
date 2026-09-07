import MarkdownIt from 'markdown-it';
import markdownItKatexModule from '@vscode/markdown-it-katex';
// KaTeX's stylesheet as a raw string (Vite ?raw). A rasterized <foreignObject> is a
// SEALED document that inherits none of the page's stylesheets, so KaTeX's positioning
// rules must be inlined into the SVG or math collapses to raw inline text. We strip the
// @font-face blocks: they reference relative url(fonts/...) that would fail to resolve
// in a data-URI SVG (and could taint the export canvas). The math fonts themselves are
// already loaded browser-wide by the page-level `import 'katex/dist/katex.min.css'`, and
// foreignObject rasters share the browser font cache — so the remaining font-family
// rules resolve against those already-loaded fonts.
import katexRawCss from 'katex/dist/katex.min.css?raw';

// The plugin is a CJS package (`exports.default = fn`). Depending on whether the
// bundler unwraps the __esModule default, the callable is either the import itself
// or its `.default`. Normalize so this works in both Vite and plain Node.
const markdownItKatex = markdownItKatexModule.default ?? markdownItKatexModule;

/**
 * Single source of truth for turning a text object's raw source into HTML.
 * Used by BOTH the offscreen measurer (textBbox.js) and the SVG rasterizer
 * (textRasterCache.js) — they MUST share this so measured geometry matches
 * painted pixels exactly.
 *
 * Safety: html:false means any literal HTML in the source is escaped, never
 * injected. KaTeX defaults to trust:false, so \href{javascript:...} and friends
 * are neutralized. So we can store raw source verbatim and skip character-stripping.
 */
const md = new MarkdownIt({
  xhtmlOut: true, // SVG foreignObject is XML: void tags such as <br/> must close.
  html: false,      // escape raw HTML — the whole XSS story rests on this
  linkify: false,   // don't auto-linkify bare URLs on a whiteboard
  breaks: true,     // a single newline becomes <br>, matching how people type labels
}).use(markdownItKatex, {
  throwOnError: false, // malformed LaTeX renders as a red error node, never throws
});

/**
 * Raw source -> HTML string. The one transform everything funnels through.
 */
export function renderToHtml(text) {
  if (!text) return '';
  return md.render(text);
}

/**
 * Wrapper CSS inlined into both the measurer div and the SVG <foreignObject>.
 * Keep this minimal and self-contained: it must not depend on the app's stylesheet
 * (the SVG raster can't see external sheets without tainting the export canvas).
 * `color` is left to inherit so the text object's own color drives it.
 */
export const TEXT_WRAPPER_CSS = `
  margin: 0;
  /* Small symmetric padding so KaTeX descenders/radicals and the last glyph never touch
     the raster edge. Because it lives on the measured element, getBoundingClientRect()
     includes it — so bbox, SVG canvas, and drawImage all share ONE padded size. */
  padding: 2px 3px;
  box-sizing: border-box;
  font-family: 'Nunito', system-ui, sans-serif;
  line-height: 1.2;
  white-space: normal;
`.trim();

/**
 * Per-element resets so Markdown block elements (h1, ul, p, ...) don't inherit
 * browser default margins that would desync the measured box from the paint.
 * Scoped under a wrapper class the measurer/raster both apply.
 */
// KaTeX layout CSS for the sealed SVG raster, with @font-face stripped (see import note).
export const KATEX_RASTER_CSS = katexRawCss.replace(/@font-face\s*\{[^}]*\}/g, '');

export const TEXT_CONTENT_CSS = `
  /* Belt-and-suspenders: the inlined KaTeX CSS already hides .katex-mathml via clip,
     but display:none is more robust when rasterizing (clip can still occupy layout in
     some engines, which doubled every formula before the KaTeX CSS was inlined). */
  .hw-md .katex { overflow-wrap: normal; }
  .hw-md .katex-display { margin: 0.4em 0; text-align: inherit; }
  .hw-md .katex-mathml { display: none !important; }
  /* A rasterized SVG is a sealed document with NO CSS reset (no Tailwind Preflight, no
     app stylesheet) — only the UA default sheet, which sizes h1 at 2em/bold, h2 at 1.5em,
     etc. The measurer div lives in the main document where Preflight neutralizes those.
     To keep measured geometry == painted pixels we must set font-size/weight EXPLICITLY
     here so both environments render headings identically. */
  .hw-md > :first-child { margin-top: 0; }
  .hw-md > :last-child { margin-bottom: 0; }
  .hw-md p { margin: 0 0 0.3em; font-size: 1em; font-weight: inherit; }
  .hw-md h1 { margin: 0.2em 0 0.3em; line-height: 1.15; font-size: 1.6em; font-weight: 700; }
  .hw-md h2 { margin: 0.2em 0 0.3em; line-height: 1.15; font-size: 1.4em; font-weight: 700; }
  .hw-md h3 { margin: 0.2em 0 0.3em; line-height: 1.15; font-size: 1.2em; font-weight: 700; }
  .hw-md h4, .hw-md h5, .hw-md h6 { margin: 0.2em 0 0.3em; line-height: 1.15; font-size: 1.1em; font-weight: 700; }
  .hw-md strong, .hw-md b { font-weight: 700; }
  .hw-md em, .hw-md i { font-style: italic; }
  .hw-md ul, .hw-md ol { margin: 0 0 0.3em; padding-left: 1.4em; }
  .hw-md li { margin: 0.1em 0; }
  .hw-md code { font-family: ui-monospace, 'Courier New', monospace; font-size: 0.9em; }
  .hw-md pre { margin: 0 0 0.3em; white-space: pre-wrap; }
  .hw-md blockquote { margin: 0 0 0.3em; padding-left: 0.6em; border-left: 3px solid currentColor; opacity: 0.85; }
`.trim();

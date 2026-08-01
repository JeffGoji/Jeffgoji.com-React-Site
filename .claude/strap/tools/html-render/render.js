#!/usr/bin/env node
/*
 * STRAP html-render pipeline.
 *
 * Reads a JSON config describing source markdown files + nav structure + output path,
 * renders each source via `marked` (HTML passthrough preserves rich components), wraps
 * the result in the bundled template with embedded CSS, and writes a self-contained
 * HTML output. No external CDN dependencies in the rendered file.
 *
 * Invoked by:
 *   - .claude/strap/tools/html-render/configs/welcome.json (Welcome HTML at release-cut,
 *     via `npm run render:welcome` from infra/pipeline/scripts/)
 *   - /strap-in Section 9 and /strap-refresh Section 9 (project-docs HTML companion;
 *     config built in memory by the dev-lead from project-profile.md values)
 *
 * Path resolution for `sources[].path` and `outputPath`:
 *   - Absolute paths are honored as-is.
 *   - If config sets `"basePath"`, relative paths resolve from there. `basePath` itself
 *     may be absolute, or relative to the config file's directory.
 *   - Otherwise, relative paths resolve from the config file's directory (backward-
 *     compatible with configs colocated next to their sources, e.g. welcome.json).
 *
 * Recommended pattern for in-memory configs (e.g. /strap-in Section 9): set
 * `"basePath"` to the repo root so the dev-lead can author source/output paths as
 * familiar `.claude/strap/project-docs/PROJECT.md`-style repo-relative strings
 * without worrying about where the temp config file gets written.
 *
 * Usage: node render.js <path-to-config.json>
 */

const fs = require('fs');
const path = require('path');
const { marked, Marked } = require('marked');

const HERE = __dirname;
const TEMPLATE_PATH = path.join(HERE, 'template.html');
const STYLE_PATH = path.join(HERE, 'style.css');

function fail(message) {
  process.stderr.write(`render.js: ${message}\n`);
  process.exit(1);
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    fail(`Cannot read config '${filePath}': ${err.message}`);
  }
}

function readText(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    fail(`Cannot read source '${filePath}': ${err.message}`);
  }
}

/**
 * Strip leading YAML frontmatter from a markdown source string.
 *
 * Templates ship with meta frontmatter (`---\nname: ...\ndescription: ...\n---`)
 * that identifies the template; tech-writer is contracted to drop it before
 * rendering, but defensive stripping here prevents a small tech-writer mistake
 * from producing malformed setext-style H2 headings (where marked parses
 * `text\n---` as `<h2>text</h2>` and emits a huge slugified anchor in the nav).
 *
 * Accepts both `---` and `+++` as fences. No-op if the source doesn't begin
 * with a recognized fence on line 1.
 */
function stripFrontmatter(md) {
  const match = md.match(/^(---|\+\+\+)\s*\r?\n([\s\S]*?)\r?\n\1\s*\r?\n?/);
  if (!match) return md;
  return md.slice(match[0].length);
}

function configureMarked() {
  marked.setOptions({
    gfm: true,
    breaks: false,
    pedantic: false,
    smartypants: false,
  });
}

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function slugify(s) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Render one source markdown file into a wrapped section.
 * Returns { sectionHtml, headings } where headings is an array of
 * { level, text, id } for nav generation.
 */
function renderSource(source) {
  const sourcePath = source.path;
  const sectionId = source.id || slugify(path.basename(sourcePath, '.md'));
  const md = stripFrontmatter(readText(sourcePath));

  // Track headings before rendering so we can build the nav.
  // marked v14 uses marked.use({ renderer: { method } }) for partial-renderer extension;
  // each method receives a single token-object parameter. `this.parser.parseInline(tokens)`
  // produces the rendered inline HTML.
  const headings = [];
  const localMarked = new Marked();
  localMarked.use({
    renderer: {
      heading({ tokens, depth, raw, text }) {
        const inlineHtml = this.parser.parseInline(tokens);
        // marked's `text` field carries the heading content WITHOUT the leading
        // `##`/`###` markdown prefix; `raw` carries the full source line including
        // the prefix. Use `text` for the visible nav label so the sidebar reads
        // "What this project is" not "## What this project is".
        const plainText = (text || raw || '').replace(/<[^>]+>/g, '').trim();
        // Honor explicit {#id} suffix in markdown headings if present (e.g., "## What is STRAP? {#what-is-strap}").
        let headingId;
        let displayHtml = inlineHtml;
        const explicitIdMatch = plainText.match(/^(.+?)\s*\{#([a-zA-Z0-9-]+)\}\s*$/);
        if (explicitIdMatch) {
          headingId = explicitIdMatch[2];
          displayHtml = inlineHtml.replace(/\s*\{#[a-zA-Z0-9-]+\}\s*$/, '');
        } else {
          headingId = slugify(plainText);
        }
        const visibleText = plainText.replace(/\s*\{#[a-zA-Z0-9-]+\}\s*$/, '');
        headings.push({ level: depth, text: visibleText, id: headingId });
        return `<h${depth} id="${headingId}">${displayHtml}</h${depth}>\n`;
      },
    },
  });

  const rendered = localMarked.parse(md);

  // Wrap the rendered HTML in a section with the configured id (sidebar anchors point here).
  const sectionHtml = `<section id="${sectionId}">\n${rendered}\n</section>`;

  return { sectionHtml, headings, sourcePath, sectionId };
}

/**
 * Build the sidebar nav HTML.
 *
 * Two modes:
 *   - explicit: config.nav is an array of { type, label, href } entries; rendered verbatim.
 *     Entries with type:"section" render as section labels (.top); type:"link" as anchors.
 *   - auto: config.nav === "auto"; nav generated from each source's top-level headings.
 *     The source's id becomes the first link under each implicit section label.
 */
function buildNav(config, renderedSources) {
  const items = [];
  if (Array.isArray(config.nav)) {
    for (const entry of config.nav) {
      if (entry.type === 'section') {
        items.push(`      <li class="top">${escapeHtml(entry.label)}</li>`);
      } else if (entry.type === 'link') {
        items.push(`      <li><a href="${escapeHtml(entry.href)}">${escapeHtml(entry.label)}</a></li>`);
      }
    }
  } else if (config.nav === 'auto' || typeof config.nav === 'undefined') {
    // One section per source; links from H1/H2/H3 within that source. H2s
    // render at the first indent level (`.sub`); H3s nest one further (`.sub-sub`)
    // so subsections under an H2 ("Active domains > security / infrastructure /
    // integrations" in ARCHITECTURE.md; "Per-sub-repo internal architecture >
    // <sub-repo>" in polyrepo ARCHITECTURE.md) are still directly clickable.
    // Configurable depth would be a future change; defaulting to depth 3 covers
    // the orientation-docs case cleanly.
    for (const src of renderedSources) {
      const sectionLabel = src.label || src.sectionId;
      items.push(`      <li class="top">${escapeHtml(sectionLabel)}</li>`);
      items.push(`      <li><a href="#${escapeHtml(src.sectionId)}">${escapeHtml(sectionLabel)}</a></li>`);
      for (const h of src.headings) {
        if (h.level === 2) {
          items.push(`      <li class="sub"><a href="#${escapeHtml(h.id)}">${escapeHtml(h.text)}</a></li>`);
        } else if (h.level === 3) {
          items.push(`      <li class="sub-sub"><a href="#${escapeHtml(h.id)}">${escapeHtml(h.text)}</a></li>`);
        }
      }
    }
  }
  return items.join('\n');
}

function substitute(template, values) {
  return template.replace(/\{\{([a-zA-Z0-9_.]+)\}\}/g, (_, key) => {
    const parts = key.split('.');
    let v = values;
    for (const p of parts) {
      if (v && typeof v === 'object' && p in v) {
        v = v[p];
      } else {
        return '';
      }
    }
    return typeof v === 'string' ? v : String(v ?? '');
  });
}

function main() {
  const args = process.argv.slice(2);
  if (args.length !== 1) {
    fail('usage: node render.js <path-to-config.json>');
  }
  const configPath = path.resolve(args[0]);
  const config = readJson(configPath);

  // Determine the resolve root for relative source/output paths.
  // If config.basePath is set, use it (absolute as-is, or relative to configDir).
  // Otherwise fall back to configDir for backward compatibility with legacy
  // configs colocated next to their sources (e.g. welcome.json).
  const configDir = path.dirname(configPath);
  const resolveRoot = config.basePath
    ? (path.isAbsolute(config.basePath) ? config.basePath : path.resolve(configDir, config.basePath))
    : configDir;

  const sources = (config.sources || []).map((s) => ({
    ...s,
    path: path.isAbsolute(s.path) ? s.path : path.resolve(resolveRoot, s.path),
  }));
  if (sources.length === 0) {
    fail(`config '${configPath}' has no sources`);
  }

  const outputPath = path.isAbsolute(config.outputPath)
    ? config.outputPath
    : path.resolve(resolveRoot, config.outputPath);

  configureMarked();

  const renderedSources = sources.map((source) => {
    const rendered = renderSource(source);
    return { ...rendered, label: source.label };
  });

  const content = renderedSources.map((r) => r.sectionHtml).join('\n\n');
  const nav = buildNav(config, renderedSources);

  const template = readText(TEMPLATE_PATH);
  const style = readText(STYLE_PATH);

  const values = {
    title: config.title || 'STRAP',
    'brand.name': config.brand?.name || 'STRAP',
    'brand.version': config.brand?.version || '',
    'brand.tagline': config.brand?.tagline || '',
    nav,
    content,
    style,
    footer: config.footer || '',
  };

  const html = substitute(template, values);

  // Ensure output directory exists.
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, html, 'utf8');

  process.stdout.write(`Rendered ${renderedSources.length} source(s) to ${outputPath}\n`);
  process.stdout.write(`  Sources:\n`);
  for (const r of renderedSources) {
    process.stdout.write(`    - ${path.relative(process.cwd(), r.sourcePath)} (${r.headings.length} heading(s))\n`);
  }
}

main();

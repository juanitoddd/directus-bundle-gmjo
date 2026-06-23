import { BUTTON_SIZES } from '../block-tools/button-block';

const PLACEHOLDER_RE = /\{\{\s*([^}]+?)\s*\}\}/g;

/** Does a translation row match the requested language code? */
function matchesLanguage(row: any, language: string | undefined): boolean {
    if (!language || !row || typeof row !== 'object') return false;
    const code = row.languages_code;
    if (typeof code === 'string') return code === language;
    if (code && typeof code === 'object') return code.code === language;
    return false;
}

/**
 * When a path segment lands on an array, pick a single row to continue from.
 * Translation arrays (rows with `languages_code`) resolve to the row for the
 * requested language (falling back to the first); other arrays use the first row.
 */
function pickRowFromArray(arr: any[], language: string | undefined): any {
    if (!arr.length) return undefined;
    const isTranslation = arr.some((row) => row && typeof row === 'object' && 'languages_code' in row);
    if (isTranslation) {
        return arr.find((row) => matchesLanguage(row, language)) || arr[0];
    }
    return arr[0];
}

/**
 * Resolve a dot-path (e.g. "author.name" or "translations.biography") against an
 * item. Arrays encountered mid-path are reduced to a single row (translation by
 * language when applicable).
 */
function resolvePath(item: any, path: string, language?: string): any {
    return path.split('.').reduce((acc, key) => {
        if (acc == null) return acc;
        const target = Array.isArray(acc) ? pickRowFromArray(acc, language) : acc;
        return target == null ? target : target[key];
    }, item);
}

/** Heuristic: does a resolved value look like a Directus file object? */
function isFileObject(value: any): boolean {
    return !!value
        && typeof value === 'object'
        && (value.id !== undefined)
        && (value.filename_disk !== undefined || value.filename_download !== undefined
            || (typeof value.type === 'string' && value.type.startsWith('image')));
}

function ensureTrailingSlash(url: string): string {
    if (!url) return '';
    return url.endsWith('/') ? url : `${url}/`;
}

/**
 * Read a `{{ … }}` token starting at `open`, matching the closing `}}` while
 * accounting for nested `{{ … }}` (e.g. inside an image token's attribute).
 * Returns the inner content and the index just past the closing `}}`, or null.
 */
function readBraceToken(str: string, open: number): { content: string; end: number } | null {
    let depth = 0;
    let j = open;
    while (j < str.length) {
        if (str.startsWith('{{', j)) {
            depth++;
            j += 2;
        } else if (str.startsWith('}}', j)) {
            depth--;
            j += 2;
            if (depth === 0) return { content: str.slice(open + 2, j - 2), end: j };
        } else {
            j++;
        }
    }
    return null;
}

/** Pull the field + attribute placeholder paths out of an `image:` token body. */
function imageTokenPaths(content: string, add: (path: string) => void) {
    const body = content.slice('image:'.length);
    const commaIdx = body.indexOf(',');
    const field = (commaIdx === -1 ? body : body.slice(0, commaIdx)).trim();
    if (field) add(field);

    const attrStr = commaIdx === -1 ? '' : body.slice(commaIdx + 1);
    const re = new RegExp(PLACEHOLDER_RE.source, 'g');
    let m: RegExpExecArray | null;
    // eslint-disable-next-line no-cond-assign
    while ((m = re.exec(attrStr)) !== null) {
        const p = m[1].trim();
        if (p) add(p);
    }
}

/**
 * Collect every placeholder dot-path used in a template's blocks (recursively),
 * including paths nested inside an image token's attributes.
 */
export function collectTemplatePaths(blocks: any[] | undefined): string[] {
    const paths = new Set<string>();
    const add = (p: string) => paths.add(p);

    const scanString = (str: string) => {
        let i = 0;
        while (i < str.length) {
            const open = str.indexOf('{{', i);
            if (open === -1) break;
            const token = readBraceToken(str, open);
            if (!token) break;
            const content = token.content.trim();
            if (content.startsWith('image:')) imageTokenPaths(content, add);
            else if (content) add(content);
            i = token.end;
        }
    };

    const scan = (value: any) => {
        if (typeof value === 'string') scanString(value);
        else if (Array.isArray(value)) value.forEach(scan);
        else if (value && typeof value === 'object') Object.values(value).forEach(scan);
    };

    scan(blocks || []);
    return [...paths];
}

/**
 * Build the Directus `fields` query for a template: one level of expansion
 * (`*.*`, so relations/files come back as objects) plus any deeper dot-paths.
 */
export function deriveTemplateFields(blocks: any[] | undefined): string[] {
    const deep = collectTemplatePaths(blocks).filter((p) => p.split('.').length > 2);
    return ['*.*', ...deep];
}

/**
 * Replace `{{dot.path}}` placeholders in a template's blocks with values from
 * `item`. File-valued placeholders become asset URLs (or a full <img> when the
 * placeholder is the entire field value). Returns a new blocks array.
 */
export function interpolateTemplate(
    blocks: any[] | undefined,
    item: any,
    options: { assetBaseUrl?: string; language?: string } = {},
): any[] {
    const base = ensureTrailingSlash(options.assetBaseUrl || '');
    const language = options.language;
    const clone = JSON.parse(JSON.stringify(blocks || []));

    const assetUrl = (file: any) => `${base}assets/${file.id}`;

    const tokenValue = (path: string): string => {
        const value = resolvePath(item, path, language);
        if (value == null) return '';
        if (isFileObject(value)) return assetUrl(value);
        if (typeof value === 'object') return value.id != null ? String(value.id) : '';
        return String(value);
    };

    // Resolve a file field to an asset URL whether it comes back expanded
    // (object) or as a bare UUID string.
    const fileSrc = (value: any): string => {
        if (isFileObject(value)) return assetUrl(value);
        if (value && typeof value === 'object' && value.id != null) return assetUrl(value);
        if (typeof value === 'string' && value) return `${base}assets/${value}`;
        return '';
    };

    // Structured image token: image:<field>, alt="…", link="…", maxWidth="…", maxHeight="…"
    const renderImageToken = (content: string): string => {
        const body = content.slice('image:'.length);
        const commaIdx = body.indexOf(',');
        const field = (commaIdx === -1 ? body : body.slice(0, commaIdx)).trim();
        const attrStr = commaIdx === -1 ? '' : body.slice(commaIdx + 1);

        const attrs: Record<string, string> = {};
        const attrRe = /(\w+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
        let m: RegExpExecArray | null;
        // eslint-disable-next-line no-cond-assign
        while ((m = attrRe.exec(attrStr)) !== null) {
            attrs[m[1].toLowerCase()] = m[2] !== undefined ? m[2] : m[3];
        }

        const src = fileSrc(resolvePath(item, field, language));
        if (!src) return '';

        // Attribute values may mix static text with placeholders, e.g.
        // alt="This is {{first_name}} {{last_name}}".
        const interpAttr = (value: string) => value.replace(PLACEHOLDER_RE, (_m, p) => tokenValue(String(p).trim()));

        const styleMap: [string, string][] = [
            ['maxwidth', 'max-width'],
            ['maxheight', 'max-height'],
            ['width', 'width'],
            ['height', 'height'],
        ];
        const styles = styleMap
            .filter(([key]) => attrs[key])
            .map(([key, css]) => `${css}: ${interpAttr(attrs[key])}`);
        const styleAttr = styles.length ? ` style="${escapeHtml(styles.join('; '))}"` : '';

        const img = `<img src="${escapeHtml(src)}" alt="${escapeHtml(interpAttr(attrs.alt || ''))}"${styleAttr} />`;

        const link = interpAttr(attrs.link || '').trim();
        return link
            ? `<a href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer">${img}</a>`
            : img;
    };

    const renderToken = (content: string): string => {
        const trimmed = content.trim();
        return trimmed.startsWith('image:') ? renderImageToken(trimmed) : tokenValue(trimmed);
    };

    const interpolateString = (str: string): string => {
        // Whole-field single bare file placeholder → render a plain <img>.
        const single = str.trim().match(/^\{\{\s*([^}]+?)\s*\}\}$/);
        if (single && !single[1].trim().startsWith('image:')) {
            const value = resolvePath(item, single[1].trim(), language);
            if (isFileObject(value)) {
                return `<img src="${assetUrl(value)}" alt="" />`;
            }
        }

        // Brace-aware scan so tokens can contain nested {{ }} (e.g. image attrs).
        let result = '';
        let i = 0;
        while (i < str.length) {
            const open = str.indexOf('{{', i);
            if (open === -1) {
                result += str.slice(i);
                break;
            }
            result += str.slice(i, open);
            const token = readBraceToken(str, open);
            if (!token) {
                result += str.slice(open);
                break;
            }
            result += renderToken(token.content);
            i = token.end;
        }
        return result;
    };

    const walk = (value: any): any => {
        if (typeof value === 'string') return interpolateString(value);
        if (Array.isArray(value)) return value.map(walk);
        if (value && typeof value === 'object') {
            for (const key of Object.keys(value)) value[key] = walk(value[key]);
            return value;
        }
        return value;
    };

    return walk(clone);
}

export function escapeHtml(str: string) {
    if (!str && str !== '') return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Recursively render @editorjs/nested-list items. Each item is either a legacy
 * plain string or an object `{ content, items }` whose `items` are nested
 * children using the same list tag. `content` is treated as HTML (sanitized).
 */
function renderNestedList(items: any[] | undefined, tag: string, sanitize: (s: string) => string): string {
    if (!Array.isArray(items) || items.length === 0) return '';

    const lis = items.map((item) => {
        if (item == null) return '';

        if (typeof item === 'string') {
            return `<li>${sanitize(item)}</li>`;
        }

        const content = sanitize(item.content ?? '');
        const sublist = renderNestedList(item.items, tag, sanitize);
        return `<li>${content}${sublist}</li>`;
    }).join('');

    return `<${tag}>${lis}</${tag}>`;
}

/** Key for a resolved reference (collection + item id + template variant). */
export function referenceKey(collection: any, itemId: any, template?: any): string {
    return `${collection ?? ''}:${itemId ?? ''}:${template ?? ''}`;
}

/** Key for a resolved collection block (collection + template + query). */
export function collectionKey(data: any): string {
    const query = {
        filters: data?.filters || [],
        sort: data?.sort || null,
        limit: data?.limit || 0,
        container: data?.container || null,
    };
    return `coll:${data?.collection ?? ''}:${data?.template ?? ''}:${JSON.stringify(query)}`;
}

export interface BlocksToHtmlOptions {
    /**
     * Pre-resolved reference HTML keyed by `referenceKey(collection, itemId)`.
     * When a reference block's key is present, its resolved HTML is inlined;
     * otherwise a hydration placeholder is emitted.
     */
    references?: Record<string, string>;
}

export function blocksToHtml(blocks: any[] | undefined, options: BlocksToHtmlOptions = {}): string {
    if (!blocks || !Array.isArray(blocks) || blocks.length === 0) return '';

    const parts: string[] = [];

    // DOMPurify is used to sanitize HTML fragments inserted into previews.
    // Load it defensively so this code won't throw in non-browser or unexpected bundler setups.
    let sanitizer: ((s: string) => string) | null = null;
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const dp = require('dompurify');
        const lib = dp && dp.default ? dp.default : dp;
        if (typeof lib === 'function' && typeof window !== 'undefined') {
            // some builds export a factory: createDOMPurify(window)
            const inst = lib(window as any);
            sanitizer = (s: string) => inst.sanitize(s);
        }
        else if (lib && typeof lib.sanitize === 'function') {
            sanitizer = (s: string) => lib.sanitize(s);
        }
    }
    catch (e) {
        // ignore — sanitizer will remain null and we'll fallback to a safe option
    }

    // Fallback sanitizer: no-op (returns input) to avoid throwing. This keeps previews working
    // even if DOMPurify isn't available. If you want strict escaping, replace with `escapeHtml`.
    const sanitize = sanitizer || ((s: string) => s);

    for (const block of blocks) {
        const type = block.type;
        const data = block.data || {};
        const blockParts: string[] = [];
        
        switch (type) {
            case 'flexblock': {
                // Container layout comes from the Flex block tune (stored under
                // block.tunes.flex); per-item grow comes from each item.
                const tune = (block.tunes && block.tunes.flex) || {};
                const direction = tune.direction === 'column' ? 'column' : 'row';
                const justify = tune.justify || 'flex-start';
                const align = tune.align || 'center';

                const gap = tune.gap || '0.75rem';

                const containerStyle = [
                    'display: flex',
                    'flex-wrap: wrap',
                    `flex-direction: ${escapeHtml(direction)}`,
                    `justify-content: ${escapeHtml(justify)}`,
                    `align-items: ${escapeHtml(align)}`,
                    `gap: ${escapeHtml(gap)}`,
                ].join('; ');

                const items = Array.isArray(data.items) ? data.items : [];
                const children = items.map((item: any) => {
                    const inner = blocksToHtml(item?.content?.blocks || [], options);
                    const itemStyle = item?.grow ? 'flex: 1 1 0' : 'flex: 0 0 auto';
                    return `<div class="editorjs-flexblock__item" style="${itemStyle}">${inner}</div>`;
                }).join('');

                blockParts.push(`<div class="editorjs-flexblock" style="${containerStyle}">${children}</div>`);
                break;
            }

            case 'gridblock': {
                // Equal-width cells: the column count is stored on the block data
                // and always matches the number of cells.
                const items = Array.isArray(data.items) ? data.items : [];
                const columns = Math.max(1, Math.round(Number(data.columns) || items.length || 1));
                const alignItems = block.tunes?.grid?.alignItems;
                const gap = block.tunes?.grid?.gap || '0.75rem';
                const template = typeof data.columnTemplate === 'string' && data.columnTemplate.trim()
                    ? data.columnTemplate.trim()
                    : `repeat(${columns}, 1fr)`;

                const containerStyle = [
                    'display: grid',
                    `grid-template-columns: ${escapeHtml(template)}`,
                    `gap: ${escapeHtml(gap)}`,
                    ...(alignItems ? [`align-items: ${escapeHtml(alignItems)}`] : []),
                ].join('; ');

                const children = items.map((item: any) => {
                    const inner = blocksToHtml(item?.content?.blocks || [], options);
                    return `<div class="editorjs-gridblock__item">${inner}</div>`;
                }).join('');

                blockParts.push(`<div class="editorjs-gridblock" style="${containerStyle}">${children}</div>`);
                break;
            }

            case 'paragraph': {
                // Treat paragraph text as HTML, but sanitize it first
                const safe = sanitize(data.text || '');
                blockParts.push(`<p>${safe}</p>`);
                break;
            }                

            case 'header': {
                // Treat header text as HTML, sanitize it first
                const level = Math.min(6, Math.max(1, Number(data.level) || 2));
                const safe = sanitize(data.text || '');
                blockParts.push(`<h${level}>${safe}</h${level}>`);
                break;
            }            
            case 'list':
            case 'nestedlist': {
                const tag = data.style === 'ordered' ? 'ol' : 'ul';
                blockParts.push(renderNestedList(data.items, tag, sanitize));
                break;
            }

            case 'image': {
                const file = data.file || {};
                const url = data && (file.url || data.url || file.storage || file.filename || data.source || '');
                const caption = escapeHtml(data.caption || data.alt || '');

                if (url) {
                    // Mirror the custom image tunes (see plugins.ts ImageTool):
                    // max-width / max-height as inline styles, optional link wrapper.
                    const styleRules: string[] = [];
                    if (file.maxWidth) styleRules.push(`max-width: ${escapeHtml(String(file.maxWidth))}`);
                    if (file.maxHeight) styleRules.push(`max-height: ${escapeHtml(String(file.maxHeight))}`);
                    if (file.objectFit) styleRules.push(`object-fit: ${escapeHtml(String(file.objectFit))}`);
                    const styleAttr = styleRules.length ? ` style="${styleRules.join('; ')}"` : '';

                    const img = `<img src="${escapeHtml(url)}" alt="${caption}"${styleAttr} />`;

                    const link = typeof file.link === 'string' ? file.link.trim() : '';
                    if (link) {
                        blockParts.push(`<a href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer">${img}</a>`);
                    } else {
                        blockParts.push(img);
                    }
                }
                else if (file.id) {
                    blockParts.push(`<div>Image: ${escapeHtml(String(file.id))}</div>`);
                }
                break;
            }

            case 'htmlblock': {
                // Render raw HTML provided by a custom HTML block, but sanitize it
                const raw = data.html || data.source || data.content || '';
                const safe = sanitize(raw);
                blockParts.push(`<div class="editorjs-htmlblock">${safe}</div>`);
                break;
            }

            case 'button': {
                // Label is stored as HTML (inline tools), so sanitize rather than escape.
                const text = sanitize(data.text || 'Button');
                const href = escapeHtml(data.href || '#');
                const target = data.target === '_blank' ? '_blank' : '_self';
                const rel = target === '_blank' ? ' rel="noopener noreferrer"' : '';

                const preset = BUTTON_SIZES[data.size as keyof typeof BUTTON_SIZES] || BUTTON_SIZES.medium;
                const styleRules: string[] = [
                    'display: inline-block',
                    'text-decoration: none',
                    `padding: ${preset.padding}`,
                    `font-size: ${preset.fontSize}`,
                    `border-radius: ${preset.borderRadius}`,
                ];
                if (data.color) styleRules.push(`color: ${escapeHtml(String(data.color))}`);
                if (data.background) styleRules.push(`background-color: ${escapeHtml(String(data.background))}`);
                if (data.borderColor) styleRules.push(`border: 1px solid ${escapeHtml(String(data.borderColor))}`);
                // Hover background is exposed as a CSS var (the front-end needs a
                // rule like `.editorjs-button:hover { background: var(--btn-hover-bg) }`).
                // Default it to the base background so hover never goes transparent
                // when no explicit hover color is set.
                const hoverBg = data.hoverBackground || data.background;
                if (hoverBg) styleRules.push(`--btn-hover-bg: ${escapeHtml(String(hoverBg))}`);

                blockParts.push(
                    `<a class="editorjs-button" href="${href}" target="${target}"${rel} style="${styleRules.join('; ')}">${text}</a>`,
                );
                break;
            }

            case 'quote': {
                const caption = escapeHtml(data.caption || '');
                blockParts.push(`<blockquote><p>${escapeHtml(data.text || '')}</p>${caption ? `<cite>${caption}</cite>` : ''}</blockquote>`);
                break;
            }

            case 'delimiterblock': {
                const width = escapeHtml(String(data.width || '1px'));
                const color = escapeHtml(String(data.color || 'currentColor'));
                blockParts.push(`<hr class="editorjs-delimiter" style="border: none; border-top: ${width} solid ${color};" />`);
                break;
            }

            case 'reference': {
                // If the caller pre-resolved this reference (fetched item + template
                // and interpolated), inline that HTML; otherwise emit a hydration
                // placeholder for the front-end to fill in.
                const resolved = options.references?.[referenceKey(data.collection, data.itemId, data.template)];
                if (resolved != null) {
                    blockParts.push(resolved);
                } else {
                    blockParts.push(
                        `<div class="editorjs-reference" data-collection="${escapeHtml(String(data.collection || ''))}" data-item="${escapeHtml(String(data.itemId || ''))}" data-template="${escapeHtml(String(data.template || ''))}"></div>`,
                    );
                }
                break;
            }

            case 'collectionblock': {
                // Live collection: many items fetched by filter/sort/limit at render
                // time. Inline pre-resolved HTML if present; else a hydration
                // placeholder carrying the query for the front-end.
                const resolved = options.references?.[collectionKey(data)];
                if (resolved != null) {
                    blockParts.push(resolved);
                } else {
                    const query = JSON.stringify({ filters: data.filters || [], sort: data.sort || null, limit: data.limit || 0 });
                    blockParts.push(
                        `<div class="editorjs-collection" data-collection="${escapeHtml(String(data.collection || ''))}" data-template="${escapeHtml(String(data.template || ''))}" data-query="${escapeHtml(query)}"></div>`,
                    );
                }
                break;
            }

            default:
                // Fallback: render a small representation
                try {
                    blockParts.push(`<div class="editorjs-block-${escapeHtml(type)}">${escapeHtml(JSON.stringify(data || {}))}</div>`);
                }
                catch (e) {
                    blockParts.push(`<div class="editorjs-block-${escapeHtml(type)}">${escapeHtml(String(data))}</div>`);
                }
        }

        // Reflect block tunes (stored under block.tunes) as inline styles on a
        // single wrapper, mirroring the editor tunes.
        const styleRules: string[] = [];

        // Alignment: non-left alignments also force full width so text-align takes
        // effect inside shrink-to-fit flex/grid cells.
        const alignment = block.tunes?.alignment?.alignment;
        if (alignment && alignment !== 'left') {
            styleRules.push(`text-align: ${escapeHtml(alignment)}`, 'width: 100%');
        }

        // Spacing: per-side padding/margin.
        const spacing = block.tunes?.spacing;
        if (spacing) {
            for (const side of ['top', 'right', 'bottom', 'left']) {
                const pad = spacing.padding?.[side];
                if (pad) styleRules.push(`padding-${side}: ${escapeHtml(String(pad))}`);

                const margin = spacing.margin?.[side];
                if (margin) styleRules.push(`margin-${side}: ${escapeHtml(String(margin))}`);
            }
        }

        // Style: background, border, radius.
        const styleTune = block.tunes?.style;
        if (styleTune) {
            if (styleTune.background) styleRules.push(`background-color: ${escapeHtml(String(styleTune.background))}`);
            if (styleTune.borderStyle && styleTune.borderStyle !== 'none') {
                const width = escapeHtml(String(styleTune.borderWidth || '1px'));
                const color = escapeHtml(String(styleTune.borderColor || '#000'));
                styleRules.push(`border: ${width} ${escapeHtml(String(styleTune.borderStyle))} ${color}`);
            }
            if (styleTune.borderRadius) styleRules.push(`border-radius: ${escapeHtml(String(styleTune.borderRadius))}`);
        }

        let blockHtml = blockParts.join('');

        if (blockHtml && styleRules.length) {
            blockHtml = `<div style="${styleRules.join('; ')}">${blockHtml}</div>`;
        }

        parts.push(blockHtml);
    }

    return parts.join('');
}

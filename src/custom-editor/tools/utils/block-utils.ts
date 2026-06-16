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

export function blocksToHtml(blocks: any[] | undefined): string {
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
                    const inner = blocksToHtml(item?.content?.blocks || []);
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
                    const inner = blocksToHtml(item?.content?.blocks || []);
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

            case 'quote': {
                const caption = escapeHtml(data.caption || '');
                blockParts.push(`<blockquote><p>${escapeHtml(data.text || '')}</p>${caption ? `<cite>${caption}</cite>` : ''}</blockquote>`);
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

        let blockHtml = blockParts.join('');

        if (blockHtml && styleRules.length) {
            blockHtml = `<div style="${styleRules.join('; ')}">${blockHtml}</div>`;
        }

        parts.push(blockHtml);
    }

    return parts.join('');
}

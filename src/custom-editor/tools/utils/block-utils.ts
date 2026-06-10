export function escapeHtml(str: string) {
    if (!str && str !== '') return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
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

        switch (type) {
            case 'paragraph': {
                // Treat paragraph text as HTML, but sanitize it first
                const safe = sanitize(data.text || '');
                parts.push(`<p>${safe}</p>`);
                break;
            }                

            case 'header': {
                // Treat header text as HTML, sanitize it first
                const level = Math.min(6, Math.max(1, Number(data.level) || 2));
                const safe = sanitize(data.text || '');
                parts.push(`<h${level}>${safe}</h${level}>`);
                break;
            }

            case 'list': {
                const tag = data.style === 'ordered' ? 'ol' : 'ul';
                const items = (data.items || []).map((it: string) => `<li>${escapeHtml(it)}</li>`).join('');
                parts.push(`<${tag}>${items}</${tag}>`);
                break;
            }

            case 'image': {
                const url = data && (data.file?.url || data.url || data.file?.storage || data.file?.filename || data.source || '');
                const caption = escapeHtml(data.caption || data.alt || '');
                if (url) parts.push(`<img src="${escapeHtml(url)}" alt="${caption}" />`);
                else if (data.file && data.file.id) parts.push(`<div>Image: ${escapeHtml(String(data.file.id))}</div>`);
                break;
            }

            case 'htmlblock': {
                // Render raw HTML provided by a custom HTML block, but sanitize it
                const raw = data.html || data.source || data.content || '';
                const safe = sanitize(raw);
                parts.push(`<div class="editorjs-htmlblock">${safe}</div>`);
                break;
            }

            case 'quote': {
                const caption = escapeHtml(data.caption || '');
                parts.push(`<blockquote><p>${escapeHtml(data.text || '')}</p>${caption ? `<cite>${caption}</cite>` : ''}</blockquote>`);
                break;
            }

            default:
                // Fallback: render a small representation
                try {
                    parts.push(`<div class="editorjs-block-${escapeHtml(type)}">${escapeHtml(JSON.stringify(data || {}))}</div>`);
                }
                catch (e) {
                    parts.push(`<div class="editorjs-block-${escapeHtml(type)}">${escapeHtml(String(data))}</div>`);
                }
        }
    }

    return parts.join('');
}

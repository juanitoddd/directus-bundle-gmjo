import type {
    API,
    BlockAPI,
    BlockToolConstructorOptions,
    BlockToolData,
    BlockTune,
    ToolConfig,
} from '@editorjs/editorjs';

interface BlockClassData {
    className: string;
}

export class ClassWrapBlock implements BlockTune {
    private api: API;
    private block: BlockAPI | undefined;
    private config: ToolConfig | undefined;
    private data: BlockToolData<BlockClassData>;
    private wrapper: HTMLElement | undefined;

    constructor({ api, data, config, block }: BlockToolConstructorOptions) {
        this.api = api;
        this.block = block;
        this.config = config;

        if (data === undefined) {
            data = { className: this.getClass() };
        } else if (data.className === undefined) {
            data.className = this.getClass();
        }

        this.data = data;
    }

    static get isTune() {
        return true;
    }

    getClass() {
        if (this.config?.blocks && this.block && this.block.name in this.config.blocks) {
            return this.config.blocks[this.block.name] as string;
        }

        if (this.config?.default) {
            return this.config.default as string;
        }

        return '';
    }

    wrap(blockContent: HTMLElement) {
        this.wrapper = document.createElement('div');
        if (this.data.className) this.wrapper.classList.add(...this.data.className.split(' ').filter(Boolean));
        this.wrapper.append(blockContent);
        return this.wrapper;
    }

    render() {
        const wrapper = document.createElement('div');
        wrapper.classList.add('ce-class-wrap-buttons');

        const select = document.createElement('select');
        const options = (this.config?.options as string[] | undefined) || ['','muted','highlight','callout'];

        for (const opt of options) {
            const option = document.createElement('option');
            option.value = opt;
            option.textContent = opt === '' ? 'none' : opt;
            option.selected = opt === this.data.className;
            select.append(option);
        }

        select.addEventListener('change', () => {
            const prev = this.data.className || '';
            this.data.className = select.value;
            if (this.wrapper) {
                if (prev) this.wrapper.classList.remove(...prev.split(' ').filter(Boolean));
                if (this.data.className) this.wrapper.classList.add(...this.data.className.split(' ').filter(Boolean));
            }
            this.block?.dispatchChange();
        });

        wrapper.append(select);
        return wrapper;
    }

    save() {
        return this.data;
    }
}

// Inline tool -----------------------------------------------------------------
type ConstructorOpts = { api: API; config?: any } & any;

export class ClassWrapInline {
    api: API;
    private popup: HTMLElement | null = null;
    private currentRange: Range | null = null;
    private config: any;

    constructor({ api, config }: ConstructorOpts) {
        this.api = api;
        this.config = config || { options: ['custom-class'] };
    }

    static get isInline() {
        return true;
    }

    render() {
        const button = document.createElement('button');
        button.type = 'button';
        button.classList.add(this.api.styles.inlineToolButton || 'ce-inline-button');
        button.textContent = 'C';
        return button;
    }

    surround(range: Range) {
        this.currentRange = range.cloneRange();
        const options = Array.isArray(this.config.options) ? this.config.options : ['custom-class'];

        if (options.length === 1 && options[0]) {
            this.applyClass(options[0]);
            return;
        }

        this.showPopup(range);
    }

    checkState() {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return false;
        const anchorNode = selection.anchorNode as HTMLElement | null;
        if (!anchorNode) return false;
        const el = (anchorNode.nodeType === Node.TEXT_NODE ? anchorNode.parentElement : anchorNode) as HTMLElement | null;
        if (!el) return false;
        const cls = el.className;
        return !!cls;
    }

    showPopup(range: Range) {
        this.removePopup();

        const popup = document.createElement('div');
        popup.classList.add('ce-inline-classwrap-popup');
        popup.style.position = 'absolute';
        popup.style.zIndex = '9999';
        popup.style.background = '#fff';
        popup.style.border = '1px solid rgba(0,0,0,0.15)';
        popup.style.padding = '4px';
        popup.style.borderRadius = '4px';

        const select = document.createElement('select');
        const options = Array.isArray(this.config.options) ? this.config.options : ['custom-class'];

        for (const opt of options) {
            const optEl = document.createElement('option');
            optEl.value = opt;
            optEl.textContent = opt === '' ? 'none' : opt;
            select.append(optEl);
        }

        select.addEventListener('change', () => {
            const cls = select.value;
            this.applyClass(cls);
            this.removePopup();
        });

        popup.append(select);
        document.body.append(popup);
        this.popup = popup;

        const rect = range.getBoundingClientRect();
        popup.style.left = `${rect.left + window.scrollX}px`;
        popup.style.top = `${rect.top + window.scrollY - rect.height - 8}px`;
    }

    removePopup() {
        if (this.popup && this.popup.parentElement) this.popup.parentElement.removeChild(this.popup);
        this.popup = null;
    }

    applyClass(cls: string) {
        if (!this.currentRange) return;

        const range = this.currentRange.cloneRange();
        if (!cls) {
            // unwrap parent if it only contains this selection
            const container = range.commonAncestorContainer as HTMLElement;
            const parent = container.nodeType === Node.TEXT_NODE ? container.parentElement : (container as HTMLElement);
            if (parent && parent.className) parent.className = '';
            return;
        }

        const span = document.createElement('span');
        span.className = cls;
        span.appendChild(range.extractContents());
        range.insertNode(span);
        try {
            // @ts-ignore
            this.api.selection.expandToTag(span);
        } catch (e) {
            // ignore
        }
    }
}

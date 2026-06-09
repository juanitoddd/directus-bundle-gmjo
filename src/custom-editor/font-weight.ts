import type {
    API,
    BlockAPI,
    BlockToolConstructorOptions,
    BlockToolData,
    BlockTune,
    ToolConfig,
} from '@editorjs/editorjs';

interface BlockWeightData {
    weight: string;
}

export class FontWeightBlock implements BlockTune {
    private api: API;
    private block: BlockAPI | undefined;
    private config: ToolConfig | undefined;
    private data: BlockToolData<BlockWeightData>;
    private wrapper: HTMLElement | undefined;

    constructor({ api, data, config, block }: BlockToolConstructorOptions) {
        this.api = api;
        this.block = block;
        this.config = config;

        if (data === undefined) {
            data = { weight: this.getWeight() };
        } else if (data.weight === undefined) {
            data.weight = this.getWeight();
        }

        this.data = data;
    }

    static get isTune() {
        return true;
    }

    getWeight() {
        if (this.config?.blocks && this.block && this.block.name in this.config.blocks) {
            return this.config.blocks[this.block.name] as string;
        }

        if (this.config?.default) {
            return this.config.default as string;
        }

        return '400';
    }

    wrap(blockContent: HTMLElement) {
        this.wrapper = document.createElement('div');
        this.wrapper.style.fontWeight = this.data.weight;
        this.wrapper.append(blockContent);
        return this.wrapper;
    }

    render() {
        const wrapper = document.createElement('div');
        wrapper.classList.add('ce-font-weight-buttons');

        const select = document.createElement('select');
        const weights = ['100','200','300','400','500','600','700','800','900'];

        for (const w of weights) {
            const option = document.createElement('option');
            option.value = w;
            option.textContent = w === '400' ? `${w} (normal)` : w;
            option.selected = w === this.data.weight;
            select.append(option);
        }

        select.addEventListener('change', () => {
            this.data.weight = select.value;
            if (this.wrapper) this.wrapper.style.fontWeight = this.data.weight;
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
type ConstructorOpts = { api: API } & any;

export class FontWeightInline {
    api: API;
    private popup: HTMLElement | null = null;
    private currentRange: Range | null = null;

    constructor({ api }: ConstructorOpts) {
        this.api = api;
    }

    static get isInline() {
        return true;
    }

    render() {
        const button = document.createElement('button');
        button.type = 'button';
        button.classList.add(this.api.styles.inlineToolButton || 'ce-inline-button');
        button.textContent = 'W';
        return button;
    }

    surround(range: Range) {
        this.currentRange = range.cloneRange();
        this.showPopup(range);
    }

    checkState() {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return false;
        const anchorNode = selection.anchorNode as HTMLElement | null;
        if (!anchorNode) return false;
        const el = (anchorNode.nodeType === Node.TEXT_NODE ? anchorNode.parentElement : anchorNode) as HTMLElement | null;
        if (!el) return false;
        const fw = el.style && el.style.fontWeight;
        return !!fw;
    }

    showPopup(range: Range) {
        this.removePopup();

        const popup = document.createElement('div');
        popup.classList.add('ce-inline-fontweight-popup');
        popup.style.position = 'absolute';
        popup.style.zIndex = '9999';
        popup.style.background = '#fff';
        popup.style.border = '1px solid rgba(0,0,0,0.15)';
        popup.style.padding = '4px';
        popup.style.borderRadius = '4px';

        const select = document.createElement('select');
        const weights = ['inherit','100','200','300','400','500','600','700','800','900'];
        for (const w of weights) {
            const opt = document.createElement('option');
            opt.value = w;
            opt.textContent = w === 'inherit' ? 'default' : w;
            select.append(opt);
        }

        select.addEventListener('change', () => {
            const weight = select.value;
            this.applyWeight(weight);
            this.removePopup();
        });

        popup.append(select);
        document.body.append(popup);
        this.popup = popup;

        // position popup near selection
        const rect = range.getBoundingClientRect();
        popup.style.left = `${rect.left + window.scrollX}px`;
        popup.style.top = `${rect.top + window.scrollY - rect.height - 8}px`;
    }

    removePopup() {
        if (this.popup && this.popup.parentElement) {
            this.popup.parentElement.removeChild(this.popup);
        }
        this.popup = null;
    }

    applyWeight(weight: string) {
        if (!this.currentRange) return;

        const range = this.currentRange.cloneRange();
        if (weight === 'inherit') {
            // unwrap any span parent with fontWeight
            const container = range.commonAncestorContainer as HTMLElement;
            const parent = container.nodeType === Node.TEXT_NODE ? container.parentElement : container as HTMLElement;
            if (!parent) return;
            if (parent.style && parent.style.fontWeight) {
                parent.style.fontWeight = '';
            }
            return;
        }

        const span = document.createElement('span');
        span.style.fontWeight = weight;
        span.appendChild(range.extractContents());
        range.insertNode(span);
        try {
            // Expand selection to the newly created tag if available
            // (Editor.js provides expandToTag helper)
            // @ts-ignore
            this.api.selection.expandToTag(span);
        } catch (e) {
            // ignore if helper not present
        }
    }
}

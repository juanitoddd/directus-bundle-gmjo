import type { API, BlockAPI, BlockToolConstructorOptions, BlockToolData, BlockTune, ToolConfig } from '@editorjs/editorjs';

interface BlockFormatData {
    format: 'standard' | 'highlight' | 'callout' | 'muted';
}

export class BlockFormat implements BlockTune {
    private api: API;
    private block: BlockAPI | undefined;
    private config: ToolConfig | undefined;
    private data: BlockToolData<BlockFormatData>;
    private formatOptions = [
        {
            name: 'standard',
            title: 'Standard',
            css_class: 'ce-block-format-standard',
        },
        {
            name: 'highlight',
            title: 'Highlight',
            css_class: 'ce-block-format-highlight',
        },
        {
            name: 'callout',
            title: 'Callout',
            css_class: 'ce-block-format-callout',
        },
        {
            name: 'muted',
            title: 'Muted',
            css_class: 'ce-block-format-muted',
        },
    ];

    private wrapper: HTMLElement | undefined;

    constructor({ api, data, config, block }: BlockToolConstructorOptions) {
        this.api = api;
        this.block = block;
        this.config = config;

        if (data === undefined) {
            data = {
                format: this.getFormat(),
            };
        }
        else if (data.format === undefined) {
            data.format = this.getFormat();
        }

        this.data = data;
    }

    static get isTune() {
        return true;
    }

    getFormat() {
        if (this.config?.blocks && this.block?.name && this.block.name in this.config.blocks) {
            return this.config.blocks[this.block.name] as BlockFormatData['format'];
        }

        if (this.config?.default) {
            return this.config.default as BlockFormatData['format'];
        }

        return 'standard';
    }

    wrap(blockContent: HTMLElement) {
        this.wrapper = document.createElement('div');

        const formatOption = this.formatOptions.find((option) => option.name === this.data.format);
        if (formatOption) {
            this.wrapper.classList.add(formatOption.css_class);
        }

        this.wrapper.append(blockContent);
        return this.wrapper;
    }

    render() {
        const wrapper = document.createElement('div');
        wrapper.classList.add('ce-block-format-buttons');

        const buttons = this.formatOptions.map((option) => {
            const button = document.createElement('button');
            button.classList.add(this.api.styles.settingsButton);
            button.type = 'button';
            button.textContent = option.title;
            button.classList.toggle(this.api.styles.settingsButtonActive, option.name === this.data.format);
            wrapper.append(button);
            return button;
        });

        buttons.forEach((button, index) => {
            button.addEventListener('click', () => {
                const selected = this.formatOptions[index];
                this.data.format = selected.name as BlockFormatData['format'];

                this.block?.dispatchChange();

                for (const [optionIndex, element] of buttons.entries()) {
                    element.classList.toggle(
                        this.api.styles.settingsButtonActive,
                        optionIndex === index,
                    );
                }

                for (const option of this.formatOptions) {
                    this.wrapper?.classList.toggle(option.css_class, option.name === selected.name);
                }
            });
        });

        return wrapper;
    }

    save() {
        return this.data;
    }
}

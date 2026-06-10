import type { API, BlockAPI, BlockToolConstructorOptions, BlockToolData, BlockTune, ToolConfig } from '@editorjs/editorjs';

interface MarginData {
    margin: string;
}

export class Margin implements BlockTune {
    private api: API;
    private block: BlockAPI | undefined;
    private config: ToolConfig | undefined;
    private data: BlockToolData<MarginData>;
    private marginOptions = [
        {
            name: 'none',
            css_class: 'ce-margin-none',
            icon: '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#000000"><path d="M0 0h24v24H0z" fill="none"/><path d="M15 15H3v2h12v-2zm0-8H3v2h12V7zM3 13h18v-2H3v2zm0 8h18v-2H3v2zM3 3v2h18V3H3z"/></svg>',
        },
        {
            name: 'center',
            css_class: 'ce-align-center',
            icon: '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#000000"><path d="M0 0h24v24H0z" fill="none"/><path d="M7 15v2h10v-2H7zm-4 6h18v-2H3v2zm0-8h18v-2H3v2zm4-6v2h10V7H7zM3 3v2h18V3H3z"/></svg>',
        },
        {
            name: 'right',
            css_class: 'ce-align-right',
            icon: '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#000000"><path d="M0 0h24v24H0z" fill="none"/><path d="M3 21h18v-2H3v2zm6-4h12v-2H9v2zm-6-4h18v-2H3v2zm6-4h12V7H9v2zM3 3v2h18V3H3z"/></svg>',
        },
    ];

    private wrapper: HTMLElement | undefined;

    constructor({ api, data, config, block }: BlockToolConstructorOptions) {
        this.api = api;
        this.block = block;
        this.config = config;

        if (data === undefined) {
            data = {
                alignment: this.getAlignment(),
            };
        }
        else if (data.alignment === undefined) {
            data.alignment = this.getAlignment();
        }

        this.data = data;
    }

    static get isTune() {
        return true;
    }

    getAlignment() {
        if (this.config?.blocks && this.block!.name in this.config.blocks) {
            return this.config.blocks[this.block!.name];
        }

        if (this.config?.default) {
            return this.config.default;
        }

        return '0';
    }

    wrap(blockContent: HTMLElement) {
        this.wrapper = document.createElement('div');

        this.wrapper.classList.add(
            this.marginOptions.find((margin) => margin.name === this.data.margin)?.css_class as string,
        );

        this.wrapper.append(blockContent);
        return this.wrapper;
    }

    render() {
        const wrapper = document.createElement('div');
        wrapper.classList.add('ce-align-buttons');

        const buttons = this.marginOptions.map((margin) => {
            const button = document.createElement('button');
            button.classList.add(this.api.styles.settingsButton);
            button.innerHTML = margin.icon;
            button.type = 'button';

            button.classList.toggle(this.api.styles.settingsButtonActive, margin.name === this.data.margin);
            wrapper.append(button);
            return button;
        });

        for (const [index, element] of buttons.entries()) {
            element.addEventListener('click', () => {
                this.data.margin = this.marginOptions[index]?.name as string;

                this.block?.dispatchChange();

                for (const button of buttons ?? []) {
                    button.classList.toggle(this.api.styles.settingsButtonActive, button === element);
                }

                for (const { name, css_class } of this.marginOptions) {
                    this.wrapper?.classList.toggle(css_class, this.data.margin === name);
                }
            });
        }

        return wrapper;
    }

    save() {
        return this.data;
    }
}
import type { BlockToolConstructorOptions } from '@editorjs/editorjs';

interface ComponentBlockData {
	name: string;
}

export default class ComponentBlock {
	private data: ComponentBlockData;
	private block: any;
	private preview: HTMLElement | null = null;

	static get toolbox() {
		return {
			title: 'Component',
			icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3H5a2 2 0 0 0-2 2v5h3a2 2 0 1 1 0 4H3v5a2 2 0 0 0 2 2h5v-3a2 2 0 1 1 4 0v3h5a2 2 0 0 0 2-2v-5h-3a2 2 0 1 1 0-4h3V5a2 2 0 0 0-2-2h-5"/></svg>',
		};
	}

	constructor({ data, block }: BlockToolConstructorOptions) {
		this.block = block;
		this.data = { name: (data as Partial<ComponentBlockData> | undefined)?.name || '' };
	}

	render() {
		const wrapper = document.createElement('div');
		wrapper.classList.add('ce-component-block');

		const label = document.createElement('div');
		label.classList.add('ce-component-block__label');
		label.textContent = 'Custom component';
		wrapper.appendChild(label);

		const input = document.createElement('input');
		input.type = 'text';
		input.classList.add('ce-component-block__input');
		input.placeholder = 'component-name';
		input.value = this.data.name;
		input.addEventListener('input', () => {
			this.data.name = input.value.trim();
			this.renderPreview();
			this.block?.dispatchChange();
		});
		wrapper.appendChild(input);

		this.preview = document.createElement('div');
		this.preview.classList.add('ce-component-block__preview');
		wrapper.appendChild(this.preview);

		this.renderPreview();
		return wrapper;
	}

	private renderPreview() {
		if (!this.preview) return;
		this.preview.textContent = this.data.name ? `<${this.data.name} />` : 'No component name';
	}

	save(): ComponentBlockData {
		return this.data;
	}
}

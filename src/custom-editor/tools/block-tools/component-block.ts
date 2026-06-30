import type { BlockToolConstructorOptions } from '@editorjs/editorjs';

interface ComponentBlockData {
	name: string;
	params: Record<string, unknown>;
}

export default class ComponentBlock {
	private data: ComponentBlockData;
	private block: any;
	private preview: HTMLElement | null = null;
	private paramsWrap: HTMLElement | null = null;
	// Editing model for the key/value rows; synced into `data.params` (a Record).
	private paramEntries: { key: string; value: string }[] = [];

	static get toolbox() {
		return {
			title: 'Component',
			icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3H5a2 2 0 0 0-2 2v5h3a2 2 0 1 1 0 4H3v5a2 2 0 0 0 2 2h5v-3a2 2 0 1 1 4 0v3h5a2 2 0 0 0 2-2v-5h-3a2 2 0 1 1 0-4h3V5a2 2 0 0 0-2-2h-5"/></svg>',
		};
	}

	constructor({ data, block }: BlockToolConstructorOptions) {
		this.block = block;
		const incoming = data as Partial<ComponentBlockData> | undefined;
		const params = (incoming?.params && typeof incoming.params === 'object') ? incoming.params : {};
		this.data = {
			name: incoming?.name || '',
			params: { ...params },
		};
		this.paramEntries = Object.entries(this.data.params).map(([key, value]) => ({ key, value: String(value ?? '') }));
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
		input.placeholder = 'ComponentName';
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

	/** The "component tune": repeatable key/value parameter rows (props). */
	renderSettings(): HTMLElement {
		const panel = document.createElement('div');
		panel.classList.add('ce-component-tune');

		const title = document.createElement('div');
		title.classList.add('ce-component-tune__label');
		title.textContent = 'Parameters';
		panel.appendChild(title);

		this.paramsWrap = document.createElement('div');
		this.paramsWrap.classList.add('ce-component-tune__rows');
		panel.appendChild(this.paramsWrap);

		const addBtn = document.createElement('button');
		addBtn.type = 'button';
		addBtn.classList.add('ce-component-tune__add');
		addBtn.textContent = '+ Add parameter';
		addBtn.addEventListener('click', () => {
			this.paramEntries.push({ key: '', value: '' });
			this.renderParamRows();
		});
		panel.appendChild(addBtn);

		this.renderParamRows();
		return panel;
	}

	private syncParams() {
		const out: Record<string, unknown> = {};
		for (const entry of this.paramEntries) {
			const key = entry.key.trim();
			if (key) out[key] = entry.value;
		}
		this.data.params = out;
	}

	private renderParamRows() {
		if (!this.paramsWrap) return;
		this.paramsWrap.innerHTML = '';

		this.paramEntries.forEach((entry, index) => {
			const row = document.createElement('div');
			row.classList.add('ce-component-param-row');

			const keyInput = document.createElement('input');
			keyInput.type = 'text';
			keyInput.classList.add('ce-tune__input');
			keyInput.placeholder = 'key';
			keyInput.value = entry.key;
			keyInput.addEventListener('keydown', (e) => e.stopPropagation());
			keyInput.addEventListener('input', () => {
				entry.key = keyInput.value;
				this.syncParams();
				this.renderPreview();
			});
			keyInput.addEventListener('change', () => this.block?.dispatchChange());

			const valueInput = document.createElement('input');
			valueInput.type = 'text';
			valueInput.classList.add('ce-tune__input');
			valueInput.placeholder = 'value';
			valueInput.value = entry.value;
			valueInput.addEventListener('keydown', (e) => e.stopPropagation());
			valueInput.addEventListener('input', () => {
				entry.value = valueInput.value;
				this.syncParams();
				this.renderPreview();
			});
			valueInput.addEventListener('change', () => this.block?.dispatchChange());

			const removeBtn = document.createElement('button');
			removeBtn.type = 'button';
			removeBtn.classList.add('ce-component-param-row__remove');
			removeBtn.textContent = '×';
			removeBtn.addEventListener('click', () => {
				this.paramEntries.splice(index, 1);
				this.syncParams();
				this.renderParamRows();
				this.renderPreview();
				this.block?.dispatchChange();
			});

			row.append(keyInput, valueInput, removeBtn);
			this.paramsWrap!.appendChild(row);
		});
	}

	private renderPreview() {
		if (!this.preview) return;
		const name = this.data.name || 'Component';
		const propsStr = this.paramEntries
			.filter((p) => p.key.trim())
			.map((p) => `${p.key.trim()}="${p.value}"`)
			.join(' ');
		this.preview.textContent = `<${name}${propsStr ? ' ' + propsStr : ''} />`;
	}

	save(): ComponentBlockData {
		this.syncParams();
		return this.data;
	}
}

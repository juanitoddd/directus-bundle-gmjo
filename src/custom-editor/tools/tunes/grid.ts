import type { API, BlockAPI, BlockToolConstructorOptions, BlockTune } from '@editorjs/editorjs';

interface GridTuneData {
	alignItems: 'stretch' | 'flex-start' | 'center' | 'flex-end';
	gap?: string;
}

const alignOptions = [
	{ name: 'stretch', label: 'Stretch', icon: 'align-items-stretch' },
	{ name: 'flex-start', label: 'Top', icon: 'align-items-flex-start' },
	{ name: 'center', label: 'Center', icon: 'align-items-center' },
	{ name: 'flex-end', label: 'Bottom', icon: 'align-items-flex-end' },
];

export class Grid implements BlockTune {
	private api: API;
	private block: BlockAPI | undefined;
	private data: GridTuneData;
	private wrapper: HTMLElement | undefined;

	constructor({ api, data, block }: BlockToolConstructorOptions) {
		this.api = api;
		this.block = block;

		this.data = {
			alignItems: (data as GridTuneData)?.alignItems || 'stretch',
			gap: (data as GridTuneData)?.gap || '',
		};
	}

	static get isTune() {
		return true;
	}

	private updatePreviewStyle() {
		const preview = this.wrapper?.querySelector<HTMLElement>('.ce-grid-block__preview');
		if (!preview) {
			return;
		}
		preview.style.alignItems = this.data.alignItems;
		// Empty gap falls back to the CSS default on .ce-grid-block__preview.
		preview.style.gap = this.data.gap || '';
	}

	wrap(blockContent: HTMLElement) {
		this.wrapper = document.createElement('div');
		this.wrapper.classList.add('ce-grid-tune-wrapper');
		this.wrapper.append(blockContent);
		this.updatePreviewStyle();
		return this.wrapper;
	}

	render() {
		// Reuse the flex tune's group styling for visual consistency.
		const wrapper = document.createElement('div');
		wrapper.classList.add('ce-flex-tune');

		const alignGroup = this.createButtonGroup('Align Items', alignOptions, this.data.alignItems, (value) => {
			this.data.alignItems = value as GridTuneData['alignItems'];
			this.updatePreviewStyle();
			this.block?.dispatchChange();
		});

		wrapper.append(alignGroup);
		wrapper.append(this.createGapInput());
		return wrapper;
	}

	private createGapInput() {
		const group = document.createElement('div');
		group.classList.add('ce-flex-tune__group');

		const label = document.createElement('div');
		label.classList.add('ce-flex-tune__label');
		label.textContent = 'Gap';
		group.appendChild(label);

		const input = document.createElement('input');
		input.type = 'text';
		input.classList.add('ce-tune__input');
		input.placeholder = '0.75rem';
		input.value = this.data.gap || '';
		input.addEventListener('input', () => {
			this.data.gap = input.value.trim();
			this.updatePreviewStyle();
			this.block?.dispatchChange();
		});
		group.appendChild(input);

		return group;
	}

	private createButtonGroup(
		labelText: string,
		options: { name: string; label: string; icon: string }[],
		current: string,
		onChange: (value: string) => void,
	) {
		const group = document.createElement('div');
		group.classList.add('ce-flex-tune__group');

		const label = document.createElement('div');
		label.classList.add('ce-flex-tune__label');
		label.textContent = labelText;
		group.appendChild(label);

		for (const option of options) {
			const button = document.createElement('button');
			const icon = document.createElement('i');
			// The available icon classes are row-/column- prefixed; grid cell
			// alignment maps to the row variant (vertical cross-axis).
			icon.className = `flexicons-row-${option.icon}`;
			button.appendChild(icon);
			button.title = option.label;
			button.type = 'button';
			button.classList.add(this.api.styles.settingsButton);
			button.classList.toggle(this.api.styles.settingsButtonActive, current === option.name);
			button.addEventListener('click', () => {
				onChange(option.name);
				for (const sibling of group.querySelectorAll('button')) {
					sibling.classList.toggle(this.api.styles.settingsButtonActive, sibling === button);
				}
			});
			group.appendChild(button);
		}

		return group;
	}

	save() {
		return this.data;
	}
}

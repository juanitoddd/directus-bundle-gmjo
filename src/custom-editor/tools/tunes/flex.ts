import type { API, BlockAPI, BlockToolConstructorOptions, BlockTune, ToolConfig } from '@editorjs/editorjs';

interface FlexTuneData {
	direction: 'row' | 'column';
	justify: 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around';
	align: 'stretch' | 'flex-start' | 'center' | 'flex-end';
	gap?: string;
}

const directionOptions = [
	{ name: 'row', label: 'Row', icon: 'flex-direction-row' },
	{ name: 'column', label: 'Column', icon: 'flex-direction-column' },
];

const justifyOptions = [
	{ name: 'flex-start', label: 'Start', icon: 'justify-content-flex-start' },
	{ name: 'center', label: 'Center', icon: 'justify-content-center' },
	{ name: 'flex-end', label: 'End', icon: 'justify-content-flex-end' },
	{ name: 'space-between', label: 'Space Between', icon: 'justify-content-space-between' },
	{ name: 'space-around', label: 'Space Around', icon: 'justify-content-space-around' },
];

const alignOptions = [
	{ name: 'stretch', label: 'Stretch', icon: 'align-items-stretch' },
	{ name: 'flex-start', label: 'Top', icon: 'align-items-flex-start' },
	{ name: 'center', label: 'Center', icon: 'align-items-center' },
	{ name: 'flex-end', label: 'Bottom', icon: 'align-items-flex-end' },
];

export class Flex implements BlockTune {
	private api: API;
	private block: BlockAPI | undefined;
	private data: BlockToolConstructorOptions['data'] & FlexTuneData;
	private wrapper: HTMLElement | undefined;
	private buttonGroups = new Map<string, HTMLButtonElement[]>();

	private updatePreviewStyle() {
		const preview = this.wrapper?.querySelector<HTMLElement>('.ce-flex-block__preview');
		if (!preview) {
			return;
		}

		preview.style.display = 'flex';
		preview.style.flexWrap = 'wrap';
		preview.style.flexDirection = this.data.direction;
		preview.style.justifyContent = this.data.justify;
		preview.style.alignItems = this.data.align;
		// Empty gap falls back to the CSS default on .ce-flex-block__preview.
		preview.style.gap = this.data.gap || '';
	}

	constructor({ api, data, config, block }: BlockToolConstructorOptions) {
		this.api = api;
		this.block = block;

		if (data === undefined) {
			this.data = {
				direction: 'row',
				justify: 'flex-start',
				align: 'center',
			};
		} else {
			this.data = {
				direction: (data as FlexTuneData).direction || 'row',
				justify: (data as FlexTuneData).justify || 'flex-start',
				align: (data as FlexTuneData).align || 'center',
				gap: (data as FlexTuneData).gap || '',
			};
		}
	}

	static get isTune() {
		return true;
	}

	wrap(blockContent: HTMLElement) {
		this.wrapper = document.createElement('div');
		this.wrapper.classList.add('ce-flex-tune-wrapper');
		this.wrapper.append(blockContent);
		this.updatePreviewStyle();

		return this.wrapper;
	}

	render() {
		const wrapper = document.createElement('div');
		wrapper.classList.add('ce-flex-tune');

		const directionGroup = this.createButtonGroup('Direction', directionOptions, this.data.direction, (value) => {
			this.data.direction = value as FlexTuneData['direction'];
			this.updatePreviewStyle();
			this.refreshButtonGroup('Justify');
			this.refreshButtonGroup('Align');
			this.block?.dispatchChange();
		});

		const justifyGroup = this.createButtonGroup('Justify', justifyOptions, this.data.justify, (value) => {
			this.data.justify = value as FlexTuneData['justify'];
			this.updatePreviewStyle();
			this.block?.dispatchChange();
		});

		const alignGroup = this.createButtonGroup('Align', alignOptions, this.data.align, (value) => {
			this.data.align = value as FlexTuneData['align'];
			this.updatePreviewStyle();
			this.block?.dispatchChange();
		});

		wrapper.append(directionGroup);
		wrapper.append(justifyGroup);
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

private getCurrentValue(labelText: string) {
		switch (labelText) {
			case 'Direction':
				return this.data.direction;
			case 'Justify':
				return this.data.justify;
			case 'Align':
				return this.data.align;
			default:
				return '';
		}
	}

	private getIconClass(optionIcon: string, currentValue: string) {
		const same = this.data.direction === currentValue;
		return `flexicons-${same ? '' : this.data.direction + '-'}${optionIcon}`;
	}

	private refreshButtonGroup(labelText: string) {
		const buttons = this.buttonGroups.get(labelText);
		if (!buttons) return;

		const currentValue = this.getCurrentValue(labelText);

		for (const button of buttons) {
			const value = button.dataset.value || '';
			const icon = button.querySelector('i');
			if (icon) {
				icon.className = this.getIconClass(button.dataset.icon || '', value);
			}
			button.classList.toggle(this.api.styles.settingsButtonActive, value === currentValue);
		}
	}

	createButtonGroup(labelText: string, options: { name: string; label: string, icon: string }[], current: string, onChange: (value: string) => void) {
		const group = document.createElement('div');
		group.classList.add('ce-flex-tune__group');

		const label = document.createElement('div');
		label.classList.add('ce-flex-tune__label');
		label.textContent = labelText;
		group.appendChild(label);

		const buttons: HTMLButtonElement[] = [];

		for (const option of options) {
			const button = document.createElement('button');
			const icon = document.createElement('i');
			button.dataset.value = option.name;
			button.dataset.icon = option.icon;
			icon.className = this.getIconClass(option.icon, current);
			button.appendChild(icon);
			button.title = option.label;
			button.type = 'button';
			button.classList.add(this.api.styles.settingsButton);
			button.classList.toggle(this.api.styles.settingsButtonActive, current === option.name);
			button.addEventListener('click', () => {
				this.data = {
					...this.data,
					...(labelText === 'Direction' ? { direction: option.name } : {}),
					...(labelText === 'Justify' ? { justify: option.name } : {}),
					...(labelText === 'Align' ? { align: option.name } : {}),
				};
				onChange(option.name);

				for (const sibling of group.querySelectorAll('button')) {
					sibling.classList.toggle(this.api.styles.settingsButtonActive, sibling === button);
				}
			});
			group.appendChild(button);
			buttons.push(button);
		}

		this.buttonGroups.set(labelText, buttons);
		return group;
	}

	save() {
		return this.data;
	}
}

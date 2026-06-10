import type { API, BlockAPI, BlockToolConstructorOptions, BlockTune, ToolConfig } from '@editorjs/editorjs';

interface FlexTuneData {
	direction: 'row' | 'column';
	justify: 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around';
	align: 'stretch' | 'flex-start' | 'center' | 'flex-end';
}

const directionOptions = [
	{ name: 'row', label: 'Row' },
	{ name: 'column', label: 'Column' },
];

const justifyOptions = [
	{ name: 'flex-start', label: 'Start' },
	{ name: 'center', label: 'Center' },
	{ name: 'flex-end', label: 'End' },
	{ name: 'space-between', label: 'Space Between' },
	{ name: 'space-around', label: 'Space Around' },
];

const alignOptions = [
	{ name: 'stretch', label: 'Stretch' },
	{ name: 'flex-start', label: 'Top' },
	{ name: 'center', label: 'Center' },
	{ name: 'flex-end', label: 'Bottom' },
];

export class Flex implements BlockTune {
	private api: API;
	private block: BlockAPI | undefined;
	private data: BlockToolConstructorOptions['data'] & FlexTuneData;
	private wrapper: HTMLElement | undefined;

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

		const preview = this.wrapper.querySelector<HTMLElement>('.ce-flex-block__preview');
		if (preview) {
			preview.style.display = 'flex';
			preview.style.flexWrap = 'wrap';
			preview.style.flexDirection = this.data.direction;
			preview.style.justifyContent = this.data.justify;
			preview.style.alignItems = this.data.align;
			preview.style.gap = '0.75rem';
		}

		return this.wrapper;
	}

	render() {
		const wrapper = document.createElement('div');
		wrapper.classList.add('ce-flex-tune');

		wrapper.append(this.createButtonGroup('Direction', directionOptions, this.data.direction, (value) => {
			this.data.direction = value as FlexTuneData['direction'];
			this.block?.dispatchChange();
		}));

		wrapper.append(this.createButtonGroup('Justify', justifyOptions, this.data.justify, (value) => {
			this.data.justify = value as FlexTuneData['justify'];
			this.block?.dispatchChange();
		}));

		wrapper.append(this.createButtonGroup('Align', alignOptions, this.data.align, (value) => {
			this.data.align = value as FlexTuneData['align'];
			this.block?.dispatchChange();
		}));

		return wrapper;
	}

	createButtonGroup(labelText: string, options: { name: string; label: string }[], current: string, onChange: (value: string) => void) {
		const group = document.createElement('div');
		group.classList.add('ce-flex-tune__group');

		const label = document.createElement('div');
		label.classList.add('ce-flex-tune__label');
		label.textContent = labelText;
		group.appendChild(label);

		for (const option of options) {
			const button = document.createElement('button');
			button.type = 'button';
			button.classList.add(this.api.styles.settingsButton);
			button.textContent = option.label;
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
		}

		return group;
	}

	save() {
		return this.data;
	}
}

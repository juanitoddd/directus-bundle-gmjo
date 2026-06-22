export interface FlexConfig {
	direction: string;
	justify: string;
	align: string;
	gap?: string;
}

const SETTINGS_BUTTON = 'cdx-settings-button';
const SETTINGS_BUTTON_ACTIVE = 'cdx-settings-button--active';

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

/**
 * Build the flex option controls (direction / justify / align button groups +
 * gap input) used by the flex tune, reusable in other settings panels.
 * Mutates `data` in place and calls `onChange` after each change.
 */
export function createFlexControls(data: FlexConfig, onChange: () => void): HTMLElement {
	const wrapper = document.createElement('div');
	wrapper.classList.add('ce-flex-tune');

	const buttonGroups = new Map<string, HTMLButtonElement[]>();

	const getIconClass = (optionIcon: string, currentValue: string) => {
		const same = data.direction === currentValue;
		return `flexicons-${same ? '' : data.direction + '-'}${optionIcon}`;
	};

	const currentValueFor = (label: string) => {
		if (label === 'Direction') return data.direction;
		if (label === 'Justify') return data.justify;
		if (label === 'Align') return data.align;
		return '';
	};

	const refreshGroup = (label: string) => {
		const buttons = buttonGroups.get(label);
		if (!buttons) return;
		const current = currentValueFor(label);
		for (const button of buttons) {
			const value = button.dataset.value || '';
			const icon = button.querySelector('i');
			if (icon) icon.className = getIconClass(button.dataset.icon || '', value);
			button.classList.toggle(SETTINGS_BUTTON_ACTIVE, value === current);
		}
	};

	const createGroup = (
		label: string,
		options: { name: string; label: string; icon: string }[],
		current: string,
		onPick: (value: string) => void,
	) => {
		const group = document.createElement('div');
		group.classList.add('ce-flex-tune__group');

		const labelEl = document.createElement('div');
		labelEl.classList.add('ce-flex-tune__label');
		labelEl.textContent = label;
		group.appendChild(labelEl);

		const buttons: HTMLButtonElement[] = [];
		for (const option of options) {
			const button = document.createElement('button');
			const icon = document.createElement('i');
			button.dataset.value = option.name;
			button.dataset.icon = option.icon;
			icon.className = getIconClass(option.icon, current);
			button.appendChild(icon);
			button.title = option.label;
			button.type = 'button';
			button.classList.add(SETTINGS_BUTTON);
			button.classList.toggle(SETTINGS_BUTTON_ACTIVE, current === option.name);
			button.addEventListener('click', () => {
				onPick(option.name);
				for (const sibling of group.querySelectorAll('button')) {
					sibling.classList.toggle(SETTINGS_BUTTON_ACTIVE, sibling === button);
				}
			});
			group.appendChild(button);
			buttons.push(button);
		}

		buttonGroups.set(label, buttons);
		return group;
	};

	wrapper.appendChild(createGroup('Direction', directionOptions, data.direction, (value) => {
		data.direction = value;
		refreshGroup('Justify');
		refreshGroup('Align');
		onChange();
	}));
	wrapper.appendChild(createGroup('Justify', justifyOptions, data.justify, (value) => {
		data.justify = value;
		onChange();
	}));
	wrapper.appendChild(createGroup('Align', alignOptions, data.align, (value) => {
		data.align = value;
		onChange();
	}));

	const gapGroup = document.createElement('div');
	gapGroup.classList.add('ce-flex-tune__group');
	const gapLabel = document.createElement('div');
	gapLabel.classList.add('ce-flex-tune__label');
	gapLabel.textContent = 'Gap';
	const gapInput = document.createElement('input');
	gapInput.type = 'text';
	gapInput.classList.add('ce-tune__input');
	gapInput.placeholder = '0.75rem';
	gapInput.value = data.gap || '';
	gapInput.addEventListener('keydown', (e) => e.stopPropagation());
	gapInput.addEventListener('input', () => {
		data.gap = gapInput.value.trim();
		onChange();
	});
	gapGroup.appendChild(gapLabel);
	gapGroup.appendChild(gapInput);
	wrapper.appendChild(gapGroup);

	return wrapper;
}

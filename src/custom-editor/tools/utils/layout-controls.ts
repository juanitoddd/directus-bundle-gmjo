/**
 * Reusable flex/grid control builders, mirroring the Flex and Grid block tunes,
 * for use in the collection block's "Container" settings.
 */

export interface ContainerConfig {
	type: 'block' | 'flex' | 'grid';
	direction: string;
	justify: string;
	align: string;
	columns: number;
	alignItems: string;
	gap: string;
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

const ACTIVE = 'cdx-settings-button--active';
const BUTTON = 'cdx-settings-button';

function gapInput(data: ContainerConfig, onChange: () => void): HTMLElement {
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
	input.value = data.gap || '';
	input.addEventListener('keydown', (e) => e.stopPropagation());
	input.addEventListener('input', () => {
		data.gap = input.value.trim();
		onChange();
	});
	group.appendChild(input);
	return group;
}

function buttonGroup(
	labelText: string,
	options: { name: string; label: string; icon: string }[],
	getCurrent: () => string,
	iconClass: (option: string, value: string) => string,
	onPick: (value: string) => void,
): HTMLElement {
	const group = document.createElement('div');
	group.classList.add('ce-flex-tune__group');

	const label = document.createElement('div');
	label.classList.add('ce-flex-tune__label');
	label.textContent = labelText;
	group.appendChild(label);

	for (const option of options) {
		const button = document.createElement('button');
		button.type = 'button';
		button.classList.add(BUTTON);
		const icon = document.createElement('i');
		icon.className = iconClass(option.icon, option.name);
		button.appendChild(icon);
		button.title = option.label;
		button.classList.toggle(ACTIVE, getCurrent() === option.name);
		button.addEventListener('click', () => {
			onPick(option.name);
			for (const sibling of group.querySelectorAll('button')) {
				sibling.classList.toggle(ACTIVE, sibling === button);
			}
		});
		group.appendChild(button);
	}

	return group;
}

/** Flex controls: direction / justify / align + gap (mirrors the Flex tune). */
export function createFlexControls(data: ContainerConfig, onChange: () => void): HTMLElement {
	const wrapper = document.createElement('div');
	wrapper.classList.add('ce-flex-tune');

	// Direction-aware icon class, matching the Flex tune.
	const iconClass = (optionIcon: string) => `flexicons-${data.direction}-${optionIcon}`;

	wrapper.append(
		buttonGroup('Direction', directionOptions, () => data.direction, (icon) => `flexicons-${icon}`, (v) => {
			data.direction = v;
			onChange();
		}),
	);
	wrapper.append(
		buttonGroup('Justify', justifyOptions, () => data.justify, iconClass, (v) => {
			data.justify = v;
			onChange();
		}),
	);
	wrapper.append(
		buttonGroup('Align', alignOptions, () => data.align, iconClass, (v) => {
			data.align = v;
			onChange();
		}),
	);
	wrapper.append(gapInput(data, onChange));
	return wrapper;
}

/** Grid controls: columns + align-items + gap (mirrors the Grid tune + columns). */
export function createGridControls(data: ContainerConfig, onChange: () => void): HTMLElement {
	const wrapper = document.createElement('div');
	wrapper.classList.add('ce-flex-tune');

	const colsGroup = document.createElement('div');
	colsGroup.classList.add('ce-flex-tune__group');
	const colsLabel = document.createElement('div');
	colsLabel.classList.add('ce-flex-tune__label');
	colsLabel.textContent = 'Columns';
	colsGroup.appendChild(colsLabel);
	const colsInput = document.createElement('input');
	colsInput.type = 'number';
	colsInput.min = '1';
	colsInput.classList.add('ce-tune__input');
	colsInput.value = String(data.columns || 2);
	colsInput.addEventListener('keydown', (e) => e.stopPropagation());
	colsInput.addEventListener('input', () => {
		data.columns = Math.max(1, Number(colsInput.value) || 1);
		onChange();
	});
	colsGroup.appendChild(colsInput);
	wrapper.append(colsGroup);

	wrapper.append(
		buttonGroup('Align Items', alignOptions, () => data.alignItems, (icon) => `flexicons-row-${icon}`, (v) => {
			data.alignItems = v;
			onChange();
		}),
	);
	wrapper.append(gapInput(data, onChange));
	return wrapper;
}

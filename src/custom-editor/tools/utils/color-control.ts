import { EDITOR_COLORS } from './colors';

/** Coerce a color value to the `#rrggbb` form the native picker requires. */
function toHexColor(value: string | undefined): string {
	if (!value) return '#000000';
	const v = value.trim();
	const short = /^#([0-9a-fA-F]{3})$/.exec(v);
	if (short) {
		const [r, g, b] = short[1].split('');
		return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
	}
	return /^#([0-9a-fA-F]{6})$/.test(v) ? v.toLowerCase() : '#000000';
}

/**
 * Build a color editor: native picker + free-text input + palette swatches +
 * "None". `onPick(value, commit)` fires live (commit=false) while typing/dragging
 * and committed (commit=true) on change/swatch click.
 */
export function createColorControl(
	getValue: () => string | undefined,
	onPick: (value: string | undefined, commit: boolean) => void,
): HTMLElement {
	const wrap = document.createElement('div');
	wrap.classList.add('ce-style-tune');

	const row = document.createElement('div');
	row.classList.add('ce-color-input-row');

	const picker = document.createElement('input');
	picker.type = 'color';
	picker.classList.add('ce-color-input-row__picker');
	picker.value = toHexColor(getValue());

	const text = document.createElement('input');
	text.type = 'text';
	text.classList.add('ce-tune__input');
	text.placeholder = '#rrggbb / rgb() / var()';
	text.value = getValue() || '';

	const isHex = (v: string) => /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v);
	picker.addEventListener('input', () => { text.value = picker.value; onPick(picker.value, false); });
	picker.addEventListener('change', () => onPick(picker.value, true));
	text.addEventListener('keydown', (e) => e.stopPropagation());
	text.addEventListener('input', () => {
		if (isHex(text.value.trim())) picker.value = toHexColor(text.value.trim());
		onPick(text.value.trim() || undefined, false);
	});
	text.addEventListener('change', () => onPick(text.value.trim() || undefined, true));

	row.append(picker, text);
	wrap.append(row);

	const swatches = document.createElement('div');
	swatches.classList.add('ce-style-tune__swatches');

	const none = document.createElement('button');
	none.type = 'button';
	none.classList.add('ce-style-tune__swatch', 'is-none');
	none.title = 'None';
	none.addEventListener('click', () => { text.value = ''; onPick(undefined, true); });
	swatches.append(none);

	for (const color of EDITOR_COLORS) {
		const sw = document.createElement('button');
		sw.type = 'button';
		sw.classList.add('ce-style-tune__swatch');
		sw.style.background = color;
		sw.title = color;
		sw.addEventListener('click', () => { text.value = color; picker.value = toHexColor(color); onPick(color, true); });
		swatches.append(sw);
	}
	wrap.append(swatches);

	return wrap;
}

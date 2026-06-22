import type { API, BlockAPI, BlockToolConstructorOptions, BlockTune } from '@editorjs/editorjs';
import type { MenuConfig } from '@editorjs/editorjs/types/tools/menu-config';
import { EDITOR_COLORS } from '../utils/colors';

interface StyleData {
	background?: string;
	borderColor?: string;
	borderStyle?: string;
	borderWidth?: string;
	borderRadius?: string;
}

const BORDER_STYLES = ['none', 'solid', 'dashed', 'dotted', 'double'];

const BG_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18" stroke-width="1"/></svg>';
const BORDER_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" stroke-dasharray="3 3"/></svg>';
const RADIUS_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 20v-8a8 8 0 0 1 8-8h8"/></svg>';

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

export class Style implements BlockTune {
	private api: API;
	private block: BlockAPI | undefined;
	private data: StyleData;

	constructor({ api, data, block }: BlockToolConstructorOptions) {
		this.api = api;
		this.block = block;
		const incoming = (data as StyleData) || {};
		this.data = {
			background: incoming.background,
			borderColor: incoming.borderColor,
			borderStyle: incoming.borderStyle,
			borderWidth: incoming.borderWidth,
			borderRadius: incoming.borderRadius,
		};
	}

	static get isTune() {
		return true;
	}

	wrap(blockContent: HTMLElement) {
		// Apply to the block's own .ce-block__content rather than adding a wrapper.
		// The holder isn't mounted yet at wrap() time, so defer the first apply.
		requestAnimationFrame(() => this.applyStyle());
		return blockContent;
	}

	private target(): HTMLElement | null {
		const holder = (this.block as any)?.holder as HTMLElement | undefined;
		return (holder?.querySelector('.ce-block__content') as HTMLElement | null) || holder || null;
	}

	private applyStyle() {
		const el = this.target();
		if (!el) return;
		const s = el.style;
		s.backgroundColor = this.data.background || '';
		if (this.data.borderStyle && this.data.borderStyle !== 'none') {
			s.border = `${this.data.borderWidth || '1px'} ${this.data.borderStyle} ${this.data.borderColor || '#000'}`;
		} else {
			s.border = '';
		}
		s.borderRadius = this.data.borderRadius || '';
	}

	render(): MenuConfig {
		return [
			{
				icon: BG_ICON,
				title: 'Background',
				children: { searchable: false, items: [{ type: 'html', element: this.colorControl('background') }] },
			},
			{
				icon: BORDER_ICON,
				title: 'Border',
				children: { searchable: false, items: [{ type: 'html', element: this.borderControl() }] },
			},
			{
				icon: RADIUS_ICON,
				title: 'Radius',
				children: { searchable: false, items: [{ type: 'html', element: this.radiusControl() }] },
			},
		] as MenuConfig;
	}

	private set(key: keyof StyleData, value: string | undefined, commit: boolean) {
		this.data[key] = value || undefined;
		this.applyStyle();
		if (commit) this.block?.dispatchChange();
	}

	/** A color editor: native picker + text input + palette swatches + clear. */
	private colorRow(getValue: () => string | undefined, onPick: (color: string | undefined, commit: boolean) => void): HTMLElement {
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
		text.addEventListener('input', () => { if (isHex(text.value.trim())) picker.value = toHexColor(text.value.trim()); onPick(text.value.trim() || undefined, false); });
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

	private colorControl(key: 'background' | 'borderColor'): HTMLElement {
		return this.colorRow(() => this.data[key], (color, commit) => this.set(key, color, commit));
	}

	private borderControl(): HTMLElement {
		const wrap = document.createElement('div');
		wrap.classList.add('ce-style-tune');

		// Width
		const widthInput = document.createElement('input');
		widthInput.type = 'text';
		widthInput.classList.add('ce-tune__input');
		widthInput.placeholder = 'width (1px)';
		widthInput.value = this.data.borderWidth || '';
		widthInput.addEventListener('keydown', (e) => e.stopPropagation());
		widthInput.addEventListener('input', () => this.set('borderWidth', widthInput.value.trim() || undefined, false));
		widthInput.addEventListener('change', () => this.block?.dispatchChange());
		wrap.append(widthInput);

		// Style
		const styleSelect = document.createElement('select');
		styleSelect.classList.add('ce-reference-block__select');
		for (const style of BORDER_STYLES) {
			const opt = document.createElement('option');
			opt.value = style;
			opt.textContent = style;
			styleSelect.appendChild(opt);
		}
		styleSelect.value = this.data.borderStyle || 'none';
		styleSelect.addEventListener('change', () => this.set('borderStyle', styleSelect.value, true));
		wrap.append(styleSelect);

		// Color
		wrap.append(this.colorRow(() => this.data.borderColor, (color, commit) => this.set('borderColor', color, commit)));

		return wrap;
	}

	private radiusControl(): HTMLElement {
		const wrap = document.createElement('div');
		wrap.classList.add('ce-style-tune');

		const input = document.createElement('input');
		input.type = 'text';
		input.classList.add('ce-tune__input');
		input.placeholder = 'border radius (8px)';
		input.value = this.data.borderRadius || '';
		input.addEventListener('keydown', (e) => e.stopPropagation());
		input.addEventListener('input', () => this.set('borderRadius', input.value.trim() || undefined, false));
		input.addEventListener('change', () => this.block?.dispatchChange());
		wrap.append(input);

		return wrap;
	}

	save() {
		return this.data;
	}
}

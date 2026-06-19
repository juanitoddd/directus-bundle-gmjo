import type { BlockToolConstructorOptions } from '@editorjs/editorjs';
import type { MenuConfig } from '@editorjs/editorjs/types/tools/menu-config';
import { EDITOR_COLORS } from '../utils/colors';

type ButtonSize = 'small' | 'medium' | 'large';

interface ButtonBlockData {
	text: string;
	href: string;
	target: '_self' | '_blank';
	color?: string;
	background?: string;
	hoverBackground?: string;
	borderColor?: string;
	size: ButtonSize;
}

export const BUTTON_SIZES: Record<ButtonSize, { padding: string; fontSize: string; borderRadius: string }> = {
	small: { padding: '0.25rem 0.6rem', fontSize: '0.85rem', borderRadius: '0.25rem' },
	medium: { padding: '0.5rem 1.1rem', fontSize: '1rem', borderRadius: '0.375rem' },
	large: { padding: '0.75rem 1.6rem', fontSize: '1.2rem', borderRadius: '0.5rem' },
};

const LINK_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>';
const BORDER_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>';
const SIZE_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h18"/><path d="M6 12h12"/><path d="M9 17h6"/></svg>';

function colorSwatchIcon(color: string): string {
	return `<span style="display:inline-block;width:16px;height:16px;border-radius:3px;background:${color};border:1px solid rgba(127,127,127,0.4)"></span>`;
}

export default class ButtonBlock {
	private data: ButtonBlockData;
	private block: any;
	private colors: string[];
	private wrapper: HTMLElement | null = null;
	private link: HTMLAnchorElement | null = null;

	static get toolbox() {
		return {
			title: 'Button',
			icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="10" rx="3"/><path d="M7 12h10"/></svg>',
		};
	}

	constructor({ data, config, block }: BlockToolConstructorOptions) {
		this.block = block;
		this.colors = (config as any)?.colors || EDITOR_COLORS;

		const incoming = data as Partial<ButtonBlockData> | undefined;
		this.data = {
			text: incoming?.text || '',
			href: incoming?.href || '',
			target: incoming?.target === '_blank' ? '_blank' : '_self',
			color: incoming?.color,
			background: incoming?.background,
			hoverBackground: incoming?.hoverBackground,
			borderColor: incoming?.borderColor,
			size: (incoming?.size as ButtonSize) || 'medium',
		};
	}

	render() {
		this.wrapper = document.createElement('div');
		this.wrapper.classList.add('ce-button-block');

		this.link = document.createElement('a');
		this.link.classList.add('ce-button-block__link');
		this.link.contentEditable = 'true';
		// Stored as HTML so inline tools (color/weight/size/…) on the label survive.
		this.link.innerHTML = this.data.text || 'Button';
		this.link.setAttribute('href', this.data.href || '#');

		// Edit the label inline; don't navigate or split the block.
		this.link.addEventListener('click', (event) => event.preventDefault());
		this.link.addEventListener('keydown', (event) => {
			if (event.key === 'Enter') event.preventDefault();
		});
		this.link.addEventListener('input', () => {
			this.data.text = this.link?.innerHTML || '';
			this.block?.dispatchChange();
		});

		// Hover preview (inline styles can't express :hover).
		this.link.addEventListener('mouseenter', () => {
			if (this.data.hoverBackground && this.link) {
				this.link.style.backgroundColor = this.data.hoverBackground;
			}
		});
		this.link.addEventListener('mouseleave', () => {
			if (this.link) this.link.style.backgroundColor = this.data.background || '';
		});

		this.wrapper.appendChild(this.link);
		this.applyStyles();

		return this.wrapper;
	}

	private applyStyles() {
		const link = this.link;
		if (!link) return;

		const preset = BUTTON_SIZES[this.data.size] || BUTTON_SIZES.medium;
		link.style.padding = preset.padding;
		link.style.fontSize = preset.fontSize;
		link.style.borderRadius = preset.borderRadius;
		link.style.color = this.data.color || '';
		link.style.backgroundColor = this.data.background || '';
		link.style.border = this.data.borderColor ? `1px solid ${this.data.borderColor}` : '';
	}

	renderSettings(): MenuConfig {
		return [
			{
				icon: LINK_ICON,
				title: 'Link',
				children: {
					searchable: false,
					items: [
						{ type: 'html', element: this.createHrefInput() },
						{
							title: 'Open in same tab',
							isActive: this.data.target === '_self',
							closeOnActivate: true,
							onActivate: () => this.setTarget('_self'),
						},
						{
							title: 'Open in new tab',
							isActive: this.data.target === '_blank',
							closeOnActivate: true,
							onActivate: () => this.setTarget('_blank'),
						},
					],
				},
			},
			{
				icon: colorSwatchIcon(this.data.color || 'transparent'),
				title: 'Text color',
				children: { searchable: false, items: this.colorItems(this.data.color, (c, commit) => this.setColor('color', c, commit)) },
			},
			{
				icon: colorSwatchIcon(this.data.background || 'transparent'),
				title: 'Background',
				children: { searchable: false, items: this.colorItems(this.data.background, (c, commit) => this.setColor('background', c, commit)) },
			},
			{
				icon: colorSwatchIcon(this.data.hoverBackground || 'transparent'),
				title: 'Hover color',
				children: { searchable: false, items: this.colorItems(this.data.hoverBackground, (c, commit) => this.setColor('hoverBackground', c, commit)) },
			},
			{
				icon: BORDER_ICON,
				title: 'Border',
				children: { searchable: false, items: this.colorItems(this.data.borderColor, (c, commit) => this.setColor('borderColor', c, commit)) },
			},
			{
				icon: SIZE_ICON,
				title: 'Size',
				children: {
					searchable: false,
					items: (['small', 'medium', 'large'] as ButtonSize[]).map((size) => ({
						title: size.charAt(0).toUpperCase() + size.slice(1),
						isActive: this.data.size === size,
						closeOnActivate: true,
						onActivate: () => this.setSize(size),
					})),
				},
			},
		] as MenuConfig;
	}

	private colorItems(current: string | undefined, onPick: (color?: string, commit?: boolean) => void): any[] {
		const items: any[] = [
			{ type: 'html', element: this.createColorInput(current, onPick) },
			{
				title: 'None',
				isActive: !current,
				closeOnActivate: true,
				onActivate: () => onPick(undefined, true),
			},
		];

		for (const color of this.colors) {
			items.push({
				icon: colorSwatchIcon(color),
				title: color,
				name: `btn-swatch-${color}`,
				isActive: current === color,
				closeOnActivate: true,
				onActivate: () => onPick(color, true),
			});
		}

		return items;
	}

	/** Coerce a color value to the `#rrggbb` form the native picker requires. */
	private toHexColor(value: string | undefined): string {
		if (!value) return '#000000';
		const trimmed = value.trim();
		const short = /^#([0-9a-fA-F]{3})$/.exec(trimmed);
		if (short) {
			const [r, g, b] = short[1].split('');
			return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
		}
		return /^#([0-9a-fA-F]{6})$/.test(trimmed) ? trimmed.toLowerCase() : '#000000';
	}

	private createColorInput(current: string | undefined, onPick: (color?: string, commit?: boolean) => void): HTMLElement {
		const wrap = document.createElement('div');
		wrap.classList.add('ce-button-settings', 'ce-color-input-row');

		const picker = document.createElement('input');
		picker.type = 'color';
		picker.classList.add('ce-color-input-row__picker');
		picker.value = this.toHexColor(current);

		const input = document.createElement('input');
		input.type = 'text';
		input.classList.add('ce-tune__input');
		input.placeholder = '#rrggbb / rgb() / var()';
		input.value = current || '';

		const isHex = (v: string) => /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v);

		// Live preview while interacting (no commit); commit on change/blur.
		picker.addEventListener('input', () => {
			input.value = picker.value;
			onPick(picker.value, false);
		});
		picker.addEventListener('change', () => onPick(picker.value, true));

		input.addEventListener('keydown', (event) => event.stopPropagation());
		input.addEventListener('input', () => {
			const value = input.value.trim();
			// Keep the picker in sync only for hex values it can represent.
			if (isHex(value)) picker.value = this.toHexColor(value);
			onPick(value || undefined, false);
		});
		input.addEventListener('change', () => onPick(input.value.trim() || undefined, true));

		wrap.appendChild(picker);
		wrap.appendChild(input);
		return wrap;
	}

	private createHrefInput(): HTMLElement {
		const wrap = document.createElement('div');
		wrap.classList.add('ce-button-settings');

		const input = document.createElement('input');
		input.type = 'text';
		input.classList.add('ce-tune__input');
		input.placeholder = 'https://…';
		input.value = this.data.href || '';
		input.addEventListener('keydown', (event) => event.stopPropagation());
		// Update data live while typing, but commit (which re-renders the block)
		// only on change/blur — otherwise the popover input is destroyed mid-typing.
		input.addEventListener('input', () => {
			this.data.href = input.value.trim();
			this.link?.setAttribute('href', this.data.href || '#');
		});
		input.addEventListener('change', () => this.block?.dispatchChange());

		wrap.appendChild(input);
		return wrap;
	}

	private setTarget(target: ButtonBlockData['target']) {
		this.data.target = target;
		this.block?.dispatchChange();
	}

	private setColor(key: 'color' | 'background' | 'hoverBackground' | 'borderColor', color?: string, commit = true) {
		this.data[key] = color;
		this.applyStyles();
		// Only commit (which triggers the editor save/re-render pipeline) on
		// discrete actions — not on every keystroke, which would re-render the
		// block and destroy the open popover input mid-typing.
		if (commit) this.block?.dispatchChange();
	}

	private setSize(size: ButtonSize) {
		this.data.size = size;
		this.applyStyles();
		this.block?.dispatchChange();
	}

	save(): ButtonBlockData {
		// Read the live label HTML at save time: inline tools mutate the DOM
		// without firing an `input` event, so the cached value can be stale.
		if (this.link) {
			this.data.text = this.link.innerHTML;
		}
		return this.data;
	}
}

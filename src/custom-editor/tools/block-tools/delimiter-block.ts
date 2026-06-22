import type { BlockToolConstructorOptions } from '@editorjs/editorjs';
import type { MenuConfig } from '@editorjs/editorjs/types/tools/menu-config';
import { createColorControl } from '../utils/color-control';

interface DelimiterBlockData {
	color?: string;
	width?: string;
}

const DEFAULT_WIDTH = '1px';

const COLOR_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 0 0 18" fill="currentColor" stroke="none"/></svg>';
const WIDTH_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 12h18"/><path d="M3 8v8"/><path d="M21 8v8"/></svg>';

export default class DelimiterBlock {
	private data: DelimiterBlockData;
	private block: any;
	private line: HTMLHRElement | null = null;

	static get toolbox() {
		return {
			title: 'Delimiter',
			icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 12h18"/></svg>',
		};
	}

	constructor({ data, block }: BlockToolConstructorOptions) {
		this.block = block;
		const incoming = data as Partial<DelimiterBlockData> | undefined;
		this.data = {
			color: incoming?.color,
			width: incoming?.width || DEFAULT_WIDTH,
		};
	}

	render() {
		const wrapper = document.createElement('div');
		wrapper.classList.add('ce-delimiter-block');

		this.line = document.createElement('hr');
		this.line.classList.add('ce-delimiter-block__line');
		wrapper.appendChild(this.line);

		this.applyStyle();
		return wrapper;
	}

	private applyStyle() {
		if (!this.line) return;
		const width = this.data.width || DEFAULT_WIDTH;
		const color = this.data.color || 'currentColor';
		this.line.style.border = 'none';
		this.line.style.borderTop = `${width} solid ${color}`;
	}

	renderSettings(): MenuConfig {
		return [
			{
				icon: COLOR_ICON,
				title: 'Color',
				children: {
					searchable: false,
					items: [{ type: 'html', element: createColorControl(() => this.data.color, (c, commit) => this.setColor(c, commit)) }],
				},
			},
			{
				icon: WIDTH_ICON,
				title: 'Width',
				children: { searchable: false, items: [{ type: 'html', element: this.widthControl() }] },
			},
		] as MenuConfig;
	}

	private setColor(color: string | undefined, commit: boolean) {
		this.data.color = color;
		this.applyStyle();
		if (commit) this.block?.dispatchChange();
	}

	private widthControl(): HTMLElement {
		const wrap = document.createElement('div');
		wrap.classList.add('ce-style-tune');

		const input = document.createElement('input');
		input.type = 'text';
		input.classList.add('ce-tune__input');
		input.placeholder = '1px / 2px / 0.25rem';
		input.value = this.data.width || '';
		input.addEventListener('keydown', (e) => e.stopPropagation());
		input.addEventListener('input', () => {
			this.data.width = input.value.trim() || DEFAULT_WIDTH;
			this.applyStyle();
		});
		input.addEventListener('change', () => this.block?.dispatchChange());

		wrap.appendChild(input);
		return wrap;
	}

	save(): DelimiterBlockData {
		return this.data;
	}
}

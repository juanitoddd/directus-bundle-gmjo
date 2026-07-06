import type { BlockToolConstructorOptions } from '@editorjs/editorjs';
import type { MenuConfig } from '@editorjs/editorjs/types/tools/menu-config';

/**
 * Image Reference block.
 *
 * A template-time stand-in for an image whose `url`, `alt` and `link` are
 * dynamic `{{token}}` expressions (or static text). It carries the same
 * dimension / object-fit options as the normal image tool, but never picks a
 * real file — the tokens are resolved later, either by `interpolateTemplate`
 * (CMS preview, given an item) or by the front-end at render time.
 */
interface ImageReferenceData {
	url?: string;
	alt?: string;
	link?: string;
	widthDesktop?: string;
	heightDesktop?: string;
	maxWidth?: string;
	maxHeight?: string;
	objectFit?: string;
	widthMobile?: string;
	heightMobile?: string;
	maxWidthMobile?: string;
	maxHeightMobile?: string;
}

const CONTENT_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.5-3.5a2 2 0 0 0-3 0L5 21"/></svg>';
const DIMENSIONS_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8V5a2 2 0 0 1 2-2h3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M21 16v3a2 2 0 0 1-2 2h-3"/></svg>';
const FIT_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><rect x="8" y="8" width="8" height="8" rx="1"/></svg>';

export default class ImageReferenceBlock {
	private data: ImageReferenceData;
	private block: any;
	private wrapper: HTMLElement | null = null;

	static get toolbox() {
		return {
			title: 'Image Reference',
			icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.5-3.5a2 2 0 0 0-3 0L5 21"/></svg>',
		};
	}

	constructor({ data, block }: BlockToolConstructorOptions) {
		this.block = block;
		const incoming = (data || {}) as Partial<ImageReferenceData>;
		this.data = { ...incoming };
	}

	render() {
		this.wrapper = document.createElement('div');
		this.wrapper.classList.add('ce-image-ref');
		this.paint();
		return this.wrapper;
	}

	/** Render the editor placeholder card reflecting the current token values. */
	private paint() {
		if (!this.wrapper) return;
		this.wrapper.innerHTML = '';

		const icon = document.createElement('div');
		icon.classList.add('ce-image-ref__icon');
		icon.innerHTML = CONTENT_ICON;
		this.wrapper.appendChild(icon);

		const meta = document.createElement('div');
		meta.classList.add('ce-image-ref__meta');

		const src = document.createElement('div');
		src.classList.add('ce-image-ref__src');
		src.textContent = this.data.url ? this.data.url : 'No source set — open the ⚙ menu';
		if (!this.data.url) src.classList.add('ce-image-ref__placeholder');
		meta.appendChild(src);

		const detail = document.createElement('div');
		detail.classList.add('ce-image-ref__detail');
		const bits: string[] = [];
		if (this.data.alt) bits.push(`alt: ${this.data.alt}`);
		if (this.data.link) bits.push(`link: ${this.data.link}`);
		detail.textContent = bits.join('  ·  ');
		if (bits.length) meta.appendChild(detail);

		this.wrapper.appendChild(meta);
	}

	renderSettings(): MenuConfig {
		const content = {
			icon: CONTENT_ICON,
			title: 'Content',
			children: { searchable: false, items: [{ type: 'html', element: this.contentPanel() }] },
		};

		const dimensions = {
			icon: DIMENSIONS_ICON,
			title: 'Dimensions',
			children: { searchable: false, items: [{ type: 'html', element: this.dimensionsPanel() }] },
		};

		const objectFit = {
			icon: FIT_ICON,
			title: 'Object Fit',
			children: { searchable: false, items: this.objectFitItems() },
		};

		return [content, dimensions, objectFit] as MenuConfig;
	}

	private setAttr(key: keyof ImageReferenceData, value: string) {
		this.data[key] = value;
		this.paint();
	}

	/** Source / Alt / Link token fields. */
	private contentPanel(): HTMLElement {
		const wrap = document.createElement('div');
		wrap.classList.add('ce-image-dimensions');

		const fields: [keyof ImageReferenceData, string, string][] = [
			['url', 'Source', '{{image}} or https://…'],
			['alt', 'Alt', '{{title}}'],
			['link', 'Link', '{{slug}} (optional)'],
		];

		for (const [key, label, placeholder] of fields) {
			const field = document.createElement('label');
			field.classList.add('ce-image-dimensions__field');

			const span = document.createElement('span');
			span.classList.add('ce-image-dimensions__label');
			span.textContent = label;
			field.appendChild(span);

			const input = document.createElement('input');
			input.type = 'text';
			input.classList.add('ce-tune__input');
			input.placeholder = placeholder;
			input.value = (this.data[key] as string) || '';
			input.addEventListener('keydown', (e) => e.stopPropagation());
			input.addEventListener('input', () => this.setAttr(key, input.value.trim()));
			input.addEventListener('change', () => this.block?.dispatchChange?.());
			field.appendChild(input);

			wrap.appendChild(field);
		}

		return wrap;
	}

	/** Dimensions inputs, grouped into Desktop and Mobile sections. */
	private dimensionsPanel(): HTMLElement {
		const wrap = document.createElement('div');
		wrap.classList.add('ce-image-dimensions');

		const sections: { label: string; fields: [keyof ImageReferenceData, string][] }[] = [
			{
				label: 'Desktop',
				fields: [['widthDesktop', 'Width'], ['heightDesktop', 'Height'], ['maxWidth', 'Max width'], ['maxHeight', 'Max height']],
			},
			{
				label: 'Mobile (≤ 640px)',
				fields: [['widthMobile', 'Width'], ['heightMobile', 'Height'], ['maxWidthMobile', 'Max width'], ['maxHeightMobile', 'Max height']],
			},
		];

		for (const section of sections) {
			const heading = document.createElement('div');
			heading.classList.add('ce-image-dimensions__section');
			heading.textContent = section.label;
			wrap.appendChild(heading);

			for (const [key, label] of section.fields) {
				const field = document.createElement('label');
				field.classList.add('ce-image-dimensions__field');

				const span = document.createElement('span');
				span.classList.add('ce-image-dimensions__label');
				span.textContent = label;
				field.appendChild(span);

				const input = document.createElement('input');
				input.type = 'text';
				input.classList.add('ce-tune__input');
				input.placeholder = '200px / 50% / auto';
				input.value = (this.data[key] as string) || '';
				input.addEventListener('keydown', (e) => e.stopPropagation());
				input.addEventListener('input', () => this.setAttr(key, input.value.trim()));
				input.addEventListener('change', () => this.block?.dispatchChange?.());
				field.appendChild(input);

				wrap.appendChild(field);
			}
		}

		return wrap;
	}

	private objectFitItems(): any[] {
		const options = [
			{ value: '', label: 'Default' },
			{ value: 'fill', label: 'Fill' },
			{ value: 'contain', label: 'Contain' },
			{ value: 'cover', label: 'Cover' },
			{ value: 'none', label: 'None' },
			{ value: 'scale-down', label: 'Scale down' },
		];
		const current = this.data.objectFit || '';
		return options.map((option) => ({
			title: option.label,
			isActive: current === option.value,
			closeOnActivate: true,
			onActivate: () => {
				this.setAttr('objectFit', option.value);
				this.block?.dispatchChange?.();
			},
		}));
	}

	save(): ImageReferenceData {
		return this.data;
	}
}

import { API } from '@editorjs/editorjs';
import { applyStyledSpan } from './inline-utils';

type FontSizePickerConfig = {
	sizes: string[];
};

interface ConstructorArgs {
	api: API;
	config: FontSizePickerConfig;
}

export default class FontSizePicker implements EditorJS.InlineTool {
	private api: API;

	tag = 'SPAN';
	class = 'cdx-text-size';

	lastRange: Range | null = null;

	sizes: string[] = [
		'12px',
		'14px',
		'16px',
		'18px',
		'20px',
		'24px',
		'28px',
		'32px',
		'40px',
		'48px',
	];

	select: HTMLSelectElement | null = null;
	currentSize: string = '';

	static get title() {
		return 'Font Size';
	}

	static get isInline() {
		return true;
	}

	constructor(args: ConstructorArgs) {
		const { api, config } = args;
		this.api = api;

		if (config?.sizes?.length) {
			this.sizes = config.sizes;
		}
	}

	render() {
		const activeSize = this.getSelectionSize();
		this.currentSize = activeSize ?? '';

		if (!this.select) {
			this.select = document.createElement('select');
			this.select.classList.add('ce-flex-block__select');

			const defaultOption = document.createElement('option');
			defaultOption.value = '';
			defaultOption.textContent = 'Default';
			this.select.appendChild(defaultOption);

			this.sizes.forEach((size) => {
				const option = document.createElement('option');
				option.value = size;
				option.textContent = size;
				this.select!.appendChild(option);
			});

			this.select.addEventListener('change', () => {
				// An empty value (the "Default" option) clears the size: the
				// helper writes an empty style which cleanupSpans then unwraps.
				const value = this.select?.value ?? '';
				this.currentSize = value;
				this.wrapAndSize(this.lastRange, value);
				this.select!.value = value;
			});
		}

		// Reflect the current selection's size on every render.
		this.select.value = this.currentSize;

		return this.select;
	}

	surround(range: Range | null) {
		this.lastRange = range;
	}

	wrapAndSize(range: Range | null, size: string) {
		applyStyledSpan(range, size, { className: this.class, styleProperty: 'fontSize' }, this.api);
	}

	/**
	 * Read the explicitly applied font-size from the closest ancestor span of
	 * our class. Returns null when no explicit size is set (so the dropdown
	 * falls back to "Default" rather than the inherited base size).
	 */
	getSelectionSize(): string | null {
		const selection = window.getSelection();
		if (!selection || selection.rangeCount === 0) {
			return null;
		}

		const node = selection.anchorNode;
		if (!node) {
			return null;
		}

		let element = node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as HTMLElement | null);
		while (element) {
			if (element.classList?.contains(this.class) && element.style.fontSize) {
				return element.style.fontSize;
			}
			element = element.parentElement;
		}

		return null;
	}

	/**
	 * Sanitizer rules
	 *
	 * @returns {object}
	 */
	static get sanitize(): any {
		return {
			span: {
				style: {
					fontSize: true,
				},
			},
		};
	}
}

export class FontSizePickerWithoutSanitize extends FontSizePicker {
	static override get sanitize() {
		return undefined;
	}
}

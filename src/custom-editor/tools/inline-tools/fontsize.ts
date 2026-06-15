import { API } from '@editorjs/editorjs';
import type { MenuConfig } from '@editorjs/editorjs/types/tools/menu-config';
import { applyStyledSpan, buildInlineMenu, captureSelectionRange } from './inline-utils';

const FONT_SIZE_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7V5h11v2"/><path d="M9.5 5v14"/><path d="M7 19h5"/><path d="M16 13v-1h6v1"/><path d="M19 12v7"/><path d="M17.5 19h3"/></svg>';

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

	render(): MenuConfig {
		this.lastRange = captureSelectionRange();
		const current = this.getSelectionSize() ?? '';

		return buildInlineMenu({
			icon: FONT_SIZE_ICON,
			// title: current || 'Font Size',
			title: '',
			currentValue: current,
			options: [
				{ value: '', label: 'Default' },
				...this.sizes.map((size) => ({ value: size, label: size })),
			],
			// An empty value (the "Default" option) clears the size: the helper
			// writes an empty style which cleanupSpans then unwraps.
			onSelect: (value) => this.wrapAndSize(this.lastRange, value),
		});
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

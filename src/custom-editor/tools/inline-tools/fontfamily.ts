import { API } from '@editorjs/editorjs';
import { applyStyledSpan } from './inline-utils';

type FontFamilyPickerConfig = {
	families: string[];
	columns: number;
};

interface ConstructorArgs {
	api: API;
	config: FontFamilyPickerConfig;
}

export default class FontFamilyPicker implements EditorJS.InlineTool {
	private api: API;

	tag = 'SPAN';
	class = 'cdx-text-family';
	defaultFamily = 'GTEestiProText';

	lastRange: Range | null = null;

	families: string[] = [
		'GTEestiProText',
		'Roboto',
		'Arial',
		'Helvetica',
		'Georgia',
		'Times New Roman',
		'Courier New',
	];

	familiesClassMap: Record<string, string> = {
		'GTEestiProText': 'gteesti-pro-text',
		'Roboto': 'roboto',
		'Arial': 'arial',
		'Helvetica': 'helvetica',
		'Georgia': 'georgia',
		'Times New Roman': 'times-new-roman',
		'Courier New': 'courier-new',
	};

	columns = 9;

	select: HTMLSelectElement | null = null;
	currentFamily: string | null = null;

	static get title() {
		return 'Font Families';
	}

	static get isInline() {
		return true;
	}

	constructor(args: ConstructorArgs) {
		const { api, config } = args;
		this.api = api;

		if (config.families) {
			this.families = config.families;
		}
		if (config.columns) {
			this.columns = config.columns;
		}
	}

	render() {
		const activeFamily = this.getSelectionFamily();
		if (activeFamily) {
			this.currentFamily = activeFamily;
		}

		if (!this.select) {
			this.select = document.createElement('select');
			this.select.classList.add('ce-flex-block__select');

			this.families.forEach((family) => {
				const option = document.createElement('option');
				option.value = family;
				option.textContent = family;
				if (this.currentFamily === family) {
					option.selected = true;
				}
				this.select!.appendChild(option);
			});

			this.select.addEventListener('change', () => {
				const value = this.select?.value;
				if (value) {
					this.currentFamily = value;
					this.wrapAndFamily(this.lastRange, value);
					this.select!.value = value;
					console.log("Selected font family:", value);
				}
			});
		} else if (this.currentFamily) {
			this.select.value = this.currentFamily;
		}

		return this.select;
	}

	surround(range: Range | null) {
		this.lastRange = range;
	}

	wrapAndFamily(range: Range | null, family: string) {
		applyStyledSpan(range, family, { className: this.class, styleProperty: 'fontFamily' }, this.api);
	}

	getSelectionFamily(): string | null {
		const selection = window.getSelection();
		if (!selection || selection.rangeCount === 0) {
			return null;
		}

		let node = selection.anchorNode;
		if (!node) {
			return null;
		}

		let element = node.nodeType === Node.TEXT_NODE ? node.parentElement : node as HTMLElement | null;
		while (element) {
			const fontFamily = window.getComputedStyle(element).fontFamily;
			const normalized = this.normalizeFamily(fontFamily);
			if (normalized) {
				return normalized;
			}
			element = element.parentElement;
		}

		return null;
	}

	normalizeFamily(fontFamily: string): string | null {
		if (!fontFamily) {
			return null;
		}

		const familyName = fontFamily.split(',')[0].trim().replace(/^['"]|['"]$/g, '');
		if (!familyName) {
			return null;
		}

		const match = this.families.find((family) => {
			const candidate = family.split(',')[0].trim().replace(/^['"]|['"]$/g, '');
			return candidate.toLowerCase() === familyName.toLowerCase();
		});

		return match ?? null;
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
					fontFamily: true,
				},
				// class: true
			},
		};
	}
}

export class FontFamilyPickerWithoutSanitize extends FontFamilyPicker {
	static override get sanitize() {
		return undefined;
	}
}
import { API } from '@editorjs/editorjs';
import { IconBold, IconColor } from '@codexteam/icons';

type WeightPickerConfig = {
	weights: Record<number, string>;
	columns: number;
};

interface ConstructorArgs {
	api: API;
	config: WeightPickerConfig;
}

export default class WeightPicker implements EditorJS.InlineTool {
	private api: API;

	tag = 'SPAN';
	class = 'cdx-text-weight';
	defaultWeight = '#2644FF';

	lastRange: Range | null = null;

	weights: Record<number, string> = {
		900: 'Black',
		800: 'Extra-Bold',
		700: 'Bold',
		600: 'Semi-bold',
		500: 'Medium',
		400: 'Regular',
		300: 'Light',
		200: 'Extra-light',
		100: 'Thin'
	};	

	select: HTMLSelectElement | null = null;
	currentWeight: string | null = null;

	static get title() {
		return 'Weights';
	}

	static get isInline() {
		return true;
	}

	constructor(args: ConstructorArgs) {
		const { api, config } = args;
		this.api = api;

		if (config.weights) {
			this.weights = config.weights;
		}		
	}

	render() {
		const activeWeight = this.getSelectionWeight();
		if (activeWeight) {
			this.currentWeight = activeWeight;
		}

		if (!this.select) {
			console.log("Rendering WeightPicker:");

			this.select = document.createElement('select');
			this.select.classList.add('ce-flex-block__select');
			Object.entries(this.weights).forEach(([value, weight]) => {
				const option = document.createElement('option');
				option.value = value;
				option.textContent = weight;
				if (this.currentWeight === value) {
					option.selected = true;
				}
				if(this.select) this.select.appendChild(option);
			});
			this.select.addEventListener('change', () => {
				const value = this.select?.value;
				if (value) {
					this.currentWeight = value;
					this.wrapAndWeight(this.lastRange, value);
					this.select!.value = value;
					console.log("Selected font weight:", value);
				}
			});
		}

		return this.select;
	}

	getSelectionWeight(): string | null {
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
			const fontWeight = window.getComputedStyle(element).fontWeight;
			const normalized = this.normalizeWeight(fontWeight);
			if (normalized) {
				return normalized;
			}
			element = element.parentElement;
		}

		return null;
	}

	normalizeWeight(weight: string): string | null {
		if (!weight) {
			return null;
		}

		const trimmed = weight.trim().toLowerCase();
		if (trimmed === 'normal') {
			return '400';
		}
		if (trimmed === 'bold') {
			return '700';
		}
		if (trimmed === 'bolder') {
			return '900';
		}
		if (trimmed === 'lighter') {
			return '300';
		}
		return trimmed;
	}

	surround(range: Range | null) {
		this.lastRange = range;
	}

	wrapAndWeight(range: Range | null, weight: string) {
		if (!range) {
			return;
		}
		const selectedText = range.extractContents();
		const span = document.createElement(this.tag);
		span.classList.add(this.class);
		span.appendChild(selectedText);
		span.style.fontWeight = weight;
		span.innerHTML = span.textContent || '';
		range.insertNode(span);

		this.api.selection.expandToTag(span);
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
					fontWeight: true,
				},
			},
		};
	}
}

export class WeightPickerWithoutSanitize extends WeightPicker {
	static override get sanitize() {
		return undefined;
	}
}
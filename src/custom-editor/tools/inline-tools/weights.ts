import { API } from '@editorjs/editorjs';
import { IconBold } from '@codexteam/icons';
import type { MenuConfig } from '@editorjs/editorjs/types/tools/menu-config';
import { applyStyledSpan, buildInlineMenu, captureSelectionRange } from './inline-utils';

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

	render(): MenuConfig {
		this.lastRange = captureSelectionRange();
		const current = this.getSelectionWeight() ?? '';

		return buildInlineMenu({
			icon: IconBold,
			// title: current ? (this.weights[Number(current)] || current) : 'Weight',
			title: '',
			currentValue: current,
			options: Object.entries(this.weights).map(([value, label]) => ({ value, label })),
			onSelect: (value) => this.wrapAndWeight(this.lastRange, value),
		});
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
		applyStyledSpan(range, weight, { className: this.class, styleProperty: 'fontWeight' }, this.api);
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
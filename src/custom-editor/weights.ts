import { API } from '@editorjs/editorjs';
import { IconBold, IconColor } from '@codexteam/icons';

type WeightPickerConfig = {
	weights: string[];
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

	weights: string[] = [
		'900',
		'800',
		'700',
		'600',
		'500',
		'400',
		'300',
		'200',
		'100'
	];

	columns = 9;

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
		if (config.columns) {
			this.columns = config.columns;
		}
	}

	render() {
		const button = document.createElement('button');

		button.type = 'button';
		button.innerHTML = IconBold;
		button.classList.add(this.api.styles.inlineToolButton);

		button.addEventListener('mousedown', (e) => {
			// prevent text deselection when clicking the button
			e.preventDefault();
		});

		return button;
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

	renderActions() {
		const container = document.createElement('div');
		container.classList.add('editorjs__weight-selector-container');
		container.style.gridTemplateColumns = `repeat(${this.columns}, 1fr)`;

		this.weights.forEach((weightValue) => {
			const weight = document.createElement('div');
			weight.classList.add('editorjs__weight-selector__container-item');
			weight.style.fontWeight = weightValue;
      weight.innerHTML = `${weightValue}`;
			weight.onclick = () => {
				this.wrapAndWeight(this.lastRange, weightValue);
			};
			container.append(weight);
		});

		return container;
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
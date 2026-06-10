import { API } from '@editorjs/editorjs';
import { IconBold, IconColor, IconCurlyBrackets } from '@codexteam/icons';

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
	defaultFamily = 'Arial, sans-serif';

	lastRange: Range | null = null;

	families: string[] = [
		'Arial, sans-serif',
		'Helvetica, sans-serif',
		'Georgia, serif',
		'Times New Roman, serif',
		'Courier New, monospace'
	];	

	columns = 9;

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
		const button = document.createElement('button');

		button.type = 'button';
		button.innerHTML = IconCurlyBrackets;
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

	wrapAndFamily(range: Range | null, family: string) {
		if (!range) {
			return;
		}
		const selectedText = range.extractContents();
		const span = document.createElement(this.tag);
		span.classList.add(this.class);
		span.appendChild(selectedText);
		span.style.fontFamily = family;
		span.innerHTML = span.textContent || '';
		range.insertNode(span);

		this.api.selection.expandToTag(span);
	}

	renderActions() {
		const container = document.createElement('div');
		container.classList.add('editorjs__weight-selector-container');
		container.style.gridTemplateColumns = `repeat(${this.columns}, 1fr)`;

		this.families.forEach((familyValue) => {
			const family = document.createElement('div');
			family.classList.add('editorjs__family-selector__container-item');
			family.style.fontFamily = familyValue;
      family.innerHTML = `${familyValue}`;
			family.onclick = () => {
				this.wrapAndWeight(this.lastRange, familyValue);
			};
			container.append(family);
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
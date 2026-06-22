import type { API, BlockAPI, BlockToolConstructorOptions, BlockTune } from '@editorjs/editorjs';
import type { MenuConfig } from '@editorjs/editorjs/types/tools/menu-config';

type Side = 'top' | 'right' | 'bottom' | 'left';
type BoxKind = 'padding' | 'margin';

type BoxValues = Partial<Record<Side, string>>;

interface SpacingData {
	padding: BoxValues;
	margin: BoxValues;
}

const SIDES: Side[] = ['top', 'right', 'bottom', 'left'];
const DEFAULT_SPACING = '0.75rem';
const ZERO_SPACING = '0';
// Only layout containers get spacing by default; everything else starts at 0.
const SPACED_BLOCKS = new Set(['flexblock', 'gridblock']);

const PADDING_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="1"/><rect x="7" y="7" width="10" height="10" rx="1" stroke-dasharray="2 2"/></svg>';
const MARGIN_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="1" stroke-dasharray="2 2"/><rect x="7" y="7" width="10" height="10" rx="1"/></svg>';

const BOXES: { key: BoxKind; label: string; icon: string }[] = [
	{ key: 'padding', label: 'Padding', icon: PADDING_ICON },
	{ key: 'margin', label: 'Margin', icon: MARGIN_ICON },
];

function sanitizeBox(value: unknown, fallback: string): BoxValues {
	const out: BoxValues = {};
	const source = (value && typeof value === 'object') ? (value as Record<string, unknown>) : {};
	for (const side of SIDES) {
		const raw = source[side];
		// Missing sides take the block-type default so inputs always show a value.
		out[side] = (typeof raw === 'string' && raw.trim()) ? raw.trim() : fallback;
	}
	return out;
}

export class Spacing implements BlockTune {
	private api: API;
	private block: BlockAPI | undefined;
	private data: SpacingData;
	private wrapper: HTMLElement | undefined;

	constructor({ api, data, block }: BlockToolConstructorOptions) {
		this.api = api;
		this.block = block;
		const fallback = SPACED_BLOCKS.has((block as any)?.name) ? DEFAULT_SPACING : ZERO_SPACING;
		this.data = {
			padding: sanitizeBox((data as Partial<SpacingData> | undefined)?.padding, fallback),
			margin: sanitizeBox((data as Partial<SpacingData> | undefined)?.margin, fallback),
		};
	}

	static get isTune() {
		return true;
	}

	wrap(blockContent: HTMLElement) {
		this.wrapper = document.createElement('div');
		this.wrapper.classList.add('ce-spacing-tune-wrapper');
		// Make the wrapper a true block-level, full-width box so that its
		// vertical margins behave like real block margins (and can collapse
		// through to separate this block from its neighbours).
		this.wrapper.style.display = 'block';
		this.wrapper.style.width = '100%';
		this.wrapper.append(blockContent);
		this.applySpacing();
		return this.wrapper;
	}

	/**
	 * Reflect the stored spacing onto the wrapper as inline styles. Empty values
	 * are removed so the block falls back to its natural spacing.
	 */
	private applySpacing() {
		if (!this.wrapper) return;

		for (const { key } of BOXES) {
			for (const side of SIDES) {
				const prop = `${key}-${side}`;
				const value = this.data[key][side];
				if (value) {
					this.wrapper.style.setProperty(prop, value);
				} else {
					this.wrapper.style.removeProperty(prop);
				}
			}
		}
	}

	/**
	 * Render as declarative tunes-menu items so each box ("Padding"/"Margin")
	 * opens a nested popover (ce-popover--nested) on hover, like "Convert to".
	 */
	render(): MenuConfig {
		return BOXES.map((box) => ({
			icon: box.icon,
			title: box.label,
			name: `spacing-${box.key}`,
			children: {
				searchable: false,
				items: [
					{
						// Custom html content holding the four side inputs.
						type: 'html',
						element: this.createBoxInputs(box.key),
					} as any,
				],
			},
		}));
	}

	private createBoxInputs(key: BoxKind) {
		const wrapper = document.createElement('div');
		wrapper.classList.add('ce-spacing-tune');

		const inputs = document.createElement('div');
		inputs.classList.add('ce-spacing-tune__inputs');

		for (const side of SIDES) {
			const field = document.createElement('input');
			field.type = 'text';
			field.classList.add('ce-spacing-tune__input');
			field.value = this.data[key][side] || '';
			field.placeholder = side.charAt(0).toUpperCase();
			field.title = `${key} ${side}`;
			field.style.gridArea = side;
			field.addEventListener('input', () => {
				const trimmed = field.value.trim();
				if (trimmed) {
					this.data[key][side] = trimmed;
				} else {
					delete this.data[key][side];
				}
				this.applySpacing();
				this.block?.dispatchChange();
			});
			// Keep keystrokes inside the input instead of triggering popover
			// keyboard navigation (arrows/enter).
			field.addEventListener('keydown', (event) => event.stopPropagation());
			inputs.appendChild(field);
		}

		wrapper.appendChild(inputs);
		return wrapper;
	}

	save() {
		return this.data;
	}
}

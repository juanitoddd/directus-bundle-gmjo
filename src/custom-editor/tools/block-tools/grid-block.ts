import type { API, BlockToolConstructorOptions } from '@editorjs/editorjs';
import type { MenuConfig } from '@editorjs/editorjs/types/tools/menu-config';
import { blocksToHtml } from '../utils/block-utils';

const COLUMNS_ICON = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="18"/><rect x="14" y="3" width="7" height="18"/></svg>';

interface GridBlockItem {
	id: string;
	content?: any;
}

interface GridBlockData {
	items: GridBlockItem[];
	columns: number;
	columnTemplate?: string;
}

const DEFAULT_COLUMNS = 2;
const MIN_COLUMNS = 1;
const MAX_COLUMNS = 6;

// Ratio presets per column count. "Equal" is represented as an absent template
// (i.e. repeat(n, 1fr)); only non-equal ratios are listed here. Add entries for
// other column counts to expose more layouts (e.g. 3: ['1fr 1fr 2fr', ...]).
const COLUMN_LAYOUTS: Record<number, string[]> = {
	2: ['2fr 3fr', '3fr 2fr'],
	3: ['1fr 2fr 1fr', '1fr 2fr 2fr', '2fr 2fr 1fr'],
};

/** Parse a `fr` template into numeric track weights (falls back to equal). */
function parseTracks(template: string | undefined, columns: number): number[] {
	if (!template) return Array.from({ length: columns }, () => 1);
	const tracks = template.trim().split(/\s+/).map((token) => {
		const value = parseFloat(token);
		return Number.isFinite(value) && value > 0 ? value : 1;
	});
	return tracks.length ? tracks : Array.from({ length: columns }, () => 1);
}

/**
 * Build an SVG icon depicting the column layout as proportional rectangles.
 * `label` is exposed as an accessible <title> / hover tooltip.
 */
function layoutIcon(template: string | undefined, columns: number, label: string): string {
	const tracks = parseTracks(template, columns);
	const total = tracks.reduce((sum, value) => sum + value, 0) || tracks.length;

	const width = 36;
	const height = 16;
	const gap = 2;
	const pad = 1;
	const available = width - pad * 2 - gap * (tracks.length - 1);

	let x = pad;
	const round = (n: number) => Math.round(n * 100) / 100;
	const rects = tracks.map((track) => {
		const w = available * (track / total);
		const rect = `<rect x="${round(x)}" y="2" width="${round(w)}" height="${height - 4}" rx="2" />`;
		x += w + gap;
		return rect;
	}).join('');

	return `<svg class="ce-grid-layout-icon" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><title>${label}</title>${rects}</svg>`;
}

function createId() {
	return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createEmptyItem(): GridBlockItem {
	return { id: createId(), content: null };
}

function hasContent(item: GridBlockItem | undefined): boolean {
	return Array.isArray(item?.content?.blocks) && item!.content.blocks.length > 0;
}

export default class GridBlock {
	private data: GridBlockData;
	private api: API;
	private config: any;
	private openItemEditor: ((params: { data?: any; callback: (item: any) => void }) => void) | null = null;
	private preview: HTMLElement | null = null;
	private block: any;

	static get toolbox() {
		return {
			title: 'Grid',
			icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="18"/><rect x="14" y="3" width="7" height="18"/></svg>',
		};
	}

	constructor({ data, api, config, block }: BlockToolConstructorOptions) {
		this.api = api;
		this.config = config || {};
		this.openItemEditor = this.config?.uploader?.openFlexEditor || null;
		this.block = block;

		const incoming = data as Partial<GridBlockData> | undefined;

		// `data.items` is only an array when loading saved content. A freshly
		// inserted block arrives as `{}`, which is our cue to seed default cells.
		if (Array.isArray(incoming?.items)) {
			const columns = this.clampColumns(Number(incoming?.columns) || incoming!.items.length || DEFAULT_COLUMNS);
			this.data = {
				items: incoming!.items,
				columns,
				columnTemplate: this.normalizeTemplate(incoming?.columnTemplate, columns),
			};
		} else {
			this.data = {
				columns: DEFAULT_COLUMNS,
				items: Array.from({ length: DEFAULT_COLUMNS }, () => createEmptyItem()),
			};
		}
	}

	private clampColumns(value: number) {
		if (!Number.isFinite(value)) return DEFAULT_COLUMNS;
		return Math.min(MAX_COLUMNS, Math.max(MIN_COLUMNS, Math.round(value)));
	}

	render() {
		const wrapper = document.createElement('div');
		wrapper.classList.add('ce-grid-block');

		this.preview = document.createElement('div');
		this.preview.classList.add('ce-grid-block__preview');

		wrapper.appendChild(this.preview);

		this.renderPreview();

		return wrapper;
	}

	renderSettings(): MenuConfig {
		const items: any[] = [];

		for (let count = MIN_COLUMNS; count <= MAX_COLUMNS; count++) {
			const layouts = COLUMN_LAYOUTS[count];
			const title = `${count} column${count > 1 ? 's' : ''}`;

			if (layouts && layouts.length) {
				// A count with ratio presets gets its own nested popover:
				// "Equal" (no template) plus each non-equal ratio.
				const layoutItems = [
					{
						icon: layoutIcon(undefined, count, 'Equal'),
						title: '',
						name: `grid-layout-${count}-equal`,
						isActive: this.data.columns === count && !this.data.columnTemplate,
						closeOnActivate: true,
						onActivate: () => this.setColumns(count),
					},
					...layouts.map((template, index) => ({
						icon: layoutIcon(template, count, template),
						title: '',
						name: `grid-layout-${count}-${index}`,
						isActive: this.data.columns === count && this.data.columnTemplate === template,
						closeOnActivate: true,
						onActivate: () => this.setColumns(count, template),
					})),
				];

				items.push({
					title,
					isActive: this.data.columns === count,
					children: {
						searchable: false,
						items: layoutItems,
					},
				});
			} else {
				items.push({
					title,
					isActive: count === this.data.columns,
					closeOnActivate: true,
					onActivate: () => this.setColumns(count),
				});
			}
		}

		return [
			{
				icon: COLUMNS_ICON,
				title: 'Columns',
				secondaryLabel: String(this.data.columns),
				children: {
					searchable: false,
					items,
				},
			},
		] as MenuConfig;
	}

	/**
	 * Keep a column template only if its track count matches the column count;
	 * otherwise drop it (falls back to equal `repeat(n, 1fr)`).
	 */
	private normalizeTemplate(template: string | undefined, columns: number): string | undefined {
		if (!template) return undefined;
		const trimmed = template.trim();
		if (!trimmed) return undefined;
		return trimmed.split(/\s+/).length === columns ? trimmed : undefined;
	}

	/**
	 * Set the column count (adding empty cells when growing, removing trailing
	 * cells when shrinking) and an optional column template (e.g. "2fr 3fr").
	 * An absent/invalid template means equal columns. Returns false if the user
	 * cancels a removal that would discard content.
	 */
	setColumns(next: number, template?: string): boolean {
		const target = this.clampColumns(next);
		const current = this.data.items.length;

		if (target > current) {
			for (let i = current; i < target; i++) {
				this.data.items.push(createEmptyItem());
			}
		} else if (target < current) {
			const removed = this.data.items.slice(target);
			if (removed.some(hasContent)) {
				const confirmed = window.confirm(
					`Reducing to ${target} column(s) will remove ${current - target} cell(s) that contain content. Continue?`,
				);
				if (!confirmed) return false;
			}
			this.data.items = this.data.items.slice(0, target);
		}

		this.data.columns = target;
		this.data.columnTemplate = this.normalizeTemplate(template, target);
		this.renderPreview();
		this.block?.dispatchChange();
		return true;
	}

	openRichContentEditor(item: GridBlockItem, index: number) {
		if (!this.openItemEditor) {
			return;
		}

		this.openItemEditor({
			data: item.content || null,
			callback: (result) => {
				const returned = result && (result.content || result);
				item.content = returned;
				this.data.items[index] = item;
				this.renderPreview();
				this.block?.dispatchChange();
			},
		});
	}

	moveItem(index: number, delta: -1 | 1) {
		const newIndex = index + delta;
		if (newIndex < 0 || newIndex >= this.data.items.length) return;
		const items = [...this.data.items];
		const [moved] = items.splice(index, 1);
		items.splice(newIndex, 0, moved);
		this.data.items = items;
		this.renderPreview();
		this.block?.dispatchChange();
	}

	renderPreview() {
		const preview = this.preview;
		if (!preview) return;
		preview.innerHTML = '';
		preview.style.display = 'grid';
		preview.style.gridTemplateColumns = this.data.columnTemplate || `repeat(${this.data.columns}, 1fr)`;
		// Gap is owned by the grid tune (falls back to the CSS default).

		this.data.items.forEach((item, index) => {
			const itemElement = document.createElement('div');
			itemElement.classList.add('ce-grid-block__item');

			const richPreview = document.createElement('div');
			richPreview.classList.add('ce-grid-block__item-rich-preview');
			const html = blocksToHtml(item.content?.blocks || []);
			richPreview.innerHTML = html || '<em class="text-muted">Empty</em>';
			itemElement.appendChild(richPreview);

			const controls = document.createElement('div');
			controls.classList.add('ce-grid-block__item-controls');

			const editButton = document.createElement('button');
			editButton.type = 'button';
			editButton.textContent = 'Edit';
			editButton.classList.add('ce-flex-block__item-control');
			editButton.addEventListener('click', () => this.openRichContentEditor(item, index));
			controls.appendChild(editButton);

			const leftButton = document.createElement('button');
			leftButton.type = 'button';
			leftButton.textContent = '←';
			leftButton.classList.add('ce-grid-block__item-control');
			leftButton.addEventListener('click', () => this.moveItem(index, -1));
			controls.appendChild(leftButton);

			const rightButton = document.createElement('button');
			rightButton.type = 'button';
			rightButton.textContent = '→';
			rightButton.classList.add('ce-grid-block__item-control');
			rightButton.addEventListener('click', () => this.moveItem(index, 1));
			controls.appendChild(rightButton);

			itemElement.appendChild(controls);
			preview.appendChild(itemElement);
		});
	}

	save() {
		return this.data;
	}
}

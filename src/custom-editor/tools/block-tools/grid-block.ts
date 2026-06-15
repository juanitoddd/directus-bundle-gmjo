import type { API, BlockToolConstructorOptions } from '@editorjs/editorjs';
import { blocksToHtml } from '../utils/block-utils';

interface GridBlockItem {
	id: string;
	content?: any;
}

interface GridBlockData {
	items: GridBlockItem[];
	columns: number;
}

const DEFAULT_COLUMNS = 2;
const MIN_COLUMNS = 1;
const MAX_COLUMNS = 6;

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

	renderSettings() {
		const wrapper = document.createElement('div');
		wrapper.classList.add('ce-grid-tune');

		const group = document.createElement('div');
		group.classList.add('ce-grid-tune__group');

		const label = document.createElement('div');
		label.classList.add('ce-grid-tune__label');
		label.textContent = 'Columns';
		group.appendChild(label);

		for (let count = MIN_COLUMNS; count <= MAX_COLUMNS; count++) {
			const button = document.createElement('button');
			button.type = 'button';
			button.textContent = String(count);
			button.title = `${count} columns`;
			button.classList.add(this.api.styles.settingsButton);
			button.classList.toggle(this.api.styles.settingsButtonActive, count === this.data.columns);
			button.addEventListener('click', () => {
				const applied = this.setColumns(count);
				if (!applied) return;

				for (const sibling of group.querySelectorAll('button')) {
					sibling.classList.toggle(
						this.api.styles.settingsButtonActive,
						sibling === button,
					);
				}
			});
			group.appendChild(button);
		}

		wrapper.appendChild(group);
		return wrapper;
	}

	/**
	 * Set the column count, adding empty cells when growing and removing
	 * trailing cells when shrinking. Returns false if the user cancels a
	 * removal that would discard content.
	 */
	setColumns(next: number): boolean {
		const target = this.clampColumns(next);
		const current = this.data.items.length;

		if (target === current) {
			this.data.columns = target;
			return true;
		}

		if (target > current) {
			for (let i = current; i < target; i++) {
				this.data.items.push(createEmptyItem());
			}
		} else {
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
		preview.style.gridTemplateColumns = `repeat(${this.data.columns}, 1fr)`;
		preview.style.gap = '0.75rem';

		this.data.items.forEach((item, index) => {
			const itemElement = document.createElement('div');
			itemElement.classList.add('ce-grid-block__item');

			const richPreview = document.createElement('div');
			richPreview.classList.add('ce-grid-block__item-rich-preview');
			const html = blocksToHtml(item.content?.blocks || []);
			richPreview.innerHTML = html || '<em>Rich content</em>';
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

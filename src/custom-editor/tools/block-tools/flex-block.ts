import type { BlockToolConstructorOptions } from '@editorjs/editorjs';
import { IconPlus } from '@codexteam/icons';
import { blocksToHtml } from '../utils/block-utils';

interface FlexBlockItem {
	id: string;
	content?: any;
	grow?: boolean;
}

interface FlexBlockData {
	items: FlexBlockItem[];
}

function createId() {
	return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default class FlexBlock {
	private data: FlexBlockData;
	private config: any;
	private openFlexEditor: ((params: { data?: any; callback: (item: any) => void }) => void) | null = null;
	private preview: HTMLElement | null = null;
	private block: any;

	static get toolbox() {
		return {
			title: 'Flex',
			icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
		};
	}

	constructor({ data, config, block }: BlockToolConstructorOptions) {
		this.config = config || {};
		this.openFlexEditor = this.config?.uploader?.openFlexEditor || null;
		this.block = block;
		this.data = {
			items: Array.isArray((data as FlexBlockData)?.items) ? (data as FlexBlockData).items : [],
		};
	}

	render() {
		const wrapper = document.createElement('div');
		wrapper.classList.add('ce-flex-block');		

		const addItemButton = document.createElement('button');
		addItemButton.type = 'button';
		addItemButton.innerHTML = IconPlus;		
		addItemButton.classList.add('ce-toolbar__plus', 'ce-flex-add-item__button');
		addItemButton.addEventListener('click', () => this.openRichContentEditor());		

		// Layout controls are now handled by the flex tune, keeping the block UI cleaner.

		this.preview = document.createElement('div');
		this.preview.classList.add('ce-flex-block__preview');
		
		wrapper.appendChild(addItemButton);
		wrapper.appendChild(this.preview);

		this.renderPreview();

		return wrapper;
	}

	openRichContentEditor(item?: FlexBlockItem, index?: number) {
		if (!this.openFlexEditor) {
			return;
		}

		this.openFlexEditor({
			data: item?.content || null,
			callback: (result) => {
				const returned = result && (result.content || result);

				if (item && typeof index === 'number') {
					// Always store/update as rich content					
					item.content = returned;
					this.data.items[index] = item;
				} else {
					this.data.items.push({
						id: createId(),						
						content: returned,
					});
				}

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
		console.log("this.block", this.block);
		this.block?.dispatchChange();
	}

	editItem(index: number) {
		const item = this.data.items[index];
		if (!item) return;

		// Open the drawer-based editor for any item type. The editor
		// callback will intelligently merge content back into the item
		// (preserving simple text/image captions where possible).
		this.openRichContentEditor(item, index);
	}



	renderPreview() {
		console.log("Rendering preview with data:", this.data);
		const preview = this.preview;
		if (!preview) return;
		preview.innerHTML = '';
		preview.style.display = 'flex';
		preview.style.flexWrap = 'wrap';
		// Gap is owned by the flex tune (falls back to the CSS default).

		const existingPanel = preview.parentElement?.querySelector('.ce-flex-block__editor-panel');
		if (existingPanel) {
			existingPanel.remove();
		}

		this.data.items.forEach((item, index) => {
			const itemElement = document.createElement('div');
			itemElement.classList.add('ce-flex-block__item');
			itemElement.classList.toggle('ce-flex-block__item--grow', !!item.grow);

			const richPreview = document.createElement('div');
			richPreview.classList.add('ce-flex-block__item-rich-preview');
			const html = blocksToHtml(item.content?.blocks || []);
			richPreview.innerHTML = html || '<em>empty</em>';
			itemElement.appendChild(richPreview);

			const controls = document.createElement('div');
			controls.classList.add('ce-flex-block__item-controls');

			const editButton = document.createElement('button');
			editButton.type = 'button';
			editButton.textContent = 'Edit';
			editButton.classList.add('ce-flex-block__item-control');
			editButton.addEventListener('click', () => this.editItem(index));
			controls.appendChild(editButton);

			const growButton = document.createElement('button');
			growButton.type = 'button';
			growButton.textContent = item.grow ? '←|→' : '→|←';			
			growButton.classList.add('ce-flex-block__item-control', 'v-icon');
			growButton.classList.toggle('ce-flex-block__item-control--active', !!item.grow);
			growButton.addEventListener('click', () => {
				item.grow = !item.grow;
				this.data.items[index] = item;
				this.renderPreview();
				this.block?.dispatchChange();
			});
			controls.appendChild(growButton);

			const leftButton = document.createElement('button');
			leftButton.type = 'button';
			leftButton.textContent = '←';
			leftButton.classList.add('ce-flex-block__item-control');
			leftButton.addEventListener('click', () => this.moveItem(index, -1));
			controls.appendChild(leftButton);

			const rightButton = document.createElement('button');
			rightButton.type = 'button';
			rightButton.textContent = '→';
			rightButton.classList.add('ce-flex-block__item-control');
			rightButton.addEventListener('click', () => this.moveItem(index, 1));
			controls.appendChild(rightButton);

			const removeButton = document.createElement('button');
			removeButton.type = 'button';
			removeButton.textContent = '×';
			removeButton.classList.add('ce-flex-block__item-control');
			removeButton.addEventListener('click', () => {
				this.data.items = this.data.items.filter((other) => other.id !== item.id);
				this.renderPreview();
				this.block?.dispatchChange();
			});
			controls.appendChild(removeButton);

			itemElement.appendChild(controls);
			preview.appendChild(itemElement);
		});
	}

	save() {
		return this.data;
	}
}

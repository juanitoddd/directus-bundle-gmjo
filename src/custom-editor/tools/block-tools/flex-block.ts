import type { BlockToolConstructorOptions } from '@editorjs/editorjs';

interface FlexBlockItem {
	id: string;
	type: 'text' | 'image';
	text?: string;
	imageUrl?: string;
	caption?: string;
	link?: string;
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
	private preview: HTMLElement | null = null;
	private textInput: HTMLInputElement | null = null;
	private linkInput: HTMLInputElement | null = null;
	private block: any;

	static get toolbox() {
		return {
			title: 'Flex',
			icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
		};
	}

	constructor({ data, config, block }: BlockToolConstructorOptions) {
		this.config = config || {};
		this.block = block;
		this.data = {
			items: Array.isArray((data as FlexBlockData)?.items) ? (data as FlexBlockData).items : [],
		};
	}

	render() {
		const wrapper = document.createElement('div');
		wrapper.classList.add('ce-flex-block');

		const controls = document.createElement('div');
		controls.classList.add('ce-flex-block__controls');

		const textField = document.createElement('div');
		textField.classList.add('ce-flex-block__field');

		this.textInput = document.createElement('input');
		this.textInput.type = 'text';
		this.textInput.placeholder = 'Add flex item text';
		this.textInput.classList.add('ce-flex-block__text-input');
		textField.appendChild(this.textInput);

		this.linkInput = document.createElement('input');
		this.linkInput.type = 'url';
		this.linkInput.placeholder = 'Optional link (https://...)';
		this.linkInput.classList.add('ce-flex-block__text-input');
		textField.appendChild(this.linkInput);

		controls.appendChild(textField);

		const addTextButton = document.createElement('button');
		addTextButton.type = 'button';
		addTextButton.textContent = 'Add Text';
		addTextButton.classList.add('ce-flex-block__button', 'ce-flex-block__button--primary');
		addTextButton.addEventListener('click', () => {
			if (!this.textInput) return;
			const value = this.textInput.value.trim();
			if (!value) return;
			const link = this.linkInput?.value.trim() || '';
			this.data.items.push({ id: createId(), type: 'text', text: value, link });
			this.textInput.value = '';
			if (this.linkInput) this.linkInput.value = '';
			this.renderPreview();
			this.block?.dispatchChange();
		});
		controls.appendChild(addTextButton);

		const addImageButton = document.createElement('button');
		addImageButton.type = 'button';
		addImageButton.textContent = 'Add Image';
		addImageButton.classList.add('ce-flex-block__button', 'ce-flex-block__button--primary');
		addImageButton.addEventListener('click', () => this.openImageUploader());
		controls.appendChild(addImageButton);

		// Layout controls are now handled by the flex tune, keeping the block UI cleaner.

		this.preview = document.createElement('div');
		this.preview.classList.add('ce-flex-block__preview');

		wrapper.appendChild(controls);
		wrapper.appendChild(this.preview);

		this.renderPreview();

		return wrapper;
	}

	openImageUploader() {
		if (!this.config?.uploader || !this.config.uploader.setFileHandler) {
			return;
		}

		this.config.uploader.setFileHandler((file: any) => {
			if (!file || !file.id) {
				return;
			}

			const imageUrl = `${this.config.uploader.baseURL}assets/${file.id}`;
			this.data.items.push({ id: createId(), type: 'image', imageUrl, caption: '', link: '' });
			this.renderPreview();
			this.block?.dispatchChange();
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

	editItem(index: number) {
		const item = this.data.items[index];
		if (!item) return;

		const existingPanel = this.preview?.parentElement?.querySelector('.ce-flex-block__editor-panel');
		if (existingPanel) existingPanel.remove();

		const editPanel = document.createElement('div');
		editPanel.classList.add('ce-flex-block__editor-panel');

		const title = document.createElement('div');
		title.classList.add('ce-flex-block__editor-panel-title');
		title.textContent = item.type === 'text' ? 'Edit text item' : 'Edit image details';
		editPanel.appendChild(title);

		const field = this.createEditorField(item.type === 'text' ? 'Text content' : 'Image caption', item.type === 'text' ? item.text || '' : item.caption || '');
		field.input.addEventListener('input', () => {
			if (item.type === 'text') {
				item.text = field.input.value;
			} else {
				item.caption = field.input.value;
			}
		});
		editPanel.appendChild(field.wrapper);

		const linkField = this.createEditorField('Link', item.link || '');
		linkField.input.addEventListener('input', () => {
			item.link = linkField.input.value;
		});
		editPanel.appendChild(linkField.wrapper);

		const actions = document.createElement('div');
		actions.classList.add('ce-flex-block__editor-panel-actions');

		const saveButton = document.createElement('button');
		saveButton.type = 'button';
		saveButton.textContent = 'Save';
		saveButton.classList.add('ce-flex-block__button', 'ce-flex-block__button--primary');
		saveButton.addEventListener('click', () => {
			this.renderPreview();
			this.block?.dispatchChange();
		});
		actions.appendChild(saveButton);

		const cancelButton = document.createElement('button');
		cancelButton.type = 'button';
		cancelButton.textContent = 'Cancel';
		cancelButton.classList.add('ce-flex-block__button', 'ce-flex-block__button--secondary');
		cancelButton.addEventListener('click', () => {
			editPanel.remove();
		});
		actions.appendChild(cancelButton);

		editPanel.appendChild(actions);
		this.preview?.insertAdjacentElement('afterend', editPanel);
	}

	createEditorField(labelText: string, value: string) {
		const wrapper = document.createElement('div');
		wrapper.classList.add('ce-flex-block__field');

		const label = document.createElement('label');
		label.classList.add('ce-flex-block__field-label');
		label.textContent = labelText;
		wrapper.appendChild(label);

		const input = document.createElement('input');
		input.type = 'text';
		input.classList.add('ce-flex-block__text-input');
		input.value = value;
		wrapper.appendChild(input);

		return { wrapper, input };
	}

	renderPreview() {
		const preview = this.preview;
		if (!preview) return;
		preview.innerHTML = '';
		preview.style.display = 'flex';
		preview.style.flexWrap = 'wrap';
		preview.style.gap = '0.75rem';

		const existingPanel = preview.parentElement?.querySelector('.ce-flex-block__editor-panel');
		if (existingPanel) {
			existingPanel.remove();
		}

		this.data.items.forEach((item, index) => {
			const itemElement = document.createElement('div');
			itemElement.classList.add('ce-flex-block__item');

			const header = document.createElement('div');
			header.classList.add('ce-flex-block__item-header');
			header.textContent = item.type === 'text' ? 'Text block' : 'Image block';
			itemElement.appendChild(header);

			if (item.type === 'text') {
				const textNode = document.createElement('div');
				textNode.classList.add('ce-flex-block__item-text');
				textNode.textContent = item.text || '';
				if (item.link) {
					const anchor = document.createElement('a');
					anchor.href = item.link;
					anchor.target = '_blank';
					anchor.rel = 'noopener noreferrer';
					anchor.appendChild(textNode);
					itemElement.appendChild(anchor);
				} else {
					itemElement.appendChild(textNode);
				}
			} else if (item.type === 'image' && item.imageUrl) {
				const img = document.createElement('img');
				img.src = item.imageUrl;
				img.classList.add('ce-flex-block__item-image');

				const captionNode = document.createElement('div');
				captionNode.classList.add('ce-flex-block__item-caption');
				captionNode.textContent = item.caption || 'No caption';

				if (item.link) {
					const anchor = document.createElement('a');
					anchor.href = item.link;
					anchor.target = '_blank';
					anchor.rel = 'noopener noreferrer';
					anchor.appendChild(img);
					itemElement.appendChild(anchor);
				} else {
					itemElement.appendChild(img);
				}
				itemElement.appendChild(captionNode);
			}

			const controls = document.createElement('div');
			controls.classList.add('ce-flex-block__item-controls');

			const editButton = document.createElement('button');
			editButton.type = 'button';
			editButton.textContent = 'Edit';
			editButton.classList.add('ce-flex-block__item-control');
			editButton.addEventListener('click', () => this.editItem(index));
			controls.appendChild(editButton);

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

import type { BlockToolConstructorOptions } from '@editorjs/editorjs';

interface HTMLBlockData {
	html: string;
}

export default class HTMLBlock {
	private data: HTMLBlockData;
	private preview: HTMLElement | null = null;
	private textarea: HTMLTextAreaElement | null = null;

	static get toolbox() {
		return {
			title: 'HTML',
			icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 18l6-6-6-6"/><path d="M8 6l-6 6 6 6"/></svg>',
		};
	}

	constructor({ data }: BlockToolConstructorOptions) {
		this.data = {
			html: (data as HTMLBlockData)?.html || '',
		};
	}

	render() {
		const wrapper = document.createElement('div');
		wrapper.classList.add('ce-html-block');

		const textareaWrapper = document.createElement('div');
		textareaWrapper.classList.add('ce-html-block__editor-wrapper');

		this.textarea = document.createElement('textarea');
		this.textarea.classList.add('ce-html-block__editor');
		this.textarea.placeholder = 'Enter raw HTML here';
		this.textarea.value = this.data.html;
		this.textarea.addEventListener('input', () => {
			this.data.html = this.textarea?.value ?? '';
			this.renderPreview();
		});

		textareaWrapper.appendChild(this.textarea);

		this.preview = document.createElement('div');
		this.preview.classList.add('ce-html-block__preview');

		wrapper.appendChild(textareaWrapper);
		wrapper.appendChild(this.preview);

		this.renderPreview();

		return wrapper;
	}

	renderPreview() {
		if (!this.preview) return;
		this.preview.innerHTML = this.data.html || '<div class="ce-html-block__placeholder">No HTML defined</div>';
	}

	save() {
		return {
			html: this.data.html,
		};
	}
}

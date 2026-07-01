import type { BlockToolConstructorOptions } from '@editorjs/editorjs';
import { blocksToHtml } from '../utils/block-utils';
import { collectResolvableKeys, resolveBlocks } from '../utils/reference-resolver';

type Field = 'title' | 'content';

interface AccordionBlockData {
	title: any;
	content: any;
	open: boolean;
}

export default class AccordionBlock {
	private data: AccordionBlockData;
	private config: any;
	private block: any;
	private openFieldEditor: ((params: { data?: any; callback: (item: any) => void }) => void) | null = null;

	private wrapper: HTMLElement | null = null;
	private chevron: HTMLElement | null = null;
	private titlePreview: HTMLElement | null = null;
	private contentPreview: HTMLElement | null = null;
	private contentWrap: HTMLElement | null = null;
	private defaultBtn: HTMLButtonElement | null = null;

	private expanded: boolean;

	private referencesCache: Record<string, string> = {};
	private refsAttempted = new Set<string>();
	private resolvingRefs = false;
	private defaultLanguage: string | undefined;

	static get toolbox() {
		return {
			title: 'Accordion',
			icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="5" rx="1"/><rect x="3" y="12" width="18" height="8" rx="1"/><path d="M17 6.5h.01"/></svg>',
		};
	}

	constructor({ data, config, block }: BlockToolConstructorOptions) {
		this.config = config || {};
		this.block = block;
		this.openFieldEditor = this.config?.uploader?.openFlexEditor || null;

		const incoming = data as Partial<AccordionBlockData> | undefined;
		this.data = {
			title: incoming?.title || null,
			content: incoming?.content || null,
			open: !!incoming?.open,
		};
		this.expanded = this.data.open;
	}

	render() {
		this.wrapper = document.createElement('div');
		this.wrapper.classList.add('ce-accordion-block');

		// Header (click to expand/collapse in the editor).
		const header = document.createElement('div');
		header.classList.add('ce-accordion-block__header');
		header.addEventListener('click', () => this.toggleExpanded());

		this.chevron = document.createElement('span');
		this.chevron.classList.add('ce-accordion-block__chevron');
		this.chevron.textContent = '▸';
		header.appendChild(this.chevron);

		this.titlePreview = document.createElement('div');
		this.titlePreview.classList.add('ce-accordion-block__title');
		header.appendChild(this.titlePreview);

		this.wrapper.appendChild(header);

		// Controls.
		const controls = document.createElement('div');
		controls.classList.add('ce-accordion-block__controls');

		controls.appendChild(this.makeButton('Edit title', () => this.openField('title')));
		controls.appendChild(this.makeButton('Edit content', () => this.openField('content')));

		this.defaultBtn = this.makeButton(this.defaultLabel(), () => this.toggleDefaultOpen());
		controls.appendChild(this.defaultBtn);

		this.wrapper.appendChild(controls);

		// Content (collapsible).
		this.contentWrap = document.createElement('div');
		this.contentWrap.classList.add('ce-accordion-block__content-wrap');
		this.contentPreview = document.createElement('div');
		this.contentPreview.classList.add('ce-accordion-block__content');
		this.contentWrap.appendChild(this.contentPreview);
		this.wrapper.appendChild(this.contentWrap);

		this.applyExpanded();
		this.renderPreviews();
		this.ensureReferences();
		return this.wrapper;
	}

	private makeButton(text: string, onClick: () => void): HTMLButtonElement {
		const button = document.createElement('button');
		button.type = 'button';
		button.classList.add('ce-accordion-block__btn');
		button.textContent = text;
		button.addEventListener('click', (event) => {
			event.stopPropagation();
			onClick();
		});
		return button;
	}

	private defaultLabel() {
		return this.data.open ? 'Default: Open' : 'Default: Closed';
	}

	private openField(field: Field) {
		if (!this.openFieldEditor) return;
		this.openFieldEditor({
			data: this.data[field] || null,
			callback: (result) => {
				this.data[field] = result && (result.content || result);
				this.renderPreviews();
				this.ensureReferences();
				this.block?.dispatchChange();
			},
		});
	}

	private toggleExpanded() {
		this.expanded = !this.expanded;
		this.applyExpanded();
	}

	private toggleDefaultOpen() {
		this.data.open = !this.data.open;
		this.expanded = this.data.open;
		if (this.defaultBtn) this.defaultBtn.textContent = this.defaultLabel();
		this.applyExpanded();
		this.block?.dispatchChange();
	}

	private applyExpanded() {
		if (this.contentWrap) this.contentWrap.style.display = this.expanded ? '' : 'none';
		this.wrapper?.classList.toggle('is-open', this.expanded);
	}

	private renderPreviews() {
		const opts = { references: this.referencesCache, componentPreview: true };
		if (this.titlePreview) {
			this.titlePreview.innerHTML = blocksToHtml(this.data.title?.blocks || [], opts) || '<em>Untitled — click “Edit title”</em>';
		}
		if (this.contentPreview) {
			this.contentPreview.innerHTML = blocksToHtml(this.data.content?.blocks || [], opts) || '<em>No content — click “Edit content”</em>';
		}
	}

	/** Resolve reference/collection blocks nested in the title/content, then re-render. */
	private async ensureReferences() {
		const api = this.config?.uploader?.api;
		if (!api || this.resolvingRefs) return;

		const allBlocks: any[] = [
			...(Array.isArray(this.data.title?.blocks) ? this.data.title.blocks : []),
			...(Array.isArray(this.data.content?.blocks) ? this.data.content.blocks : []),
		];

		const needed = collectResolvableKeys(allBlocks);
		if (!needed.some((key) => !this.refsAttempted.has(key))) return;

		this.resolvingRefs = true;
		try {
			if (this.defaultLanguage === undefined) {
				try {
					const res = await api.get('/settings', { params: { fields: ['default_language'] } });
					this.defaultLanguage = res?.data?.data?.default_language || '';
				} catch (e) {
					this.defaultLanguage = '';
				}
			}

			const map = await resolveBlocks(allBlocks, {
				api,
				assetBaseUrl: this.config?.uploader?.baseURL || '',
				language: this.defaultLanguage,
			});

			let changed = false;
			for (const [key, value] of Object.entries(map)) {
				if (this.referencesCache[key] !== value) {
					this.referencesCache[key] = value;
					changed = true;
				}
			}
			for (const key of needed) this.refsAttempted.add(key);

			if (changed) this.renderPreviews();
		} finally {
			this.resolvingRefs = false;
		}
	}

	save(): AccordionBlockData {
		return this.data;
	}
}

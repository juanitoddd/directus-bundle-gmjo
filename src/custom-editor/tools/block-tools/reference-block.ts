import type { BlockToolConstructorOptions } from '@editorjs/editorjs';
import { blocksToHtml, interpolateTemplate, deriveTemplateFields } from '../utils/block-utils';

interface ReferenceBlockData {
	collection: string;
	template: string;
	itemId: string | number | null;
	label: string;
}

interface TemplateRow {
	collection: string;
	name: string;
	title_field: string;
}

const TEMPLATES_COLLECTION = 'display_templates';
const SEARCH_DEBOUNCE = 300;

/** Map a collection key to its REST endpoint (system collections differ). */
function itemsEndpoint(collection: string): string {
	return collection.startsWith('directus_')
		? `/${collection.slice('directus_'.length)}`
		: `/items/${collection}`;
}

export default class ReferenceBlock {
	private data: ReferenceBlockData;
	private block: any;
	private api: any;
	private assetBaseUrl: string;

	private templateRows: TemplateRow[] = [];
	private collectionsLoaded = false;
	private defaultLanguage: string | undefined;
	private searchTimer: ReturnType<typeof setTimeout> | null = null;

	// Block body
	private previewEl: HTMLElement | null = null;

	// Settings panel ("reference tune")
	private collectionSelect: HTMLSelectElement | null = null;
	private templateSelect: HTMLSelectElement | null = null;
	private searchWrap: HTMLElement | null = null;
	private searchInput: HTMLInputElement | null = null;
	private resultsEl: HTMLElement | null = null;

	static get toolbox() {
		return {
			title: 'Reference',
			icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h10l6 6v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"/><path d="M13 4v6h6"/><path d="M8 14h7"/><path d="M8 17h7"/></svg>',
		};
	}

	constructor({ data, config, block }: BlockToolConstructorOptions) {
		this.block = block;
		this.api = (config as any)?.api || null;
		this.assetBaseUrl = (config as any)?.baseURL || '';

		const incoming = data as Partial<ReferenceBlockData> | undefined;
		this.data = {
			collection: incoming?.collection || '',
			template: incoming?.template || '',
			itemId: incoming?.itemId ?? null,
			label: incoming?.label || '',
		};
	}

	render() {
		const wrapper = document.createElement('div');
		wrapper.classList.add('ce-reference-block');

		this.previewEl = document.createElement('div');
		this.previewEl.classList.add('ce-reference-block__preview');
		wrapper.appendChild(this.previewEl);

		this.initBody();
		return wrapper;
	}

	private async initBody() {
		if (!this.api) {
			this.setPreview('<em>Directus API unavailable.</em>');
			return;
		}

		await this.loadDefaultLanguage();

		if (this.data.collection && this.data.template && this.data.itemId != null) {
			this.renderPreview();
		} else {
			this.setPreview('<em class="ce-reference-block__hint">No reference selected — open the block settings (⚙) to choose one.</em>');
		}
	}

	/** Collection + template + search controls live in the block settings popover. */
	renderSettings(): HTMLElement {
		const panel = document.createElement('div');
		panel.classList.add('ce-reference-tune');

		this.collectionSelect = document.createElement('select');
		this.collectionSelect.classList.add('ce-reference-block__select');
		this.collectionSelect.addEventListener('change', () => this.onCollectionChange());
		panel.appendChild(this.collectionSelect);

		this.templateSelect = document.createElement('select');
		this.templateSelect.classList.add('ce-reference-block__select', 'ce-reference-block__template');
		this.templateSelect.addEventListener('change', () => this.onTemplateChange());
		panel.appendChild(this.templateSelect);

		this.searchWrap = document.createElement('div');
		this.searchWrap.classList.add('ce-reference-block__search');

		this.searchInput = document.createElement('input');
		this.searchInput.type = 'text';
		this.searchInput.classList.add('ce-reference-block__input');
		this.searchInput.placeholder = 'Search…';
		this.searchInput.value = this.data.label;
		this.searchInput.addEventListener('keydown', (e) => e.stopPropagation());
		this.searchInput.addEventListener('input', () => this.scheduleSearch());
		this.searchWrap.appendChild(this.searchInput);

		this.resultsEl = document.createElement('div');
		this.resultsEl.classList.add('ce-reference-block__results');
		this.searchWrap.appendChild(this.resultsEl);

		panel.appendChild(this.searchWrap);

		this.populateCollections();

		return panel;
	}

	private async populateCollections() {
		if (!this.api || !this.collectionSelect) return;

		if (!this.collectionsLoaded) {
			try {
				const res = await this.api.get(`/items/${TEMPLATES_COLLECTION}`, {
					params: { fields: ['collection', 'name', 'title_field'], limit: -1 },
				});
				this.templateRows = res?.data?.data || [];
			} catch (error) {
				this.templateRows = [];
			}
			this.collectionsLoaded = true;
		}

		if (!this.collectionSelect) return;
		this.collectionSelect.innerHTML = '';

		const placeholder = document.createElement('option');
		placeholder.value = '';
		placeholder.textContent = 'Choose collection…';
		this.collectionSelect.appendChild(placeholder);

		const collections = [...new Set(this.templateRows.map((row) => row.collection))];
		for (const collection of collections) {
			const option = document.createElement('option');
			option.value = collection;
			option.textContent = collection;
			this.collectionSelect.appendChild(option);
		}

		this.collectionSelect.value = this.data.collection;
		this.populateTemplates();
		this.updateVisibility();
	}

	private populateTemplates() {
		if (!this.templateSelect) return;
		this.templateSelect.innerHTML = '';

		const placeholder = document.createElement('option');
		placeholder.value = '';
		placeholder.textContent = 'Choose template…';
		this.templateSelect.appendChild(placeholder);

		for (const row of this.templateRows.filter((r) => r.collection === this.data.collection)) {
			const option = document.createElement('option');
			option.value = row.name || '';
			option.textContent = row.name || '(unnamed)';
			this.templateSelect.appendChild(option);
		}

		this.templateSelect.value = this.data.template;
	}

	private async loadDefaultLanguage() {
		if (this.defaultLanguage !== undefined) return;
		try {
			const res = await this.api.get('/settings', { params: { fields: ['default_language'] } });
			this.defaultLanguage = res?.data?.data?.default_language || '';
		} catch (error) {
			this.defaultLanguage = '';
		}
	}

	private currentRow(): TemplateRow | undefined {
		return this.templateRows.find(
			(row) => row.collection === this.data.collection && row.name === this.data.template,
		);
	}

	private updateVisibility() {
		if (this.templateSelect) this.templateSelect.style.display = this.data.collection ? 'block' : 'none';
		if (this.searchWrap) this.searchWrap.style.display = this.data.collection && this.data.template ? 'block' : 'none';
	}

	private onCollectionChange() {
		this.data.collection = this.collectionSelect?.value || '';
		this.data.template = '';
		this.data.itemId = null;
		this.data.label = '';
		if (this.searchInput) this.searchInput.value = '';
		if (this.resultsEl) this.resultsEl.innerHTML = '';
		this.populateTemplates();
		this.updateVisibility();
		this.setPreview('<em class="ce-reference-block__hint">Choose a template, then pick an item.</em>');
		this.block?.dispatchChange();
	}

	private onTemplateChange() {
		this.data.template = this.templateSelect?.value || '';
		this.data.itemId = null;
		this.data.label = '';
		if (this.searchInput) this.searchInput.value = '';
		if (this.resultsEl) this.resultsEl.innerHTML = '';
		this.updateVisibility();
		this.setPreview('<em class="ce-reference-block__hint">Search and pick an item.</em>');
		this.block?.dispatchChange();
	}

	private scheduleSearch() {
		if (this.searchTimer) clearTimeout(this.searchTimer);
		this.searchTimer = setTimeout(() => this.doSearch(), SEARCH_DEBOUNCE);
	}

	private async doSearch() {
		const row = this.currentRow();
		const query = this.searchInput?.value.trim() || '';
		if (!row || !this.resultsEl || !query) {
			if (this.resultsEl) this.resultsEl.innerHTML = '';
			return;
		}

		const titleField = row.title_field || 'id';
		try {
			const res = await this.api.get(itemsEndpoint(row.collection), {
				params: { search: query, fields: ['id', titleField], limit: 10 },
			});
			const items: any[] = res?.data?.data || [];
			this.renderResults(items, titleField);
		} catch (error) {
			this.resultsEl.innerHTML = '<div class="ce-reference-block__result is-empty">Search failed</div>';
		}
	}

	private renderResults(items: any[], titleField: string) {
		if (!this.resultsEl) return;
		this.resultsEl.innerHTML = '';

		if (!items.length) {
			this.resultsEl.innerHTML = '<div class="ce-reference-block__result is-empty">No results</div>';
			return;
		}

		for (const item of items) {
			const label = String(item[titleField] ?? item.id);
			const result = document.createElement('button');
			result.type = 'button';
			result.classList.add('ce-reference-block__result');
			result.textContent = label;
			result.addEventListener('click', () => this.selectItem(item.id, label));
			this.resultsEl.appendChild(result);
		}
	}

	private selectItem(itemId: string | number, label: string) {
		this.data.itemId = itemId;
		this.data.label = label;
		if (this.searchInput) this.searchInput.value = label;
		if (this.resultsEl) this.resultsEl.innerHTML = '';
		this.block?.dispatchChange();
		this.renderPreview();
	}

	private async renderPreview() {
		if (!this.data.collection || !this.data.template || this.data.itemId == null) {
			this.setPreview('<em class="ce-reference-block__hint">No reference selected — open the block settings (⚙) to choose one.</em>');
			return;
		}

		this.setPreview('<em>Loading…</em>');

		try {
			const templateRes = await this.api.get(`/items/${TEMPLATES_COLLECTION}`, {
				params: {
					filter: { collection: { _eq: this.data.collection }, name: { _eq: this.data.template } },
					fields: ['template'],
					limit: 1,
				},
			});
			const templateRow = templateRes?.data?.data?.[0];
			const templateBlocks: any[] = templateRow?.template?.blocks || [];

			if (!templateBlocks.length) {
				this.setPreview('<em>No template defined.</em>');
				return;
			}

			const itemRes = await this.api.get(`${itemsEndpoint(this.data.collection)}/${this.data.itemId}`, {
				params: { fields: deriveTemplateFields(templateBlocks) },
			});
			const item = itemRes?.data?.data;

			const interpolated = interpolateTemplate(templateBlocks, item, {
				assetBaseUrl: this.assetBaseUrl,
				language: this.defaultLanguage,
			});
			this.setPreview(blocksToHtml(interpolated) || '<em>Empty</em>');
		} catch (error) {
			this.setPreview('<em>Failed to load reference.</em>');
		}
	}

	private setPreview(html: string) {
		if (this.previewEl) this.previewEl.innerHTML = html;
	}

	save(): ReferenceBlockData {
		return this.data;
	}
}

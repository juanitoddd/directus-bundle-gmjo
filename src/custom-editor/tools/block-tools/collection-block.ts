import type { BlockToolConstructorOptions } from '@editorjs/editorjs';
import { operatorsForType, valueInputType, buildItemsParams, renderCollectionHtml } from '../utils/collection-query';
import { createFlexControls, createGridControls, type ContainerConfig } from '../utils/layout-controls';

interface FilterCondition {
	field: string;
	operator: string;
	value: string;
}

interface CollectionBlockData {
	collection: string;
	template: string;
	limit: number;
	sort: { field: string; desc: boolean } | null;
	filters: FilterCondition[];
	container: ContainerConfig;
}

function defaultContainer(): ContainerConfig {
	return {
		type: 'block',
		direction: 'row',
		justify: 'flex-start',
		align: 'center',
		columns: 2,
		alignItems: 'stretch',
		gap: '',
	};
}

interface TemplateRow {
	collection: string;
	name: string;
}

interface FieldMeta {
	field: string;
	type: string;
}

const TEMPLATES_COLLECTION = 'display_templates';
const PREVIEW_DEBOUNCE = 400;
const DEFAULT_LIMIT = 6;

function itemsEndpoint(collection: string): string {
	return collection.startsWith('directus_')
		? `/${collection.slice('directus_'.length)}`
		: `/items/${collection}`;
}

export default class CollectionBlock {
	private data: CollectionBlockData;
	private block: any;
	private api: any;
	private assetBaseUrl: string;

	private templateRows: TemplateRow[] = [];
	private collectionsLoaded = false;
	private fieldsCache: Record<string, FieldMeta[]> = {};
	private defaultLanguage: string | undefined;
	private previewTimer: ReturnType<typeof setTimeout> | null = null;

	private previewEl: HTMLElement | null = null;
	private collectionSelect: HTMLSelectElement | null = null;
	private templateSelect: HTMLSelectElement | null = null;
	private limitInput: HTMLInputElement | null = null;
	private sortFieldSelect: HTMLSelectElement | null = null;
	private sortDirBtn: HTMLButtonElement | null = null;
	private filtersWrap: HTMLElement | null = null;
	private containerSelect: HTMLSelectElement | null = null;
	private containerControls: HTMLDetailsElement | null = null;
	private layoutHolder: HTMLElement | null = null;

	static get toolbox() {
		return {
			title: 'Collection',
			icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="4" rx="1"/><rect x="3" y="10" width="18" height="4" rx="1"/><rect x="3" y="16" width="18" height="4" rx="1"/></svg>',
		};
	}

	constructor({ data, config, block }: BlockToolConstructorOptions) {
		this.block = block;
		this.api = (config as any)?.api || null;
		this.assetBaseUrl = (config as any)?.baseURL || '';

		const incoming = data as Partial<CollectionBlockData> | undefined;
		this.data = {
			collection: incoming?.collection || '',
			template: incoming?.template || '',
			limit: Number(incoming?.limit) > 0 ? Number(incoming?.limit) : DEFAULT_LIMIT,
			sort: incoming?.sort || null,
			filters: Array.isArray(incoming?.filters) ? incoming!.filters : [],
			container: { ...defaultContainer(), ...(incoming?.container || {}) },
		};
	}

	render() {
		const wrapper = document.createElement('div');
		wrapper.classList.add('ce-collection-block');

		this.previewEl = document.createElement('div');
		this.previewEl.classList.add('ce-collection-block__preview');
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
		if (this.data.collection && this.data.template) {
			this.renderPreview();
		} else {
			this.setPreview('<em class="ce-collection-block__hint">Open the block settings (⚙) to choose a collection and template.</em>');
		}
	}

	renderSettings(): HTMLElement {
		const panel = document.createElement('div');
		panel.classList.add('ce-collection-tune');

		this.collectionSelect = this.makeSelect();
		this.collectionSelect.addEventListener('change', () => this.onCollectionChange());
		panel.appendChild(this.labeled('Collection', this.collectionSelect));

		this.templateSelect = this.makeSelect();
		this.templateSelect.addEventListener('change', () => {
			this.data.template = this.templateSelect?.value || '';
			this.commit();
		});
		panel.appendChild(this.labeled('Template', this.templateSelect));

		this.limitInput = document.createElement('input');
		this.limitInput.type = 'number';
		this.limitInput.min = '1';
		this.limitInput.classList.add('ce-tune__input');
		this.limitInput.value = String(this.data.limit);
		this.limitInput.addEventListener('keydown', (e) => e.stopPropagation());
		this.limitInput.addEventListener('input', () => {
			this.data.limit = Number(this.limitInput?.value) || DEFAULT_LIMIT;
			this.schedulePreview();
		});
		this.limitInput.addEventListener('change', () => this.block?.dispatchChange());
		panel.appendChild(this.labeled('Limit', this.limitInput));

		const sortRow = document.createElement('div');
		sortRow.classList.add('ce-collection-tune__sort');
		this.sortFieldSelect = this.makeSelect();
		this.sortFieldSelect.addEventListener('change', () => this.onSortFieldChange());
		this.sortDirBtn = document.createElement('button');
		this.sortDirBtn.type = 'button';
		this.sortDirBtn.classList.add('ce-collection-tune__dir');
		this.sortDirBtn.addEventListener('click', () => this.toggleSortDir());
		sortRow.appendChild(this.sortFieldSelect);
		sortRow.appendChild(this.sortDirBtn);
		panel.appendChild(this.labeled('Sort', sortRow));

		this.filtersWrap = document.createElement('div');
		this.filtersWrap.classList.add('ce-collection-tune__filters');
		panel.appendChild(this.labeled('Filters', this.filtersWrap));

		const addBtn = document.createElement('button');
		addBtn.type = 'button';
		addBtn.classList.add('ce-collection-tune__add');
		addBtn.textContent = '+ Add filter';
		addBtn.addEventListener('click', () => {
			this.data.filters.push({ field: '', operator: '', value: '' });
			this.renderFilters();
		});
		panel.appendChild(addBtn);

		this.containerSelect = this.makeSelect();
		this.appendOption(this.containerSelect, 'block', 'Block (stack)');
		this.appendOption(this.containerSelect, 'flex', 'Flex');
		this.appendOption(this.containerSelect, 'grid', 'Grid');
		this.containerSelect.value = this.data.container.type;
		this.containerSelect.addEventListener('change', () => {
			this.data.container.type = (this.containerSelect?.value as ContainerConfig['type']) || 'block';
			this.renderContainerControls();
			this.commit();
		});
		panel.appendChild(this.labeled('Container', this.containerSelect));

		this.containerControls = document.createElement('details');
		this.containerControls.classList.add('ce-collection-tune__layout');
		const summary = document.createElement('summary');
		summary.textContent = 'Layout options';
		this.containerControls.appendChild(summary);
		this.layoutHolder = document.createElement('div');
		this.layoutHolder.classList.add('ce-collection-tune__layout-holder');
		this.containerControls.appendChild(this.layoutHolder);
		panel.appendChild(this.containerControls);
		this.renderContainerControls();

		this.populateSettings();
		return panel;
	}

	private renderContainerControls() {
		if (!this.containerControls || !this.layoutHolder) return;

		this.layoutHolder.innerHTML = '';

		// Block has no options → hide the toggle entirely.
		if (this.data.container.type === 'block') {
			this.containerControls.style.display = 'none';
			this.containerControls.open = false;
			return;
		}

		this.containerControls.style.display = '';
		this.layoutHolder.appendChild(
			this.data.container.type === 'flex'
				? createFlexControls(this.data.container, () => this.commit())
				: createGridControls(this.data.container, () => this.commit()),
		);
	}

	// --- settings population ---------------------------------------------------

	private makeSelect(): HTMLSelectElement {
		const select = document.createElement('select');
		select.classList.add('ce-reference-block__select');
		return select;
	}

	private labeled(text: string, control: HTMLElement): HTMLElement {
		const wrap = document.createElement('label');
		wrap.classList.add('ce-collection-tune__field');
		const span = document.createElement('span');
		span.classList.add('ce-collection-tune__label');
		span.textContent = text;
		wrap.appendChild(span);
		wrap.appendChild(control);
		return wrap;
	}

	private async populateSettings() {
		await this.loadCollections();
		this.fillCollectionOptions();
		this.fillTemplateOptions();
		if (this.data.collection) {
			await this.loadFields(this.data.collection);
		}
		this.fillSortOptions();
		this.updateSortDir();
		this.renderFilters();
	}

	private async loadCollections() {
		if (this.collectionsLoaded) return;
		try {
			const res = await this.api.get(`/items/${TEMPLATES_COLLECTION}`, {
				params: { fields: ['collection', 'name'], limit: -1 },
			});
			this.templateRows = res?.data?.data || [];
		} catch (e) {
			this.templateRows = [];
		}
		this.collectionsLoaded = true;
	}

	private async loadFields(collection: string): Promise<FieldMeta[]> {
		if (this.fieldsCache[collection]) return this.fieldsCache[collection];
		try {
			const res = await this.api.get(`/fields/${collection}`);
			const fields: FieldMeta[] = (res?.data?.data || [])
				.filter((f: any) => f.type && f.type !== 'alias')
				.map((f: any) => ({ field: f.field, type: f.type }));
			this.fieldsCache[collection] = fields;
		} catch (e) {
			this.fieldsCache[collection] = [];
		}
		return this.fieldsCache[collection];
	}

	private fillCollectionOptions() {
		if (!this.collectionSelect) return;
		this.collectionSelect.innerHTML = '';
		this.appendOption(this.collectionSelect, '', 'Choose collection…');
		for (const collection of [...new Set(this.templateRows.map((r) => r.collection))]) {
			this.appendOption(this.collectionSelect, collection, collection);
		}
		this.collectionSelect.value = this.data.collection;
	}

	private fillTemplateOptions() {
		if (!this.templateSelect) return;
		this.templateSelect.innerHTML = '';
		this.appendOption(this.templateSelect, '', 'Choose template…');
		for (const row of this.templateRows.filter((r) => r.collection === this.data.collection)) {
			this.appendOption(this.templateSelect, row.name, row.name || '(unnamed)');
		}
		this.templateSelect.value = this.data.template;
	}

	private fillSortOptions() {
		if (!this.sortFieldSelect) return;
		this.sortFieldSelect.innerHTML = '';
		this.appendOption(this.sortFieldSelect, '', '— no sort —');
		for (const f of this.fieldsCache[this.data.collection] || []) {
			this.appendOption(this.sortFieldSelect, f.field, f.field);
		}
		this.sortFieldSelect.value = this.data.sort?.field || '';
	}

	private appendOption(select: HTMLSelectElement, value: string, label: string) {
		const option = document.createElement('option');
		option.value = value;
		option.textContent = label;
		select.appendChild(option);
	}

	// --- change handlers -------------------------------------------------------

	private async onCollectionChange() {
		this.data.collection = this.collectionSelect?.value || '';
		this.data.template = '';
		this.data.sort = null;
		this.data.filters = [];
		this.fillTemplateOptions();
		if (this.data.collection) await this.loadFields(this.data.collection);
		this.fillSortOptions();
		this.updateSortDir();
		this.renderFilters();
		this.commit();
	}

	private onSortFieldChange() {
		const field = this.sortFieldSelect?.value || '';
		this.data.sort = field ? { field, desc: this.data.sort?.desc || false } : null;
		this.updateSortDir();
		this.commit();
	}

	private toggleSortDir() {
		if (!this.data.sort) return;
		this.data.sort.desc = !this.data.sort.desc;
		this.updateSortDir();
		this.commit();
	}

	private updateSortDir() {
		if (!this.sortDirBtn) return;
		const enabled = !!this.data.sort;
		this.sortDirBtn.disabled = !enabled;
		this.sortDirBtn.textContent = this.data.sort?.desc ? '↓ Desc' : '↑ Asc';
	}

	private renderFilters() {
		if (!this.filtersWrap) return;
		this.filtersWrap.innerHTML = '';
		this.data.filters.forEach((filter, index) => {
			this.filtersWrap!.appendChild(this.buildFilterRow(filter, index));
		});
	}

	private buildFilterRow(filter: FilterCondition, index: number): HTMLElement {
		const row = document.createElement('div');
		row.classList.add('ce-coll-filter-row');

		const fields = this.fieldsCache[this.data.collection] || [];

		const fieldSelect = this.makeSelect();
		this.appendOption(fieldSelect, '', 'field');
		for (const f of fields) this.appendOption(fieldSelect, f.field, f.field);
		fieldSelect.value = filter.field;

		const opSelect = this.makeSelect();
		const valueHolder = document.createElement('span');
		valueHolder.classList.add('ce-coll-filter-row__value');

		const fieldType = () => fields.find((f) => f.field === filter.field)?.type || 'string';

		const rebuildValue = () => {
			opSelect.innerHTML = '';
			for (const op of operatorsForType(fieldType())) this.appendOption(opSelect, op.value, op.label);
			opSelect.value = filter.operator || (opSelect.options[0]?.value ?? '');
			filter.operator = opSelect.value;
			valueHolder.innerHTML = '';
			valueHolder.appendChild(this.buildValueInput(fieldType(), filter));
		};

		fieldSelect.addEventListener('change', () => {
			filter.field = fieldSelect.value;
			filter.operator = '';
			filter.value = '';
			rebuildValue();
			this.commit();
		});

		opSelect.addEventListener('change', () => {
			filter.operator = opSelect.value;
			this.commit();
		});

		const removeBtn = document.createElement('button');
		removeBtn.type = 'button';
		removeBtn.classList.add('ce-coll-filter-row__remove');
		removeBtn.textContent = '×';
		removeBtn.addEventListener('click', () => {
			this.data.filters.splice(index, 1);
			this.renderFilters();
			this.commit();
		});

		row.appendChild(fieldSelect);
		row.appendChild(opSelect);
		row.appendChild(valueHolder);
		row.appendChild(removeBtn);

		rebuildValue();
		return row;
	}

	private buildValueInput(type: string, filter: FilterCondition): HTMLElement {
		const kind = valueInputType(type);

		if (kind === 'boolean') {
			const select = this.makeSelect();
			this.appendOption(select, 'true', 'true');
			this.appendOption(select, 'false', 'false');
			select.value = filter.value || 'true';
			filter.value = select.value;
			select.addEventListener('change', () => {
				filter.value = select.value;
				this.commit();
			});
			return select;
		}

		const input = document.createElement('input');
		input.type = kind;
		input.classList.add('ce-tune__input');
		input.value = filter.value || '';
		input.addEventListener('keydown', (e) => e.stopPropagation());
		input.addEventListener('input', () => {
			filter.value = input.value;
			this.schedulePreview();
		});
		input.addEventListener('change', () => this.block?.dispatchChange());
		return input;
	}

	// --- preview ---------------------------------------------------------------

	private commit() {
		this.block?.dispatchChange();
		this.schedulePreview();
	}

	private schedulePreview() {
		if (this.previewTimer) clearTimeout(this.previewTimer);
		this.previewTimer = setTimeout(() => this.renderPreview(), PREVIEW_DEBOUNCE);
	}

	private async loadDefaultLanguage() {
		if (this.defaultLanguage !== undefined) return;
		try {
			const res = await this.api.get('/settings', { params: { fields: ['default_language'] } });
			this.defaultLanguage = res?.data?.data?.default_language || '';
		} catch (e) {
			this.defaultLanguage = '';
		}
	}

	private async renderPreview() {
		if (!this.data.collection || !this.data.template) {
			this.setPreview('<em class="ce-collection-block__hint">Choose a collection and template.</em>');
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
			const templateBlocks: any[] = templateRes?.data?.data?.[0]?.template?.blocks || [];
			if (!templateBlocks.length) {
				this.setPreview('<em>No template defined.</em>');
				return;
			}

			const params = buildItemsParams(
				{ filters: this.data.filters, sort: this.data.sort, limit: this.data.limit },
				templateBlocks,
			);
			const itemsRes = await this.api.get(itemsEndpoint(this.data.collection), { params });
			const items: any[] = itemsRes?.data?.data || [];

			if (!items.length) {
				this.setPreview('<em class="ce-collection-block__hint">No items match.</em>');
				return;
			}

			this.setPreview(renderCollectionHtml(items, templateBlocks, {
				assetBaseUrl: this.assetBaseUrl,
				language: this.defaultLanguage,
				container: this.data.container,
			}));
		} catch (e) {
			this.setPreview('<em>Failed to load collection.</em>');
		}
	}

	private setPreview(html: string) {
		if (this.previewEl) this.previewEl.innerHTML = html;
	}

	save(): CollectionBlockData {
		return this.data;
	}
}

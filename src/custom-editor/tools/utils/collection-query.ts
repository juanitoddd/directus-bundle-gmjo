import { blocksToHtml, interpolateTemplate, deriveTemplateFields, escapeHtml } from './block-utils';

export interface FilterCondition {
	field: string;
	operator: string;
	value: string;
}

export interface CollectionQuery {
	filters: FilterCondition[];
	sort: { field: string; desc: boolean } | null;
	limit: number;
}

const DEFAULT_LIMIT = 6;

/** Available filter operators for a Directus field type. */
export function operatorsForType(type: string): { value: string; label: string }[] {
	const t = (type || '').toLowerCase();
	const eq = [{ value: 'eq', label: 'equals' }, { value: 'neq', label: 'not equals' }];

	if (['string', 'text', 'uuid', 'hash', 'csv'].includes(t)) {
		return [...eq, { value: 'contains', label: 'contains' }, { value: 'starts_with', label: 'starts with' }, { value: 'ends_with', label: 'ends with' }];
	}
	if (['integer', 'biginteger', 'float', 'decimal', 'number'].includes(t)) {
		return [...eq, { value: 'gt', label: '>' }, { value: 'gte', label: '≥' }, { value: 'lt', label: '<' }, { value: 'lte', label: '≤' }];
	}
	if (['datetime', 'date', 'timestamp', 'time'].includes(t)) {
		return [...eq, { value: 'gt', label: 'after' }, { value: 'gte', label: 'on/after' }, { value: 'lt', label: 'before' }, { value: 'lte', label: 'on/before' }];
	}
	if (t === 'boolean') {
		return [{ value: 'eq', label: 'is' }];
	}
	return eq;
}

/** HTML input type for a field's value editor. */
export function valueInputType(type: string): 'text' | 'number' | 'boolean' | 'date' | 'datetime-local' {
	const t = (type || '').toLowerCase();
	if (['integer', 'biginteger', 'float', 'decimal', 'number'].includes(t)) return 'number';
	if (t === 'boolean') return 'boolean';
	if (t === 'date') return 'date';
	if (['datetime', 'timestamp'].includes(t)) return 'datetime-local';
	return 'text';
}

function coerce(value: string): any {
	if (value === 'true') return true;
	if (value === 'false') return false;
	return value;
}

/** Convert the flat AND filter list to a Directus filter object. */
export function buildFilter(filters: FilterCondition[]): any {
	const valid = (filters || []).filter((f) => f.field && f.operator && f.value !== '' && f.value != null);
	if (!valid.length) return undefined;
	return { _and: valid.map((f) => ({ [f.field]: { [`_${f.operator}`]: coerce(f.value) } })) };
}

/** Build the Directus `/items` query params for a collection block. */
export function buildItemsParams(query: CollectionQuery, templateBlocks: any[]): Record<string, any> {
	const params: Record<string, any> = {
		fields: deriveTemplateFields(templateBlocks),
		limit: query.limit > 0 ? query.limit : DEFAULT_LIMIT,
	};
	const filter = buildFilter(query.filters);
	if (filter) params.filter = filter;
	if (query.sort?.field) params.sort = [(query.sort.desc ? '-' : '') + query.sort.field];
	return params;
}

/** Inline style for the collection container based on its layout type. */
function containerStyle(container: any): string {
	const gap = escapeHtml(container?.gap || '0.75rem');
	if (container?.type === 'flex') {
		return [
			'display: flex',
			'flex-wrap: wrap',
			`flex-direction: ${escapeHtml(container.direction || 'row')}`,
			`justify-content: ${escapeHtml(container.justify || 'flex-start')}`,
			`align-items: ${escapeHtml(container.align || 'center')}`,
			`gap: ${gap}`,
		].join('; ');
	}
	if (container?.type === 'grid') {
		const columns = Math.max(1, Math.round(Number(container.columns) || 1));
		return [
			'display: grid',
			`grid-template-columns: repeat(${columns}, 1fr)`,
			`align-items: ${escapeHtml(container.alignItems || 'stretch')}`,
			`gap: ${gap}`,
		].join('; ');
	}
	// block (default): a simple vertical stack.
	return ['display: flex', 'flex-direction: column', `gap: ${gap}`].join('; ');
}

/** Render a list of items through the template into a container HTML string. */
export function renderCollectionHtml(
	items: any[],
	templateBlocks: any[],
	options: { assetBaseUrl?: string; language?: string; container?: any } = {},
): string {
	const inner = (items || []).map((item) => {
		const html = blocksToHtml(interpolateTemplate(templateBlocks, item, options));
		return `<div class="editorjs-collection__item">${html}</div>`;
	}).join('');
	return `<div class="editorjs-collection" style="${containerStyle(options.container)}">${inner}</div>`;
}

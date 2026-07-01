import { blocksToHtml, interpolateTemplate, deriveTemplateFields, referenceKey, collectionKey } from './block-utils';
import { buildItemsParams, renderCollectionHtml } from './collection-query';

const TEMPLATES_COLLECTION = 'display_templates';

/** Map a collection key to its REST endpoint (system collections differ). */
function itemsEndpoint(collection: string): string {
	return collection.startsWith('directus_')
		? `/${collection.slice('directus_'.length)}`
		: `/items/${collection}`;
}

type Resolvable =
	| { kind: 'reference'; key: string; collection: string; itemId: any; template: string }
	| { kind: 'collection'; key: string; collection: string; template: string; data: any };

/**
 * Recursively collect resolvable blocks (reference + collection), including
 * those nested inside flex/grid cells.
 */
function collectResolvables(blocks: any[] | undefined): Resolvable[] {
	const out: Resolvable[] = [];

	const scan = (arr: any[]) => {
		if (!Array.isArray(arr)) return;
		for (const block of arr) {
			if (!block || typeof block !== 'object') continue;
			const data = block.data || {};

			if (block.type === 'reference' && data.collection && data.itemId != null) {
				out.push({
					kind: 'reference',
					key: referenceKey(data.collection, data.itemId, data.template),
					collection: data.collection,
					itemId: data.itemId,
					template: data.template || '',
				});
			} else if (block.type === 'collectionblock' && data.collection && data.template) {
				out.push({
					kind: 'collection',
					key: collectionKey(data),
					collection: data.collection,
					template: data.template,
					data,
				});
			}

			if (Array.isArray(data.items)) {
				for (const item of data.items) {
					const nested = item?.content?.blocks;
					if (Array.isArray(nested)) scan(nested);
				}
			}

			// Accordion block: title + content rich fields.
			if (Array.isArray(data.title?.blocks)) scan(data.title.blocks);
			if (Array.isArray(data.content?.blocks)) scan(data.content.blocks);
		}
	};

	scan(blocks || []);
	return out;
}

/** All resolvable keys present in `blocks` (for "is anything missing?" checks). */
export function collectResolvableKeys(blocks: any[] | undefined): string[] {
	return collectResolvables(blocks).map((r) => r.key);
}

/**
 * Fetch + render every reference and collection block found in `blocks`,
 * returning a map of key → resolved HTML for `blocksToHtml(blocks, { references })`.
 */
export async function resolveBlocks(
	blocks: any[] | undefined,
	options: { api: any; assetBaseUrl?: string; language?: string },
): Promise<Record<string, string>> {
	const { api, assetBaseUrl = '', language } = options;
	const map: Record<string, string> = {};
	if (!api) return map;

	const templateCache: Record<string, any[] | null> = {};
	const seen = new Set<string>();

	const getTemplate = async (collection: string, name: string): Promise<any[] | null> => {
		const cacheKey = `${collection}:${name}`;
		if (templateCache[cacheKey] !== undefined) return templateCache[cacheKey];
		const res = await api.get(`/items/${TEMPLATES_COLLECTION}`, {
			params: { filter: { collection: { _eq: collection }, name: { _eq: name } }, fields: ['template'], limit: 1 },
		});
		const tpl = res?.data?.data?.[0]?.template?.blocks || null;
		templateCache[cacheKey] = tpl;
		return tpl;
	};

	for (const ref of collectResolvables(blocks)) {
		if (seen.has(ref.key)) continue;
		seen.add(ref.key);

		try {
			const template = await getTemplate(ref.collection, ref.template);
			if (!template || !template.length) continue;

			if (ref.kind === 'reference') {
				const itemRes = await api.get(`${itemsEndpoint(ref.collection)}/${ref.itemId}`, {
					params: { fields: deriveTemplateFields(template) },
				});
				map[ref.key] = blocksToHtml(interpolateTemplate(template, itemRes?.data?.data, { assetBaseUrl, language }));
			} else {
				const params = buildItemsParams(
					{ filters: ref.data.filters || [], sort: ref.data.sort || null, limit: ref.data.limit || 0 },
					template,
				);
				const itemsRes = await api.get(itemsEndpoint(ref.collection), { params });
				map[ref.key] = renderCollectionHtml(itemsRes?.data?.data || [], template, {
					assetBaseUrl,
					language,
					container: ref.data.container,
				});
			}
		} catch (e) {
			// Leave unresolved blocks as placeholders.
		}
	}

	return map;
}

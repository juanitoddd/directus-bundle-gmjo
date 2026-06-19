import { blocksToHtml, interpolateTemplate, deriveTemplateFields, referenceKey } from './block-utils';

const TEMPLATES_COLLECTION = 'display_templates';

function itemsEndpoint(collection: string): string {
	return collection.startsWith('directus_')
		? `/${collection.slice('directus_'.length)}`
		: `/items/${collection}`;
}

export interface RefDescriptor {
	collection: string;
	itemId: any;
	template: string;
}

/**
 * Recursively collect every reference block (incl. inside flex/grid cells).
 */
export function collectReferences(blocks: any[] | undefined): RefDescriptor[] {
	const out: RefDescriptor[] = [];

	const scan = (arr: any[]) => {
		if (!Array.isArray(arr)) return;
		for (const block of arr) {
			if (!block || typeof block !== 'object') continue;
			const data = block.data || {};

			if (block.type === 'reference' && data.collection && data.itemId != null) {
				out.push({ collection: data.collection, itemId: data.itemId, template: data.template || '' });
			}

			if (Array.isArray(data.items)) {
				for (const item of data.items) {
					const nested = item?.content?.blocks;
					if (Array.isArray(nested)) scan(nested);
				}
			}
		}
	};

	scan(blocks || []);
	return out;
}

/**
 * Fetch + interpolate every reference found in `blocks` and return a map of
 * `referenceKey` → resolved HTML, suitable for `blocksToHtml(blocks, { references })`.
 */
export async function resolveReferences(
	blocks: any[] | undefined,
	options: { api: any; assetBaseUrl?: string; language?: string },
): Promise<Record<string, string>> {
	const { api, assetBaseUrl = '', language } = options;
	const map: Record<string, string> = {};
	if (!api) return map;

	const templateCache: Record<string, any[] | null> = {};
	const seen = new Set<string>();

	for (const ref of collectReferences(blocks)) {
		const key = referenceKey(ref.collection, ref.itemId, ref.template);
		if (seen.has(key)) continue;
		seen.add(key);

		try {
			const cacheKey = `${ref.collection}:${ref.template}`;
			let template = templateCache[cacheKey];
			if (template === undefined) {
				const tplRes = await api.get(`/items/${TEMPLATES_COLLECTION}`, {
					params: {
						filter: { collection: { _eq: ref.collection }, name: { _eq: ref.template } },
						fields: ['template'],
						limit: 1,
					},
				});
				template = tplRes?.data?.data?.[0]?.template?.blocks || null;
				templateCache[cacheKey] = template;
			}
			if (!template || !template.length) continue;

			const itemRes = await api.get(`${itemsEndpoint(ref.collection)}/${ref.itemId}`, {
				params: { fields: deriveTemplateFields(template) },
			});
			const item = itemRes?.data?.data;

			map[key] = blocksToHtml(interpolateTemplate(template, item, { assetBaseUrl, language }));
		} catch (e) {
			// Leave unresolved references as placeholders.
		}
	}

	return map;
}

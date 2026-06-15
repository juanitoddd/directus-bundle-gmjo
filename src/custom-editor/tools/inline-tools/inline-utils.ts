import type { API } from '@editorjs/editorjs';
import type { MenuConfig } from '@editorjs/editorjs/types/tools/menu-config';

type StyleProperty = 'fontFamily' | 'fontWeight' | 'fontSize';

export interface InlineMenuOption {
	value: string;
	label: string;
}

/**
 * Capture the current selection range so it can be applied later from a
 * popover item's onActivate handler (render runs while the selection is live).
 */
export function captureSelectionRange(): Range | null {
	const selection = window.getSelection();
	if (!selection || selection.rangeCount === 0) {
		return null;
	}
	return selection.getRangeAt(0).cloneRange();
}

/**
 * Build a declarative inline-toolbar item that renders a compact button whose
 * options open in a nested popover (instead of a wide <select>). The active
 * option is highlighted, and the button title shows the current value.
 */
export function buildInlineMenu(config: {
	icon: string;
	title: string;
	currentValue: string;
	options: InlineMenuOption[];
	onSelect: (value: string) => void;
}): MenuConfig {
	return {
		icon: config.icon,
		title: config.title,
		children: {
			searchable: false,
			items: config.options.map((option) => ({
				title: option.label,
				isActive: config.currentValue === option.value,
				closeOnActivate: true,
				onActivate: () => config.onSelect(option.value),
			})),
		},
	} as MenuConfig;
}

interface StyledSpanConfig {
	className: string;
	styleProperty: StyleProperty;
}

/**
 * Replace an element with its children (and merge adjacent text nodes).
 */
function unwrap(el: HTMLElement) {
	const parent = el.parentNode;
	if (!parent) return;
	while (el.firstChild) {
		parent.insertBefore(el.firstChild, el);
	}
	parent.removeChild(el);
	(parent as Element).normalize?.();
}

/**
 * Find an ancestor span of the given class that the range *fully* covers, so we
 * can update it in place instead of nesting a new span. Returns null when the
 * selection only covers part of the span (a new, overriding span is correct
 * there) or when there is no such ancestor.
 */
function findFullyCoveredSpan(range: Range, className: string): HTMLElement | null {
	const container = range.commonAncestorContainer;
	let el: HTMLElement | null =
		container.nodeType === Node.TEXT_NODE
			? container.parentElement
			: (container as HTMLElement);

	while (el) {
		if (el.classList?.contains(className)) {
			const full = document.createRange();
			full.selectNodeContents(el);

			const coversStart = range.compareBoundaryPoints(Range.START_TO_START, full) <= 0;
			const coversEnd = range.compareBoundaryPoints(Range.END_TO_END, full) >= 0;

			return coversStart && coversEnd ? el : null;
		}
		el = el.parentElement;
	}

	return null;
}

/**
 * Remove spans that no longer serve a purpose within the current block:
 * empty spans, and spans of our class that carry no value for our style
 * property (e.g. left over after an edit).
 */
export function cleanupSpans(scope: HTMLElement, config: StyledSpanConfig) {
	const root = (scope.closest?.('.ce-block') as HTMLElement | null) || scope.parentElement || scope;
	const spans = root.querySelectorAll<HTMLElement>(`span.${config.className}`);

	spans.forEach((span) => {
		if (!span.textContent) {
			span.remove();
			return;
		}

		if (!span.style[config.styleProperty]) {
			unwrap(span);
		}
	});
}

/**
 * Apply a styled span over the range. If the range fully covers an existing
 * span of the same class, update that span instead of nesting a new one. Inner
 * formatting (other inline tools) is preserved.
 */
export function applyStyledSpan(
	range: Range | null,
	value: string,
	config: StyledSpanConfig,
	api: API,
): void {
	if (!range) return;

	const existing = findFullyCoveredSpan(range, config.className);
	if (existing) {
		existing.style[config.styleProperty] = value;
		cleanupSpans(existing, config);
		api.selection.expandToTag(existing);
		return;
	}

	const span = document.createElement('span');
	span.classList.add(config.className);
	span.style[config.styleProperty] = value;
	span.appendChild(range.extractContents());
	range.insertNode(span);

	cleanupSpans(span, config);
	api.selection.expandToTag(span);
}

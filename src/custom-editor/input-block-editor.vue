<script setup lang="ts">
// CORE-CHANGE start
import { useApi, useStores } from '@directus/extensions-sdk';
// CORE-CHANGE end
import EditorJS from '@editorjs/editorjs';
import { cloneDeep, isEqual } from 'lodash';
import { onMounted, onUnmounted, nextTick, ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useBus } from './bus';
import { unexpectedError } from './error';
import getTools from './tools';
import { useFileHandler } from './file-handler';

const props = withDefaults(
	defineProps<{
		disabled?: boolean;
		autofocus?: boolean;
		value?: Record<string, any> | null;
		bordered?: boolean;
		placeholder?: string;
		tools?: string[];
		folder?: string;
		font?: 'sans-serif' | 'monospace' | 'serif';
	}>(),
	{
		value: null,
		bordered: true,
		tools: () => [
			'header',
			'nestedlist',
			/*
			'embed',
			'raw',
			'code',
			*/			
			'image',
			'paragraph',
			'underline',
			'ColorPicker',
			'WeightPicker',
			'FontFamilyPicker',
			'FontSizePicker',
			'htmlblock',
			'flexblock',
			'gridblock',
			'button',
			'reference',
			'collectionblock',
			'delimiterblock',
			'componentblock',
		],
		font: 'sans-serif',
	},
);

const emit = defineEmits<{ input: [value: EditorJS.OutputData | null] }>();

// https://github.com/codex-team/editor.js/blob/057bf17a6fc2d5e05c662107918d7c3e943d077c/src/components/events/RedactorDomChanged.ts#L4
const RedactorDomChanged = 'redactor dom changed';

const bus = useBus();

const { t } = useI18n();

// CORE-CHANGE start
const { useCollectionsStore } = useStores();
// CORE-CHANGE end
const collectionStore = useCollectionsStore();

const { currentPreview, setCurrentPreview, fileHandler, setFileHandler, unsetFileHandler, handleFile } =
        useFileHandler();

const editorjsRef = ref<EditorJS>();
const editorjsIsReady = ref(false);
const uploaderComponentElement = ref<HTMLElement>();
const editorElement = ref<HTMLElement>();
const haveFilesAccess = Boolean(collectionStore.getCollection('directus_files'));
const haveValuesChanged = ref(false);
// Nested rich-content drawers (a flex/grid cell can itself contain flex/grid
// blocks). We keep a stack of drawers, each with its own EditorJS instance.
interface FlexDrawerEntry {
	id: number;
	data: EditorJS.OutputData | null;
	callback: (item: any) => void;
	editor?: EditorJS;
	ready: boolean;
}
const MAX_FLEX_DEPTH = 3;
const flexStackIds = ref<number[]>([]);
const flexEntries = new Map<number, FlexDrawerEntry>();
const flexHolders = new Map<number, HTMLElement>();
let flexDrawerCounter = 0;
const router = useRouter();

// CORE-CHANGE start
const api = useApi();

// CORE-CHANGE end

function openFlexItemEditor(params: { data?: EditorJS.OutputData | null; callback: (item: any) => void }) {
	if (flexStackIds.value.length >= MAX_FLEX_DEPTH) {
		unexpectedError(new Error(`Maximum nesting depth (${MAX_FLEX_DEPTH}) reached.`));
		return;
	}
	const id = ++flexDrawerCounter;
	flexEntries.set(id, { id, data: params.data || null, callback: params.callback, ready: false });
	flexStackIds.value = [...flexStackIds.value, id];
}

function setFlexHolder(id: number, el: Element | null) {
	if (el) flexHolders.set(id, el as HTMLElement);
	else flexHolders.delete(id);
}

async function popFlexDrawer(id: number) {
	const index = flexStackIds.value.indexOf(id);
	if (index === -1) return;

	// Close this drawer and any deeper ones above it.
	const removed = flexStackIds.value.slice(index);
	flexStackIds.value = flexStackIds.value.slice(0, index);

	for (const removedId of removed) {
		const entry = flexEntries.get(removedId);
		try {
			await entry?.editor?.destroy();
		}
		catch (error) {
			// ignore
		}
		flexEntries.delete(removedId);
		flexHolders.delete(removedId);
	}
}

async function confirmFlexDrawer(id: number) {
	const entry = flexEntries.get(id);
	if (!entry || !entry.editor || !entry.ready) return;

	try {
		const result = await entry.editor.saver.save();
		entry.callback({ type: 'rich', content: result });
	}
	catch (error) {
		unexpectedError(error);
	}
	finally {
		await popFlexDrawer(id);
	}
}

// Instantiate a nested EditorJS for each newly pushed drawer.
watch(() => flexStackIds.value.length, async (len, prev) => {
	if (len <= prev) return;
	await nextTick();

	const id = flexStackIds.value[len - 1];
	const entry = flexEntries.get(id);
	const holder = flexHolders.get(id);
	if (!entry || entry.editor || !holder) return;

	// The deepest allowed level uses a tools set without flex/grid blocks.
	const drawerTools = len >= MAX_FLEX_DEPTH ? nestedTools : tools;

	entry.editor = new EditorJS({
		holder,
		readOnly: false,
		minHeight: 200,
		onChange: () => {},
		tools: drawerTools,
	});

	await entry.editor.isReady;
	entry.ready = true;

	if (entry.data) {
		await entry.editor.render(entry.data);
	} else {
		entry.editor.clear();
	}
});

async function destroyAllFlexDrawers() {
	for (const entry of flexEntries.values()) {
		try {
			await entry.editor?.destroy();
		}
		catch (error) {
			// ignore
		}
	}
	flexEntries.clear();
	flexHolders.clear();
	flexStackIds.value = [];
}

const tools = getTools(
	{
		baseURL: api.defaults.baseURL,
		setFileHandler,
		setCurrentPreview,
		getUploadFieldElement: () => uploaderComponentElement,
		openFlexEditor: openFlexItemEditor,
		api,
	},
	props.tools,
	haveFilesAccess,
);

// Tools for the deepest nested drawer: no flex/grid blocks, so the editor can't
// open a further drawer (enforces the depth cap by hiding the option).
const nestedTools = { ...tools };
delete (nestedTools as Record<string, unknown>).flexblock;
delete (nestedTools as Record<string, unknown>).gridblock;

// Edit drawer z-index = 2000 + depth*20. Keep the upload drawer above the
// deepest open edit drawer so it never appears behind a nested editor.
const FLEX_DRAWER_BASE_Z = 2000;
const FLEX_DRAWER_STEP_Z = 20;
const uploadZIndex = computed(() => FLEX_DRAWER_BASE_Z + (flexStackIds.value.length + 1) * FLEX_DRAWER_STEP_Z + 40);

bus.on(async (event) => {
	if (event.type === 'open-url') {
		router.push(event.payload);
	}
});

onMounted(async () => {

	// Load custom fonts via FontFace API so they are available to Editor.js
	const loadCustomFonts = async () => {
		const fonts = [
			{ name: 'GTEestiProText', file: './assets/fonts/GTEestiProText-Regular.ttf' },
			{ name: 'GTEestiProText Bold', file: './assets/fonts/GTEestiProText-Bold.ttf' },
		];

		await Promise.all(
			fonts.map(async (f) => {
				try {
					const url = new URL(f.file, import.meta.url).href;
					const ff = new FontFace(f.name, `url(${url})`);
					await ff.load();
					(document as any).fonts.add(ff);
				}
				catch (e) {
					console.warn('Failed to load font', f.name, e);
				}
			}),
		);
	};

	await loadCustomFonts();

	console.log("Editor props tools", tools)

	editorjsRef.value = new EditorJS({
		// logLevel: 'ERROR' as EditorJS.LogLevels,
		logLevel: 'VERBOSE' as EditorJS.LogLevels,
		holder: editorElement.value,
		readOnly: false,
		placeholder: props.placeholder,
		minHeight: 72,
		onChange: (api) => emitValue(api),
		tools,
	});

	await editorjsRef.value.isReady;	

	const sanitizedValue = sanitizeValue(props.value);

	if (sanitizedValue) {
		await editorjsRef.value.render(sanitizedValue);
	}

	if (props.autofocus) {
		editorjsRef.value.focus();
	}

	editorjsRef.value.on(RedactorDomChanged, () => {
		emitValue(editorjsRef.value!);
	});

	editorjsIsReady.value = true;
});

onUnmounted(async () => {
	editorjsRef.value?.destroy();
	await destroyAllFlexDrawers();
	bus.reset();
});

watch(
	() => props.value,
	async (newVal, oldVal) => {		
		// First value will be set in 'onMounted'
		if (!editorjsRef.value || !editorjsIsReady.value)
			return;

		if (haveValuesChanged.value) {
			haveValuesChanged.value = false;
			return;
		}

		if (isEqual(newVal?.blocks, oldVal?.blocks))
			return;

		try {
			const sanitizedValue = sanitizeValue(newVal);

			if (sanitizedValue) {
				await editorjsRef.value.render(sanitizedValue);
			}
			else {
				editorjsRef.value.clear();
			}
		}
		catch (error) {
			unexpectedError(error);
		}
	},
);

async function emitValue(context: EditorJS.API | EditorJS) {
	if (props.disabled || !context || !context.saver)
		return;

	try {
		const result = await context.saver.save();

		haveValuesChanged.value = true;

		if (!result || result.blocks.length === 0) {
			emit('input', null);
			return;
		}

		if (isEqual(result.blocks, props.value?.blocks))
			return;

		emit('input', result);
	}
	catch (error) {
		unexpectedError(error);
	}
}

function sanitizeValue(value: any): EditorJS.OutputData | null {
	if (!value || typeof value !== 'object' || !value.blocks || value.blocks.length === 0)
		return null;

	return cloneDeep({
		time: value?.time || Date.now(),
		version: value?.version || '0.0.0',
		blocks: value.blocks,
	});
}
</script>

<template>
	<div class="input-block-editor">
		<div ref="editorElement" :class="{ [font]: true, disabled, bordered }" />

		<v-drawer
			v-for="(id, index) in flexStackIds" :key="id"
			v-show="!disabled" :model-value="true" icon="edit"
			:title="`${t('Flex Item')} · level ${index + 1}`" cancelable
			:style="{ zIndex: FLEX_DRAWER_BASE_Z + index * FLEX_DRAWER_STEP_Z }"
			@update:model-value="(v: boolean) => { if (!v) popFlexDrawer(id); }"
			@cancel="popFlexDrawer(id)"
		>
			<div class="flex-editor-drawer-content">
				<div :ref="(el: any) => setFlexHolder(id, el)" class="flex-editor-holder"></div>
				<div class="flex-editor-actions">
					<VButton :icon="true" :rounded="true" @click="popFlexDrawer(id)" :outlined="true"><VIcon name="cancel" /></VButton>
					<VButton :icon="true" :rounded="true" @click="confirmFlexDrawer(id)"><VIcon name="check" /></VButton>
				</div>
			</div>
		</v-drawer>

		<v-drawer
			v-if="haveFilesAccess && !disabled && fileHandler !== null" :model-value="true" icon="image"
			:title="t('upload_from_device')" cancelable @update:model-value="unsetFileHandler"
			@cancel="unsetFileHandler"
			:style="{ zIndex: uploadZIndex }"
		>
			<div class="uploader-drawer-content">
				<div v-if="currentPreview" class="uploader-preview-image">
					<img :src="currentPreview">
				</div>
				<v-upload
					:ref="uploaderComponentElement" :multiple="false" :folder="folder" from-library from-url
					@input="handleFile"
				/>
			</div>
		</v-drawer>
	</div>
</template>

<style lang="scss">
	@import './css/fonts.css';
	@import './css/icons.css';
  @import './css/overrides.css';
</style>

<style lang="scss" scoped>
.btn--default {
	color: #fff !important;
	background-color: #0d6efd;
	border-color: #0d6efd;
}

.btn--gray {
	color: #fff !important;
	background-color: #7c7c7c;
	border-color: #7c7c7c;
}

.disabled {
	color: var(--theme--form--field--input--foreground-subdued);
	background-color: var(--theme--form--field--input--background-subdued);
	border-color: var(--theme--form--field--input--border-color);
	pointer-events: none;
}

.bordered {	
	padding: 14px;
	background-color: var(--theme--background);
	border: 2px solid var(--theme--form--field--input--border-color);
	border-radius: var(--theme--border-radius);

	&:hover {
		border-color: var(--theme--form--field--input--border-color-hover);
	}

	&:focus-within {
		border-color: var(--theme--form--field--input--border-color-focus);
	}
}

.monospace {
	font-family: var(--theme--fonts--monospace--font-family);
}

.serif {
	font-family: var(--theme--fonts--serif--font-family);
}

.sans-serif {
	font-family: var(--theme--fonts--sans--font-family);
}

.uploader-drawer-content {
	padding: var(--content-padding);
	padding-top: 0;
	padding-bottom: var(--content-padding);
}

.uploader-preview-image {
	margin-bottom: var(--theme--form--row-gap);
	background-color: var(--theme--background-normal);
	border-radius: var(--theme--border-radius);
}

.uploader-preview-image img {
	display: block;
	width: auto;
	max-width: 100%;
	height: auto;
	max-height: 40vh;
	margin: 0 auto;
	object-fit: contain;
}

.flex-editor-drawer-content {
	padding: var(--content-padding);
}

.flex-editor-holder {
	min-height: 320px;	
	border-radius: var(--theme--border-radius);	
	border: 2px solid var(--theme--form--field--input--border-color-focus);
	padding: 0.75rem;
}

.flex-editor-actions {
	display: flex;
	justify-content: flex-end;
	gap: 0.75rem;
	margin-top: 1rem;
}

/* Image Size Tune Styles */
.ce-image-size-settings {
	display: flex;
	flex-direction: column;
	gap: 0.75rem;
	padding: 0.75rem 0;
}

.ce-image-size-field {
	display: flex;
	flex-direction: column;
	gap: 0.35rem;
}

.ce-image-size-label {
	font-size: 0.85rem;
	font-weight: 500;
	color: var(--theme--form--field--input--foreground);
}

.ce-image-size-input {
	padding: 0.5rem;
	border: 1px solid var(--theme--form--field--input--border-color);
	border-radius: var(--theme--border-radius);
	background: var(--theme--form--field--input--background);
	color: var(--theme--form--field--input--foreground);
	font-size: 0.85rem;
}

.ce-image-size-input:focus {
	outline: none;
	border-color: var(--theme--form--field--input--border-color-focus);
	box-shadow: 0 0 0 2px var(--theme--primary-color, #0d6efd);
}
</style>
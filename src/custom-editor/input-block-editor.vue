<script setup lang="ts">
// CORE-CHANGE start
import { useApi, useStores } from '@directus/extensions-sdk';
// CORE-CHANGE end
import EditorJS from '@editorjs/editorjs';
import { cloneDeep, isEqual } from 'lodash';
import { onMounted, onUnmounted, nextTick, ref, watch } from 'vue';
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
			'htmlblock',
			'flexblock',
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
const flexEditorjsRef = ref<EditorJS>();
const flexEditorjsIsReady = ref(false);
const flexEditorElement = ref<HTMLElement>();
const flexEditorData = ref<EditorJS.OutputData | null>(null);
const flexEditorOpen = ref(false);
const flexEditorCallback = ref<((item: any) => void) | null>(null);
const router = useRouter();

// CORE-CHANGE start
const api = useApi();

// CORE-CHANGE end

function openFlexItemEditor(params: { data?: EditorJS.OutputData | null; callback: (item: any) => void }) {
	flexEditorData.value = params.data || null;
	flexEditorCallback.value = params.callback;
	flexEditorOpen.value = true;
}

async function createFlexEditor() {
	await nextTick();
	if (!flexEditorElement.value) return;

	if (!flexEditorjsRef.value) {
		flexEditorjsRef.value = new EditorJS({
			holder: flexEditorElement.value,
			readOnly: false,			
			minHeight: 200,
			onChange: () => {},
			tools,
		});

		await flexEditorjsRef.value.isReady;
		flexEditorjsIsReady.value = true;
	}

	if (flexEditorData.value) {
		await flexEditorjsRef.value.render(flexEditorData.value);
	} else {
		flexEditorjsRef.value.clear();
	}
}

async function destroyFlexEditor() {
	if (flexEditorjsRef.value) {
		await flexEditorjsRef.value.destroy();
		flexEditorjsRef.value = undefined;
	}
	flexEditorjsIsReady.value = false;
}

function cancelFlexEditor() {
	flexEditorOpen.value = false;
	flexEditorCallback.value = null;
	flexEditorData.value = null;
}

function onFlexDrawerUpdate(value: boolean) {
	if (!value) cancelFlexEditor();
}

async function confirmFlexEditor() {
	if (!flexEditorjsRef.value || !flexEditorjsIsReady.value) return;

	try {
		const result = await flexEditorjsRef.value.saver.save();
		if (flexEditorCallback.value) {
			flexEditorCallback.value({
				type: 'rich',
				content: result,
			});
		}
	}
	catch (error) {
		unexpectedError(error);
	}
	finally {
		cancelFlexEditor();
	}
}

watch(flexEditorOpen, async (open) => {
	if (open) {
		await createFlexEditor();
	} else {
		await destroyFlexEditor();
	}
});

const tools = getTools(
	{
		baseURL: api.defaults.baseURL,
		setFileHandler,
		setCurrentPreview,
		getUploadFieldElement: () => uploaderComponentElement,
		openFlexEditor: openFlexItemEditor,
	},
	props.tools,
	haveFilesAccess,
);

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
	await destroyFlexEditor();
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
			v-if="!disabled" :model-value="flexEditorOpen" icon="edit"
			:title="t('Flex Item')" cancelable
			@update:model-value="onFlexDrawerUpdate"
			@cancel="cancelFlexEditor"
			style="z-index: 2000;"
		>
			<div class="flex-editor-drawer-content">
				<div ref="flexEditorElement" class="flex-editor-holder"></div>
				<div class="flex-editor-actions">
					<VButton :icon="true" :rounded="true" @click="cancelFlexEditor" :outlined="true"><VIcon name="cancel" /></VButton>
					<VButton :icon="true" :rounded="true" @click="confirmFlexEditor"><VIcon name="check" /></VButton>
				</div>
			</div>
		</v-drawer>

		<v-drawer
			v-if="haveFilesAccess && !disabled" :model-value="fileHandler !== null" icon="image"
			:title="t('upload_from_device')" cancelable @update:model-value="unsetFileHandler"
			@cancel="unsetFileHandler"
			style="z-index: 2100;"
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
</style>
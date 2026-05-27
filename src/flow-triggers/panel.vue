<template>
	<div class="flow-triggers-panel" :class="`layout-${layout}`">
		<div v-if="!buttons || buttons.length === 0" class="empty">
			<v-icon name="play_disabled" />
			<p>No buttons configured. Open this panel's options to add some.</p>
		</div>

		<template v-else>
			<v-button
				v-for="(btn, idx) in buttons"
				:key="idx"
				:loading="loading[idx]"
				:disabled="loading[idx] || !btn.flow_id"
				:secondary="!btn.color"
				:style="btn.color ? { '--v-button-background-color': btn.color, '--v-button-background-color-hover': btn.color } : {}"
				@click="onClick(btn, idx)"
			>
				<v-icon v-if="btn.icon" :name="btn.icon" left />
				{{ btn.label || 'Untitled' }}
			</v-button>
		</template>

		<v-dialog v-model="confirmOpen" @esc="cancelConfirm">
			<v-card>
				<v-card-title>{{ pending?.btn.label }}</v-card-title>
				<v-card-text>{{ pending?.btn.confirm_message }}</v-card-text>
				<v-card-actions>
					<v-button secondary @click="cancelConfirm">Cancel</v-button>
					<v-button @click="acceptConfirm">Run</v-button>
				</v-card-actions>
			</v-card>
		</v-dialog>
	</div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { useApi, useStores } from '@directus/extensions-sdk';

interface ButtonConfig {
	label: string;
	flow_id: string;
	icon?: string;
	color?: string;
	confirm_message?: string;
	payload?: unknown;
}

const props = withDefaults(
	defineProps<{
		buttons?: ButtonConfig[];
		layout?: 'vertical' | 'horizontal' | 'grid';
	}>(),
	{
		buttons: () => [],
		layout: 'vertical',
	},
);

const api = useApi();
const { useNotificationsStore } = useStores();
const notifications = useNotificationsStore();

const loading = reactive<Record<number, boolean>>({});
const confirmOpen = ref(false);
const pending = ref<{ btn: ButtonConfig; idx: number } | null>(null);

function onClick(btn: ButtonConfig, idx: number) {
	if (btn.confirm_message) {
		pending.value = { btn, idx };
		confirmOpen.value = true;
		return;
	}
	void run(btn, idx);
}

function cancelConfirm() {
	confirmOpen.value = false;
	pending.value = null;
}

function acceptConfirm() {
	if (!pending.value) return;
	const { btn, idx } = pending.value;
	confirmOpen.value = false;
	pending.value = null;
	void run(btn, idx);
}

async function run(btn: ButtonConfig, idx: number) {
	loading[idx] = true;
	try {
		await api.post(`/flows/trigger/${btn.flow_id}`, btn.payload ?? {});
		notifications.add({
			title: `${btn.label}: triggered`,
			type: 'success',
		});
	} catch (err: unknown) {
		const message = extractErrorMessage(err);
		notifications.add({
			title: `${btn.label}: failed`,
			text: message,
			type: 'error',
			dialog: true,
		});
	} finally {
		loading[idx] = false;
	}
}

function extractErrorMessage(err: unknown): string {
	if (typeof err === 'object' && err !== null) {
		const anyErr = err as { response?: { data?: { errors?: { message?: string }[] } }; message?: string };
		const apiMsg = anyErr.response?.data?.errors?.[0]?.message;
		if (apiMsg) return apiMsg;
		if (anyErr.message) return anyErr.message;
	}
	return String(err);
}
</script>

<style scoped>
.flow-triggers-panel {
	padding: 12px;
	height: 100%;
	overflow: auto;
	display: flex;
	gap: 8px;
}

.layout-vertical {
	flex-direction: column;
	align-items: stretch;
}

.layout-horizontal {
	flex-direction: row;
	flex-wrap: wrap;
	align-items: flex-start;
}

.layout-grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
}

.empty {
	width: 100%;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 8px;
	color: var(--theme--foreground-subdued);
	text-align: center;
}
</style>

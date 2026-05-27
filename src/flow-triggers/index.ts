import { definePanel } from '@directus/extensions-sdk';
import PanelComponent from './panel.vue';

export default definePanel({
	id: 'gmjo-flow-triggers',
	name: 'Flow Triggers',
	icon: 'play_circle',
	description: 'Buttons that trigger Directus Flows via webhook.',
	component: PanelComponent,
	options: [
		{
			field: 'buttons',
			type: 'json',
			name: 'Buttons',
			meta: {
				interface: 'list',
				options: {
					addLabel: 'Add button',
					template: '{{ label }} → {{ flow_id }}',
					fields: [
						{
							field: 'label',
							name: 'Label',
							type: 'string',
							meta: {
								interface: 'input',
								required: true,
								width: 'half',
							},
						},
						{
							field: 'flow_id',
							name: 'Flow ID',
							type: 'string',
							meta: {
								interface: 'input',
								required: true,
								width: 'half',
								note: 'UUID of the Flow with a Webhook trigger.',
							},
						},
						{
							field: 'icon',
							name: 'Icon',
							type: 'string',
							meta: {
								interface: 'select-icon',
								width: 'half',
							},
						},
						{
							field: 'color',
							name: 'Color',
							type: 'string',
							meta: {
								interface: 'select-color',
								width: 'half',
							},
						},
						{
							field: 'confirm_message',
							name: 'Confirmation message',
							type: 'string',
							meta: {
								interface: 'input',
								width: 'full',
								note: 'If set, the user must confirm before the action runs.',
							},
						},
						{
							field: 'payload',
							name: 'Payload (JSON)',
							type: 'json',
							meta: {
								interface: 'input-code',
								options: { language: 'json' },
								width: 'full',
								note: 'Optional JSON body POSTed to the flow trigger.',
							},
						},
						{
							field: 'auth_token',
							name: 'Auth token (optional)',
							type: 'string',
							meta: {
								interface: 'input',
								options: { masked: true },
								width: 'full',
								note: 'Sent as `Authorization: Bearer <token>`, overriding the dashboard user\'s session for this button. WARNING: stored as plaintext in this panel\'s config — anyone who can read this dashboard can read this token. Prefer a dedicated low-privilege user.',
							},
						},
					],
				},
			},
		},
		{
			field: 'layout',
			type: 'string',
			name: 'Layout',
			schema: { default_value: 'vertical' },
			meta: {
				interface: 'select-dropdown',
				options: {
					choices: [
						{ text: 'Vertical', value: 'vertical' },
						{ text: 'Horizontal', value: 'horizontal' },
						{ text: 'Grid', value: 'grid' },
					],
				},
				width: 'half',
			},
		},
	],
	minWidth: 8,
	minHeight: 6,
});

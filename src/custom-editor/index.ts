import { defineInterface } from '@directus/extensions';
import InterfaceBlockEditor from './input-block-editor.vue';

export default defineInterface({
	id: 'custom-input-block-editor',
	name: 'Custom Input Block Editor',
	description: 'Custom block editor',
	icon: 'code',
	component: InterfaceBlockEditor,
	types: ['json'],
	group: 'standard',
  options: null,
});
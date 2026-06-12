import type { INodeType, INodeTypeDescription } from 'n8n-workflow';

import { chatFields, chatOperations } from './descriptions/ChatDescription';
import { messageFields, messageOperations } from './descriptions/MessageDescription';

export class Happ implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Happ',
		name: 'happ',
		icon: 'file:happ.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description:
			'Interact with the Happ Platform API: messenger chats, messages and AI assistants',
		defaults: {
			name: 'Happ',
		},
		inputs: ['main'],
		outputs: ['main'],
		usableAsTool: true,
		credentials: [
			{
				name: 'happApi',
				required: true,
			},
		],
		requestDefaults: {
			baseURL: '={{$credentials.baseUrl}}',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
			},
		},
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Chat', value: 'chat' },
					{ name: 'Message', value: 'message' },
				],
				default: 'message',
			},
			...chatOperations,
			...chatFields,
			...messageOperations,
			...messageFields,
		],
	};
}

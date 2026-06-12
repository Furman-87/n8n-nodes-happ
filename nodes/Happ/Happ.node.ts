import type {
	IDataObject,
	ILoadOptionsFunctions,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';

import { assistantFields, assistantOperations } from './descriptions/AssistantDescription';
import { chatFields, chatOperations } from './descriptions/ChatDescription';
import { messageFields, messageOperations } from './descriptions/MessageDescription';
import { happApiRequest, toListItems } from './GenericFunctions';

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
					{ name: 'Assistant', value: 'assistant' },
					{ name: 'Chat', value: 'chat' },
					{ name: 'Message', value: 'message' },
				],
				default: 'message',
			},
			...assistantOperations,
			...assistantFields,
			...chatOperations,
			...chatFields,
			...messageOperations,
			...messageFields,
		],
	};

	methods = {
		loadOptions: {
			async getAssistants(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const response = await happApiRequest.call(this, 'GET', '/api/assistants', {
					take: 100,
				});
				return toListItems(response).map((assistant: IDataObject) => ({
					name: String(assistant.name ?? assistant.id),
					value: String(assistant.id),
				}));
			},
			async getCompanies(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				// /api/companies/my requires a JWT; /api/companies works with an
				// access token and returns only the token's company.
				const response = await happApiRequest.call(this, 'GET', '/api/companies', {
					take: 100,
				});
				return toListItems(response).map((company: IDataObject) => ({
					name: String(company.name ?? company.id),
					value: String(company.id),
				}));
			},
		},
	};
}

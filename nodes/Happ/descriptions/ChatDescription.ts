import type { INodeProperties } from 'n8n-workflow';

export const chatOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['chat'] } },
		options: [
			{
				name: 'Assign Assistant',
				value: 'assignAssistant',
				action: 'Assign an assistant to a chat',
				routing: {
					request: {
						method: 'PATCH',
						url: '=/api/chats/{{$parameter.chatId}}/assign-assistant',
					},
				},
			},
			{
				name: 'Create',
				value: 'create',
				action: 'Create a chat',
				routing: { request: { method: 'POST', url: '/api/chats' } },
			},
			{
				name: 'Delete',
				value: 'delete',
				action: 'Delete a chat',
				routing: { request: { method: 'DELETE', url: '=/api/chats/{{$parameter.chatId}}' } },
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get a chat',
				routing: { request: { method: 'GET', url: '=/api/chats/{{$parameter.chatId}}' } },
			},
			{
				name: 'Get Many',
				value: 'getMany',
				action: 'Get many chats',
				routing: {
					request: { method: 'GET', url: '/api/chats' },
					send: { paginate: '={{ $parameter.returnAll }}' },
					operations: {
						pagination: {
							type: 'offset',
							properties: {
								limitParameter: 'take',
								offsetParameter: 'skip',
								pageSize: 100,
								rootProperty: 'data',
								type: 'query',
							},
						},
					},
					output: {
						postReceive: [
							{
								type: 'rootProperty',
								properties: { property: 'data' },
							},
						],
					},
				},
			},
			{
				name: 'Get Messengers',
				value: 'getMessengers',
				action: 'Get connected messengers',
				routing: { request: { method: 'GET', url: '/api/chats/messengers' } },
			},
			{
				name: 'Toggle AI Control',
				value: 'toggleAiControl',
				action: 'Toggle AI control for a chat',
				routing: {
					request: { method: 'PATCH', url: '=/api/chats/{{$parameter.chatId}}/ai-control' },
				},
			},
			{
				name: 'Unassign Assistant',
				value: 'unassignAssistant',
				action: 'Unassign the assistant from a chat',
				routing: {
					request: {
						method: 'PATCH',
						url: '=/api/chats/{{$parameter.chatId}}/unassign-assistant',
					},
				},
			},
			{
				name: 'Update',
				value: 'update',
				action: 'Update a chat',
				routing: { request: { method: 'PATCH', url: '=/api/chats/{{$parameter.chatId}}' } },
			},
		],
		default: 'getMany',
	},
];

export const chatFields: INodeProperties[] = [
	{
		displayName: 'Chat ID',
		name: 'chatId',
		type: 'string',
		required: true,
		default: '',
		description: 'Unique identifier of the chat',
		displayOptions: {
			show: {
				resource: ['chat'],
				operation: [
					'assignAssistant',
					'delete',
					'get',
					'toggleAiControl',
					'unassignAssistant',
					'update',
				],
			},
		},
	},
	{
		displayName: 'Include',
		name: 'include',
		type: 'string',
		required: true,
		default: 'messages',
		description: 'Comma-separated list of related data to include, e.g. "messages"',
		displayOptions: { show: { resource: ['chat'], operation: ['get'] } },
		routing: { send: { type: 'query', property: 'include' } },
	},
	{
		displayName: 'Assistant Name or ID',
		name: 'assistantId',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getAssistants' },
		required: true,
		default: '',
		description:
			'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
		displayOptions: { show: { resource: ['chat'], operation: ['assignAssistant'] } },
		routing: { send: { type: 'body', property: 'assistantId' } },
	},
	{
		displayName: 'AI Control Enabled',
		name: 'isUnderAiControl',
		type: 'boolean',
		required: true,
		default: true,
		description: 'Whether the AI assistant handles this chat',
		displayOptions: { show: { resource: ['chat'], operation: ['toggleAiControl'] } },
		routing: { send: { type: 'body', property: 'isUnderAiControl' } },
	},
	{
		displayName: 'AI Disable Reason',
		name: 'aiDisableReason',
		type: 'options',
		options: [
			{ name: 'Auto', value: 'auto' },
			{ name: 'Manual', value: 'manual' },
		],
		default: 'manual',
		description: 'Reason for disabling AI control (applied only when disabling)',
		displayOptions: {
			show: { resource: ['chat'], operation: ['toggleAiControl'], isUnderAiControl: [false] },
		},
		routing: { send: { type: 'body', property: 'aiDisableReason' } },
	},
	{
		displayName: 'Body (JSON)',
		name: 'bodyJson',
		type: 'json',
		default: '{}',
		description:
			'Request body as JSON. The public API spec does not document chat fields — see the <a href="https://docs.happ.tools/en/docs/api">Happ docs</a>.',
		displayOptions: { show: { resource: ['chat'], operation: ['create', 'update'] } },
		routing: {
			request: { body: '={{ typeof $value === "string" ? JSON.parse($value) : $value }}' },
		},
	},
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		description: 'Whether to return all results or only up to a given limit',
		displayOptions: { show: { resource: ['chat'], operation: ['getMany'] } },
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { minValue: 1 },
		default: 50,
		description: 'Max number of results to return',
		displayOptions: { show: { resource: ['chat'], operation: ['getMany'], returnAll: [false] } },
		routing: { send: { type: 'query', property: 'take' } },
	},
	{
		displayName: 'Skip',
		name: 'skip',
		type: 'number',
		typeOptions: { minValue: 0 },
		default: 0,
		description: 'Number of results to skip from the start',
		displayOptions: { show: { resource: ['chat'], operation: ['getMany'], returnAll: [false] } },
		routing: { send: { type: 'query', property: 'skip' } },
	},
];

import type {
	IDataObject,
	IExecuteSingleFunctions,
	IN8nHttpFullResponse,
	INodeExecutionData,
	INodeProperties,
	INodePropertyOptions,
} from 'n8n-workflow';

export const messageSourceOptions: INodePropertyOptions[] = [
	{ name: 'AI', value: 'AI' },
	{ name: 'API', value: 'API' },
	{ name: 'Custom Messenger', value: 'CUSTOM_MESSENGER' },
	{ name: 'Echat', value: 'ECHAT' },
	{ name: 'Instagram', value: 'INSTAGRAM' },
	{ name: 'Messenger', value: 'MESSENGER' },
	{ name: 'Mobile', value: 'MOBILE' },
	{ name: 'Platform', value: 'PLATFORM' },
	{ name: 'Playground', value: 'PLAYGROUND' },
	{ name: 'Telegram', value: 'TELEGRAM' },
	{ name: 'Telegram Bot', value: 'TELEGRAM_BOT' },
	{ name: 'WhatsApp', value: 'WHATSAPP' },
	{ name: 'Widget', value: 'WIDGET' },
];

export const messageRoleOptions: INodePropertyOptions[] = [
	{ name: 'Assistant', value: 'Assistant' },
	{ name: 'Developer', value: 'Developer' },
	{ name: 'System', value: 'System' },
	{ name: 'User', value: 'User' },
];

export const messageTypeOptions: INodePropertyOptions[] = [
	{ name: 'Audio', value: 'Audio' },
	{ name: 'Document', value: 'Document' },
	{ name: 'File', value: 'File' },
	{ name: 'Function Call', value: 'FunctionCall' },
	{ name: 'Function Call Output', value: 'FunctionCallOutput' },
	{ name: 'Photo', value: 'Photo' },
	{ name: 'Specific', value: 'Specific' },
	{ name: 'Text', value: 'Text' },
	{ name: 'Video', value: 'Video' },
];

const messageDetailFields: INodeProperties[] = [
	{
		displayName: 'Audio URL',
		name: 'audioUrl',
		type: 'string',
		default: '',
		description: 'Audio file URL',
		routing: { send: { type: 'body', property: 'audioUrl' } },
	},
	{
		displayName: 'External ID',
		name: 'externalId',
		type: 'string',
		default: '',
		description: 'External message ID (ID in the source messenger)',
		routing: { send: { type: 'body', property: 'externalId' } },
	},
	{
		displayName: 'File URL',
		name: 'fileUrl',
		type: 'string',
		default: '',
		routing: { send: { type: 'body', property: 'fileUrl' } },
	},
	{
		displayName: 'From ID',
		name: 'fromId',
		type: 'string',
		default: '',
		description: 'Sender ID',
		routing: { send: { type: 'body', property: 'fromId' } },
	},
	{
		displayName: 'Function Call ID',
		name: 'functionCallId',
		type: 'string',
		default: '',
		description: 'Function call ID (for FunctionCall / FunctionCallOutput messages)',
		routing: { send: { type: 'body', property: 'functionCallId' } },
	},
	{
		displayName: 'Function Call Input',
		name: 'functionCallInput',
		type: 'string',
		default: '',
		routing: { send: { type: 'body', property: 'functionCallInput' } },
	},
	{
		displayName: 'Function Call Name',
		name: 'functionCallName',
		type: 'string',
		default: '',
		routing: { send: { type: 'body', property: 'functionCallName' } },
	},
	{
		displayName: 'Function Call Output',
		name: 'functionCallOutput',
		type: 'string',
		default: '',
		routing: { send: { type: 'body', property: 'functionCallOutput' } },
	},
	{
		displayName: 'Session ID',
		name: 'sessionId',
		type: 'string',
		default: '',
		routing: { send: { type: 'body', property: 'sessionId' } },
	},
	{
		displayName: 'Specific Type',
		name: 'specificType',
		type: 'string',
		default: '',
		description:
			'Integration-specific message type, e.g. telegram_location, instagram_reel, whatsapp_poll',
		routing: { send: { type: 'body', property: 'specificType' } },
	},
	{
		displayName: 'To ID',
		name: 'toId',
		type: 'string',
		default: '',
		description: 'Recipient ID',
		routing: { send: { type: 'body', property: 'toId' } },
	},
	{
		displayName: 'Transcription',
		name: 'transcription',
		type: 'string',
		default: '',
		description: 'Audio transcription',
		routing: { send: { type: 'body', property: 'transcription' } },
	},
];

export const messageOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['message'] } },
		options: [
			{
				name: 'Delete',
				value: 'delete',
				action: 'Delete a message',
				routing: { request: { method: 'DELETE', url: '=/api/messages/{{$parameter.messageId}}' } },
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get a message',
				routing: { request: { method: 'GET', url: '=/api/messages/{{$parameter.messageId}}' } },
			},
			{
				name: 'Get Last',
				value: 'getLast',
				action: 'Get the last message of each chat',
				routing: {
					request: { method: 'GET', url: '/api/messages/last' },
					output: {
						postReceive: [
							// API returns Record<chatId, message>; emit one item per message
							async function (
								this: IExecuteSingleFunctions,
								items: INodeExecutionData[],
								response: IN8nHttpFullResponse,
							): Promise<INodeExecutionData[]> {
								const body = response.body;
								if (body === null || typeof body !== 'object' || Array.isArray(body)) {
									return items;
								}
								return Object.values(body as IDataObject)
									.filter(
										(message): message is IDataObject =>
											message !== null && typeof message === 'object',
									)
									.map((message) => ({ json: message }));
							},
						],
					},
				},
			},
			{
				name: 'Get Many',
				value: 'getMany',
				action: 'Get many messages',
				routing: {
					request: { method: 'GET', url: '/api/messages' },
					send: { paginate: '={{ $parameter.returnAll }}' },
					operations: {
						pagination: {
							type: 'offset',
							properties: {
								limitParameter: 'take',
								offsetParameter: 'skip',
								pageSize: 100,
								type: 'query',
							},
						},
					},
				},
			},
			{
				name: 'Send',
				value: 'send',
				action: 'Send a message',
				routing: { request: { method: 'POST', url: '/api/messages' } },
			},
			{
				name: 'Update',
				value: 'update',
				action: 'Update a message',
				routing: { request: { method: 'PATCH', url: '=/api/messages/{{$parameter.messageId}}' } },
			},
		],
		default: 'send',
	},
];

export const messageFields: INodeProperties[] = [
	{
		displayName: 'Message ID',
		name: 'messageId',
		type: 'string',
		required: true,
		default: '',
		description: 'Unique identifier of the message',
		displayOptions: { show: { resource: ['message'], operation: ['delete', 'get', 'update'] } },
	},
	{
		displayName: 'Chat ID',
		name: 'chatId',
		type: 'string',
		required: true,
		default: '',
		description: 'ID of the chat to send the message to',
		displayOptions: { show: { resource: ['message'], operation: ['send'] } },
		routing: { send: { type: 'body', property: 'chatId' } },
	},
	{
		displayName: 'Text',
		name: 'text',
		type: 'string',
		default: '',
		description: 'Message text content',
		displayOptions: { show: { resource: ['message'], operation: ['send'] } },
		routing: { send: { type: 'body', property: 'text' } },
	},
	{
		displayName: 'Source',
		name: 'source',
		type: 'options',
		options: messageSourceOptions,
		required: true,
		default: 'API',
		description: 'Where the message originates from',
		displayOptions: { show: { resource: ['message'], operation: ['send'] } },
		routing: { send: { type: 'body', property: 'source' } },
	},
	{
		displayName: 'Role',
		name: 'role',
		type: 'options',
		options: messageRoleOptions,
		required: true,
		default: 'Assistant',
		description: 'Role of the message author',
		displayOptions: { show: { resource: ['message'], operation: ['send'] } },
		routing: { send: { type: 'body', property: 'role' } },
	},
	{
		displayName: 'Type',
		name: 'type',
		type: 'options',
		options: messageTypeOptions,
		required: true,
		default: 'Text',
		description: 'Type of the message content',
		displayOptions: { show: { resource: ['message'], operation: ['send'] } },
		routing: { send: { type: 'body', property: 'type' } },
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['message'], operation: ['send'] } },
		options: messageDetailFields,
	},
	{
		displayName: 'Chat ID',
		name: 'chatId',
		type: 'string',
		required: true,
		default: '',
		description: 'ID of the chat to fetch messages from',
		displayOptions: { show: { resource: ['message'], operation: ['getMany'] } },
		routing: { send: { type: 'query', property: 'chatId' } },
	},
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		description: 'Whether to return all results or only up to a given limit',
		displayOptions: { show: { resource: ['message'], operation: ['getMany'] } },
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { minValue: 1 },
		default: 50,
		description: 'Max number of results to return',
		displayOptions: {
			show: { resource: ['message'], operation: ['getMany'], returnAll: [false] },
		},
		routing: { send: { type: 'query', property: 'take' } },
	},
	{
		displayName: 'Skip',
		name: 'skip',
		type: 'number',
		typeOptions: { minValue: 0 },
		default: 0,
		description: 'Number of results to skip from the start',
		displayOptions: {
			show: { resource: ['message'], operation: ['getMany'], returnAll: [false] },
		},
		routing: { send: { type: 'query', property: 'skip' } },
	},
	{
		displayName: 'Chat IDs',
		name: 'chatIds',
		type: 'string',
		required: true,
		default: '',
		description: 'Comma-separated list of chat UUIDs to fetch the last message for',
		displayOptions: { show: { resource: ['message'], operation: ['getLast'] } },
		routing: { send: { type: 'query', property: 'chatIds' } },
	},
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['message'], operation: ['update'] } },
		options: [
			{
				displayName: 'Chat ID',
				name: 'chatId',
				type: 'string',
				default: '',
				description: 'Chat ID the message belongs to',
				routing: { send: { type: 'body', property: 'chatId' } },
			},
			{
				displayName: 'Role',
				name: 'role',
				type: 'options',
				options: messageRoleOptions,
				default: 'Assistant',
				description: 'Role of the message author',
				routing: { send: { type: 'body', property: 'role' } },
			},
			{
				displayName: 'Source',
				name: 'source',
				type: 'options',
				options: messageSourceOptions,
				default: 'API',
				description: 'Where the message originates from',
				routing: { send: { type: 'body', property: 'source' } },
			},
			{
				displayName: 'Text',
				name: 'text',
				type: 'string',
				default: '',
				description: 'Message text content',
				routing: { send: { type: 'body', property: 'text' } },
			},
			{
				displayName: 'Type',
				name: 'type',
				type: 'options',
				options: messageTypeOptions,
				default: 'Text',
				description: 'Type of the message content',
				routing: { send: { type: 'body', property: 'type' } },
			},
			...messageDetailFields,
		],
	},
];

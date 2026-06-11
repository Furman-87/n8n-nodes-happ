# n8n-nodes-happ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Community-нода n8n для Happ Platform API: декларативная нода-действия (Chats, Messages, Assistants) + программный polling-триггер (New Chat / New Message), credentials с `X-Access-Token`.

**Architecture:** Пакет по шаблону n8n-nodes-starter в корне репозитория. Основная нода `Happ` — декларативный стиль (routing в описаниях свойств), `usableAsTool: true`. Триггер `HappTrigger` — программный `poll()` с watermark по `createdAt` в `workflowStaticData`; чистая логика выделена в `triggerHelpers.ts` и покрыта jest-тестами. Спека: `docs/superpowers/specs/2026-06-11-n8n-nodes-happ-design.md`, OpenAPI: `happ-openapi.json` (корень репо).

**Tech Stack:** TypeScript 5, n8n-workflow (peer), eslint-plugin-n8n-nodes-base, gulp (иконки), jest + ts-jest.

**Важные факты об API (проверены по OpenAPI):**
- `GET /api/chats` → `{ data: Chat[], totalCount, page }` (объекты в `data` без документированных полей).
- `GET /api/messages?chatId=...` → плоский массив сообщений. `chatId` обязателен.
- `GET /api/messages/last?chatIds=a,b` → `Record<chatId, IMessage>`.
- `CreateChatDto`, `UpdateChatDto`, `AssignAssistantDto` — пустые в спеке. Для chat create/update — JSON-body поле; для assign-assistant — поле `assistantId` (наиболее вероятное имя; проверить на живом API, fallback см. Task 4).
- Auth: заголовок `X-Access-Token`. Серверы: `https://api.happ.tools` (prod), `https://api.dev.happ.tools` (dev).

---

### Task 1: Каркас пакета

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.eslintrc.js`
- Create: `gulpfile.js`
- Create: `.gitignore`
- Create: `nodes/Happ/happ.svg`

- [ ] **Step 1: Создать `package.json`**

```json
{
	"name": "n8n-nodes-happ",
	"version": "0.1.0",
	"description": "n8n community node for the Happ Platform API (messenger channels and voice assistants)",
	"keywords": [
		"n8n-community-node-package",
		"happ",
		"telegram",
		"whatsapp",
		"instagram",
		"voice-assistant"
	],
	"license": "MIT",
	"homepage": "https://docs.happ.tools/en/docs/api",
	"author": {
		"name": "HappAI",
		"email": "jora1987kornev@gmail.com"
	},
	"repository": {
		"type": "git",
		"url": "https://github.com/happ-tools/n8n-nodes-happ.git"
	},
	"engines": {
		"node": ">=18.10"
	},
	"main": "index.js",
	"scripts": {
		"build": "tsc && gulp build:icons",
		"dev": "tsc --watch",
		"format": "prettier nodes credentials --write",
		"lint": "eslint nodes credentials package.json",
		"lintfix": "eslint nodes credentials package.json --fix",
		"test": "jest",
		"prepublishOnly": "npm run build && npm run lint"
	},
	"files": [
		"dist"
	],
	"n8n": {
		"n8nNodesApiVersion": 1,
		"credentials": [
			"dist/credentials/HappApi.credentials.js"
		],
		"nodes": [
			"dist/nodes/Happ/Happ.node.js",
			"dist/nodes/Happ/HappTrigger.node.js"
		]
	},
	"devDependencies": {
		"@types/jest": "^29.5.12",
		"@typescript-eslint/parser": "^7.15.0",
		"eslint": "^8.57.0",
		"eslint-plugin-n8n-nodes-base": "^1.16.3",
		"gulp": "^4.0.2",
		"jest": "^29.7.0",
		"prettier": "^3.3.2",
		"ts-jest": "^29.1.2",
		"typescript": "^5.5.3"
	},
	"peerDependencies": {
		"n8n-workflow": "*"
	}
}
```

Примечание: URL репозитория — заглушка в допустимом формате; перед публикацией в npm заменить на реальный.

- [ ] **Step 2: Создать `tsconfig.json`**

```json
{
	"compilerOptions": {
		"strict": true,
		"module": "commonjs",
		"moduleResolution": "node",
		"target": "es2019",
		"lib": ["es2019", "es2020", "es2022.error"],
		"removeComments": true,
		"useUnknownInCatchVariables": false,
		"forceConsistentCasingInFileNames": true,
		"noImplicitAny": true,
		"noImplicitReturns": true,
		"noUnusedLocals": true,
		"strictNullChecks": true,
		"preserveConstEnums": true,
		"esModuleInterop": true,
		"resolveJsonModule": true,
		"incremental": true,
		"declaration": true,
		"sourceMap": true,
		"skipLibCheck": true,
		"outDir": "./dist/"
	},
	"include": ["credentials/**/*", "nodes/**/*"],
	"exclude": ["**/*.test.ts", "node_modules/**/*", "dist/**/*"]
}
```

- [ ] **Step 3: Создать `.eslintrc.js`**

```js
module.exports = {
	root: true,
	env: {
		browser: true,
		es6: true,
		node: true,
	},
	parser: '@typescript-eslint/parser',
	parserOptions: {
		project: ['./tsconfig.json'],
		sourceType: 'module',
		extraFileExtensions: ['.json'],
	},
	ignorePatterns: ['.eslintrc.js', '**/*.js', '**/node_modules/**', '**/dist/**', '**/*.test.ts'],
	overrides: [
		{
			files: ['package.json'],
			plugins: ['eslint-plugin-n8n-nodes-base'],
			extends: ['plugin:n8n-nodes-base/community'],
		},
		{
			files: ['./credentials/**/*.ts'],
			plugins: ['eslint-plugin-n8n-nodes-base'],
			extends: ['plugin:n8n-nodes-base/credentials'],
		},
		{
			files: ['./nodes/**/*.ts'],
			plugins: ['eslint-plugin-n8n-nodes-base'],
			extends: ['plugin:n8n-nodes-base/nodes'],
		},
	],
};
```

- [ ] **Step 4: Создать `gulpfile.js`**

```js
const { src, dest } = require('gulp');

function copyIcons() {
	return src('nodes/**/*.{png,svg}').pipe(dest('dist/nodes'));
}

exports['build:icons'] = copyIcons;
```

- [ ] **Step 5: Создать `.gitignore`**

```
node_modules
dist
*.tsbuildinfo
.DS_Store
```

- [ ] **Step 6: Создать иконку `nodes/Happ/happ.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60">
	<rect width="60" height="60" rx="12" fill="#6C5CE7"/>
	<path d="M17 13h9v13h8V13h9v34h-9V34h-8v13h-9z" fill="#FFFFFF"/>
</svg>
```

- [ ] **Step 7: Установить зависимости**

Run: `npm install`
Expected: успешная установка, появился `node_modules` и `package-lock.json`. (`npm run build` пока упадёт — исходников нет; это нормально, сборка проверяется в Task 2.)

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json tsconfig.json .eslintrc.js gulpfile.js .gitignore nodes/Happ/happ.svg
git commit -m "chore: scaffold n8n-nodes-happ package"
```

---

### Task 2: Credentials HappApi

**Files:**
- Create: `credentials/HappApi.credentials.ts`

- [ ] **Step 1: Создать `credentials/HappApi.credentials.ts`**

```ts
import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class HappApi implements ICredentialType {
	name = 'happApi';

	displayName = 'Happ API';

	documentationUrl = 'https://docs.happ.tools/en/docs/api';

	properties: INodeProperties[] = [
		{
			displayName: 'Access Token',
			name: 'accessToken',
			type: 'string',
			typeOptions: { password: true },
			required: true,
			default: '',
			description:
				'Company-scoped access token (format: happ_...). Generate one at my.happ.tools or via POST /api/companies/{companyId}/access-tokens.',
		},
		{
			displayName: 'Environment',
			name: 'baseUrl',
			type: 'options',
			options: [
				{
					name: 'Development',
					value: 'https://api.dev.happ.tools',
				},
				{
					name: 'Production',
					value: 'https://api.happ.tools',
				},
			],
			default: 'https://api.happ.tools',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				'X-Access-Token': '={{$credentials.accessToken}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl}}',
			url: '/api/companies/my',
		},
	};
}
```

- [ ] **Step 2: Сборка**

Run: `npm run build`
Expected: успех, появился `dist/credentials/HappApi.credentials.js` и `dist/nodes/Happ/happ.svg`.

- [ ] **Step 3: Линт**

Run: `npm run lint`
Expected: PASS (или авто-исправимые замечания — тогда `npm run lintfix` и перепроверить).

- [ ] **Step 4: Commit**

```bash
git add credentials/HappApi.credentials.ts
git commit -m "feat: add Happ API credentials with access token auth"
```

---

### Task 3: Нода Happ — ресурс Message

**Files:**
- Create: `nodes/Happ/GenericFunctions.ts`
- Create: `nodes/Happ/descriptions/MessageDescription.ts`
- Create: `nodes/Happ/Happ.node.ts`

- [ ] **Step 1: Создать `nodes/Happ/GenericFunctions.ts`**

Общий HTTP-хелпер для loadOptions и триггера (декларативные операции его не используют — там routing).

```ts
import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	IPollFunctions,
} from 'n8n-workflow';

export async function happApiRequest(
	this: IExecuteFunctions | ILoadOptionsFunctions | IPollFunctions,
	method: IHttpRequestMethods,
	endpoint: string,
	qs: IDataObject = {},
): Promise<unknown> {
	const credentials = await this.getCredentials('happApi');
	const options: IHttpRequestOptions = {
		method,
		url: `${credentials.baseUrl as string}${endpoint}`,
		qs,
		json: true,
	};
	return await this.helpers.httpRequestWithAuthentication.call(this, 'happApi', options);
}

export function toListItems(response: unknown): IDataObject[] {
	if (Array.isArray(response)) return response as IDataObject[];
	const data = (response as IDataObject | null)?.data;
	if (Array.isArray(data)) return data as IDataObject[];
	return [];
}
```

- [ ] **Step 2: Создать `nodes/Happ/descriptions/MessageDescription.ts`**

```ts
import type { INodeProperties, INodePropertyOptions } from 'n8n-workflow';

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
		description: 'File URL',
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
		description: 'Function call input',
		routing: { send: { type: 'body', property: 'functionCallInput' } },
	},
	{
		displayName: 'Function Call Name',
		name: 'functionCallName',
		type: 'string',
		default: '',
		description: 'Function call name',
		routing: { send: { type: 'body', property: 'functionCallName' } },
	},
	{
		displayName: 'Function Call Output',
		name: 'functionCallOutput',
		type: 'string',
		default: '',
		description: 'Function call output',
		routing: { send: { type: 'body', property: 'functionCallOutput' } },
	},
	{
		displayName: 'Session ID',
		name: 'sessionId',
		type: 'string',
		default: '',
		description: 'Session ID',
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
				routing: { request: { method: 'GET', url: '/api/messages/last' } },
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
```

- [ ] **Step 3: Создать `nodes/Happ/Happ.node.ts`**

```ts
import type { INodeType, INodeTypeDescription } from 'n8n-workflow';
import { NodeConnectionType } from 'n8n-workflow';

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
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
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
				options: [{ name: 'Message', value: 'message' }],
				default: 'message',
			},
			...messageOperations,
			...messageFields,
		],
	};
}
```

Примечание: если установленная версия `n8n-workflow` не экспортирует `NodeConnectionType` как значение, заменить на строковый вариант `inputs: ['main'], outputs: ['main']` с `// eslint-disable-next-line` при необходимости. Если поле `usableAsTool` не существует в типах — обновить peer-зависимость при сборке: `npm install n8n-workflow@latest --save-peer --no-save` не нужен; достаточно `npm install --save-dev n8n-workflow` для типов.

- [ ] **Step 4: Если типы `n8n-workflow` недоступны — добавить dev-зависимость**

Run: `npm install --save-dev n8n-workflow`
Expected: типы доступны, peerDependencies не изменились.

- [ ] **Step 5: Сборка и линт**

Run: `npm run build`
Expected: PASS, есть `dist/nodes/Happ/Happ.node.js`.

Run: `npm run lint`
Expected: PASS (при замечаниях — `npm run lintfix`, остальное поправить вручную: лint-правила n8n требуют алфавитный порядок опций, описания без точки на конце, boolean-описания со слова "Whether").

- [ ] **Step 6: Commit**

```bash
git add nodes/Happ/GenericFunctions.ts nodes/Happ/descriptions/MessageDescription.ts nodes/Happ/Happ.node.ts package.json package-lock.json
git commit -m "feat: add Happ node with Message resource (declarative)"
```

---

### Task 4: Ресурс Chat

**Files:**
- Create: `nodes/Happ/descriptions/ChatDescription.ts`
- Modify: `nodes/Happ/Happ.node.ts`

- [ ] **Step 1: Создать `nodes/Happ/descriptions/ChatDescription.ts`**

```ts
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
```

- [ ] **Step 2: Подключить Chat в `nodes/Happ/Happ.node.ts`**

Заменить:

```ts
import { messageFields, messageOperations } from './descriptions/MessageDescription';
```

на:

```ts
import { chatFields, chatOperations } from './descriptions/ChatDescription';
import { messageFields, messageOperations } from './descriptions/MessageDescription';
```

Заменить:

```ts
				options: [{ name: 'Message', value: 'message' }],
				default: 'message',
			},
			...messageOperations,
			...messageFields,
```

на:

```ts
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
```

- [ ] **Step 3: Сборка и линт**

Run: `npm run build`
Expected: PASS. (Поле `assistantId` ссылается на loadOptions-метод `getAssistants`, который добавляется в Task 5 — это не ломает сборку, но до Task 5 выпадающий список в UI будет пуст; норм.)

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add nodes/Happ/descriptions/ChatDescription.ts nodes/Happ/Happ.node.ts
git commit -m "feat: add Chat resource (CRUD, AI control, assistant assignment)"
```

---

### Task 5: Ресурс Assistant + loadOptions

**Files:**
- Create: `nodes/Happ/descriptions/AssistantDescription.ts`
- Modify: `nodes/Happ/Happ.node.ts`

- [ ] **Step 1: Создать `nodes/Happ/descriptions/AssistantDescription.ts`**

```ts
import type { INodeProperties, INodePropertyOptions } from 'n8n-workflow';

const audioFormatOptions: INodePropertyOptions[] = [
	{ name: 'PCM 8000', value: 'pcm_8000' },
	{ name: 'PCM 16000', value: 'pcm_16000' },
	{ name: 'PCM 22050', value: 'pcm_22050' },
	{ name: 'PCM 24000', value: 'pcm_24000' },
	{ name: 'PCM 44100', value: 'pcm_44100' },
	{ name: 'PCM 48000', value: 'pcm_48000' },
	{ name: 'ULAW 8000', value: 'ulaw_8000' },
];

const assistantOptionalFields: INodeProperties[] = [
	{
		displayName: 'Assistant Output Audio Format',
		name: 'assistantOutputAudioFormat',
		type: 'options',
		options: audioFormatOptions,
		default: 'pcm_16000',
		description: 'Audio format of the assistant voice output',
		routing: { send: { type: 'body', property: 'assistantOutputAudioFormat' } },
	},
	{
		displayName: 'Disable First Message Interruption',
		name: 'disableFirstMessageInterruption',
		type: 'boolean',
		default: false,
		description: 'Whether to disable interruption of the first message',
		routing: { send: { type: 'body', property: 'disableFirstMessageInterruption' } },
	},
	{
		displayName: 'Eagerness',
		name: 'eagerness',
		type: 'options',
		options: [
			{ name: 'Eager', value: 'eager' },
			{ name: 'Normal', value: 'normal' },
			{ name: 'Patient', value: 'patient' },
		],
		default: 'normal',
		description: 'How eagerly the assistant takes its turn in a conversation',
		routing: { send: { type: 'body', property: 'eagerness' } },
	},
	{
		displayName: 'ElevenLabs Voice ID',
		name: 'elevenLabsVoiceId',
		type: 'string',
		default: '',
		description: 'ElevenLabs voice identifier for speech synthesis',
		routing: { send: { type: 'body', property: 'elevenLabsVoiceId' } },
	},
	{
		displayName: 'First Message',
		name: 'firstMessage',
		type: 'string',
		default: '',
		description: 'Message the assistant says first when a conversation starts',
		routing: { send: { type: 'body', property: 'firstMessage' } },
	},
	{
		displayName: 'Language',
		name: 'language',
		type: 'string',
		default: '',
		description: 'Assistant language code, e.g. en or ru',
		routing: { send: { type: 'body', property: 'language' } },
	},
	{
		displayName: 'Provider ID',
		name: 'providerId',
		type: 'string',
		default: '',
		description: 'Provider ID for voice assistant integration',
		routing: { send: { type: 'body', property: 'providerId' } },
	},
	{
		displayName: 'Silence End Call Timeout',
		name: 'silenceEndCallTimeout',
		type: 'number',
		default: -1,
		description:
			'Seconds of silence after which the call ends automatically. -1 disables, maximum 7200.',
		routing: { send: { type: 'body', property: 'silenceEndCallTimeout' } },
	},
	{
		displayName: 'Soft Timeout',
		name: 'softTimeout',
		type: 'number',
		default: 0,
		description: 'Soft timeout in seconds before the soft timeout message is played',
		routing: { send: { type: 'body', property: 'softTimeout' } },
	},
	{
		displayName: 'Soft Timeout Message',
		name: 'softTimeoutMessage',
		type: 'string',
		default: '',
		description: 'Message played when the soft timeout is reached',
		routing: { send: { type: 'body', property: 'softTimeoutMessage' } },
	},
	{
		displayName: 'Streaming Latency',
		name: 'streamingLatency',
		type: 'number',
		typeOptions: { minValue: 0, maxValue: 4 },
		default: 0,
		description: 'Streaming latency optimization (0-4)',
		routing: { send: { type: 'body', property: 'streamingLatency' } },
	},
	{
		displayName: 'Text LLM Model ID',
		name: 'textLlmModelId',
		type: 'string',
		default: '',
		description: 'LLM model ID used for text chats',
		routing: { send: { type: 'body', property: 'textLlmModelId' } },
	},
	{
		displayName: 'TTS Model',
		name: 'ttsModel',
		type: 'string',
		default: '',
		description: 'Text-to-speech model name',
		routing: { send: { type: 'body', property: 'ttsModel' } },
	},
	{
		displayName: 'Turn After Silence',
		name: 'turnAfterSilence',
		type: 'number',
		default: -1,
		description:
			'Max seconds since the user last spoke before the agent forces a turn. -1 waits indefinitely.',
		routing: { send: { type: 'body', property: 'turnAfterSilence' } },
	},
	{
		displayName: 'User Input Audio Format',
		name: 'userInputAudioFormat',
		type: 'options',
		options: audioFormatOptions,
		default: 'pcm_16000',
		description: 'Audio format of the user voice input',
		routing: { send: { type: 'body', property: 'userInputAudioFormat' } },
	},
	{
		displayName: 'VA Voice',
		name: 'vaVoice',
		type: 'string',
		default: '',
		description: 'Voice assistant voice name',
		routing: { send: { type: 'body', property: 'vaVoice' } },
	},
	{
		displayName: 'Voice Assistant ID',
		name: 'voiceAssistantId',
		type: 'string',
		default: '',
		description: 'External voice assistant identifier',
		routing: { send: { type: 'body', property: 'voiceAssistantId' } },
	},
	{
		displayName: 'Voice LLM Model ID',
		name: 'voiceLlmModelId',
		type: 'string',
		default: '',
		description: 'LLM model ID used for voice calls',
		routing: { send: { type: 'body', property: 'voiceLlmModelId' } },
	},
];

export const assistantOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['assistant'] } },
		options: [
			{
				name: 'Create',
				value: 'create',
				action: 'Create an assistant',
				routing: { request: { method: 'POST', url: '/api/assistants' } },
			},
			{
				name: 'Delete',
				value: 'delete',
				action: 'Delete an assistant',
				routing: {
					request: { method: 'DELETE', url: '=/api/assistants/{{$parameter.assistantId}}' },
				},
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get an assistant',
				routing: {
					request: { method: 'GET', url: '=/api/assistants/{{$parameter.assistantId}}' },
				},
			},
			{
				name: 'Get Many',
				value: 'getMany',
				action: 'Get many assistants',
				routing: {
					request: { method: 'GET', url: '/api/assistants' },
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
				name: 'Originate Call',
				value: 'originateCall',
				action: 'Start an outgoing call',
				routing: {
					request: {
						method: 'POST',
						url: '=/api/assistants/{{$parameter.assistantId}}/originate',
					},
				},
			},
			{
				name: 'Update',
				value: 'update',
				action: 'Update an assistant',
				routing: {
					request: { method: 'PATCH', url: '=/api/assistants/{{$parameter.assistantId}}' },
				},
			},
		],
		default: 'getMany',
	},
];

export const assistantFields: INodeProperties[] = [
	{
		displayName: 'Assistant Name or ID',
		name: 'assistantId',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getAssistants' },
		required: true,
		default: '',
		description:
			'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
		displayOptions: {
			show: { resource: ['assistant'], operation: ['delete', 'get', 'originateCall', 'update'] },
		},
	},
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		required: true,
		default: '',
		description: 'Name of the assistant',
		displayOptions: { show: { resource: ['assistant'], operation: ['create'] } },
		routing: { send: { type: 'body', property: 'name' } },
	},
	{
		displayName: 'Prompt Text',
		name: 'promptText',
		type: 'string',
		typeOptions: { rows: 4 },
		required: true,
		default: '',
		description: 'System prompt that defines the assistant behavior',
		displayOptions: { show: { resource: ['assistant'], operation: ['create'] } },
		routing: { send: { type: 'body', property: 'promptText' } },
	},
	{
		displayName: 'Company Name or ID',
		name: 'companyId',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getCompanies' },
		required: true,
		default: '',
		description:
			'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
		displayOptions: { show: { resource: ['assistant'], operation: ['create'] } },
		routing: { send: { type: 'body', property: 'companyId' } },
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['assistant'], operation: ['create'] } },
		options: assistantOptionalFields,
	},
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['assistant'], operation: ['update'] } },
		options: [
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
				description: 'Name of the assistant',
				routing: { send: { type: 'body', property: 'name' } },
			},
			{
				displayName: 'Prompt Text',
				name: 'promptText',
				type: 'string',
				typeOptions: { rows: 4 },
				default: '',
				description: 'System prompt that defines the assistant behavior',
				routing: { send: { type: 'body', property: 'promptText' } },
			},
			...assistantOptionalFields,
		],
	},
	{
		displayName: 'Phone Number',
		name: 'phoneNumber',
		type: 'string',
		required: true,
		default: '',
		description:
			'Phone number to call: +&lt;digits&gt;, digits with country code (380...), or local format starting with 0',
		displayOptions: { show: { resource: ['assistant'], operation: ['originateCall'] } },
		routing: { send: { type: 'body', property: 'phoneNumber' } },
	},
	{
		displayName: 'Caller Assistant ID',
		name: 'callerAssistantId',
		type: 'string',
		default: '',
		description:
			'ID of the assistant to make the call as (must belong to the same company). If empty, the route assistant is used.',
		displayOptions: { show: { resource: ['assistant'], operation: ['originateCall'] } },
		routing: { send: { type: 'body', property: 'callerAssistantId' } },
	},
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: { resource: ['assistant'], operation: ['getMany'] } },
		options: [
			{
				displayName: 'Company Name or ID',
				name: 'companyId',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getCompanies' },
				default: '',
				description:
					'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
				routing: { send: { type: 'query', property: 'companyId' } },
			},
			{
				displayName: 'Folder ID',
				name: 'folderId',
				type: 'string',
				default: '',
				description: 'Filter by folder ID',
				routing: { send: { type: 'query', property: 'folderId' } },
			},
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
				description: 'Filter by assistant name',
				routing: { send: { type: 'query', property: 'name' } },
			},
			{
				displayName: 'Search',
				name: 'search',
				type: 'string',
				default: '',
				description: 'Free-text search',
				routing: { send: { type: 'query', property: 'search' } },
			},
			{
				displayName: 'Type',
				name: 'type',
				type: 'options',
				options: [
					{ name: 'Hybrid', value: 'hybrid' },
					{ name: 'Text', value: 'text' },
					{ name: 'Voice', value: 'voice' },
				],
				default: 'text',
				description: 'Filter by assistant type',
				routing: { send: { type: 'query', property: 'type' } },
			},
		],
	},
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		description: 'Whether to return all results or only up to a given limit',
		displayOptions: { show: { resource: ['assistant'], operation: ['getMany'] } },
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { minValue: 1 },
		default: 50,
		description: 'Max number of results to return',
		displayOptions: {
			show: { resource: ['assistant'], operation: ['getMany'], returnAll: [false] },
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
			show: { resource: ['assistant'], operation: ['getMany'], returnAll: [false] },
		},
		routing: { send: { type: 'query', property: 'skip' } },
	},
];
```

- [ ] **Step 2: Подключить Assistant и loadOptions в `nodes/Happ/Happ.node.ts`**

Заменить блок импортов:

```ts
import type { INodeType, INodeTypeDescription } from 'n8n-workflow';
import { NodeConnectionType } from 'n8n-workflow';

import { chatFields, chatOperations } from './descriptions/ChatDescription';
import { messageFields, messageOperations } from './descriptions/MessageDescription';
```

на:

```ts
import type {
	IDataObject,
	ILoadOptionsFunctions,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionType } from 'n8n-workflow';

import { assistantFields, assistantOperations } from './descriptions/AssistantDescription';
import { chatFields, chatOperations } from './descriptions/ChatDescription';
import { messageFields, messageOperations } from './descriptions/MessageDescription';
import { happApiRequest, toListItems } from './GenericFunctions';
```

Заменить:

```ts
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
```

на:

```ts
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
```

В конец класса (после закрывающей скобки `description`) добавить:

```ts
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
				const response = await happApiRequest.call(this, 'GET', '/api/companies/my');
				return toListItems(response).map((company: IDataObject) => ({
					name: String(company.name ?? company.id),
					value: String(company.id),
				}));
			},
		},
	};
```

- [ ] **Step 3: Сборка и линт**

Run: `npm run build`
Expected: PASS.

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add nodes/Happ/descriptions/AssistantDescription.ts nodes/Happ/Happ.node.ts
git commit -m "feat: add Assistant resource with originate call and dynamic dropdowns"
```

---

### Task 6: triggerHelpers — TDD

**Files:**
- Create: `jest.config.js`
- Create: `nodes/Happ/triggerHelpers.ts`
- Test: `nodes/Happ/triggerHelpers.test.ts`

- [ ] **Step 1: Создать `jest.config.js`**

```js
module.exports = {
	preset: 'ts-jest',
	testEnvironment: 'node',
	testMatch: ['**/*.test.ts'],
};
```

Примечание: `tsconfig.json` исключает `**/*.test.ts` из сборки (настроено в Task 1); ts-jest использует свой транспайл, поэтому тесты работают.

- [ ] **Step 2: Написать падающие тесты `nodes/Happ/triggerHelpers.test.ts`**

```ts
import { filterByRoles, selectNewItems } from './triggerHelpers';

describe('selectNewItems', () => {
	it('returns all items when state is empty (first poll)', () => {
		const items = [
			{ id: 'a', createdAt: '2026-06-11T10:00:00.000Z' },
			{ id: 'b', createdAt: '2026-06-11T10:01:00.000Z' },
		];
		const { newItems, nextState } = selectNewItems(items, {});
		expect(newItems.map((i) => i.id)).toEqual(['a', 'b']);
		expect(nextState.lastTimestamp).toBe('2026-06-11T10:01:00.000Z');
		expect(nextState.seenIds).toEqual(['b']);
	});

	it('filters out items at or before the watermark', () => {
		const state = { lastTimestamp: '2026-06-11T10:01:00.000Z', seenIds: ['b'] };
		const items = [
			{ id: 'a', createdAt: '2026-06-11T10:00:00.000Z' },
			{ id: 'b', createdAt: '2026-06-11T10:01:00.000Z' },
			{ id: 'c', createdAt: '2026-06-11T10:02:00.000Z' },
		];
		const { newItems, nextState } = selectNewItems(items, state);
		expect(newItems.map((i) => i.id)).toEqual(['c']);
		expect(nextState.lastTimestamp).toBe('2026-06-11T10:02:00.000Z');
		expect(nextState.seenIds).toEqual(['c']);
	});

	it('emits unseen items sharing the watermark timestamp', () => {
		const state = { lastTimestamp: '2026-06-11T10:01:00.000Z', seenIds: ['b'] };
		const items = [
			{ id: 'b', createdAt: '2026-06-11T10:01:00.000Z' },
			{ id: 'd', createdAt: '2026-06-11T10:01:00.000Z' },
		];
		const { newItems, nextState } = selectNewItems(items, state);
		expect(newItems.map((i) => i.id)).toEqual(['d']);
		expect(nextState.lastTimestamp).toBe('2026-06-11T10:01:00.000Z');
		expect(nextState.seenIds!.sort()).toEqual(['b', 'd']);
	});

	it('returns items sorted by createdAt ascending', () => {
		const items = [
			{ id: 'late', createdAt: '2026-06-11T10:05:00.000Z' },
			{ id: 'early', createdAt: '2026-06-11T10:00:00.000Z' },
		];
		const { newItems } = selectNewItems(items, {});
		expect(newItems.map((i) => i.id)).toEqual(['early', 'late']);
	});

	it('skips items without createdAt and keeps state intact', () => {
		const state = { lastTimestamp: '2026-06-11T10:00:00.000Z', seenIds: ['a'] };
		const { newItems, nextState } = selectNewItems([{ id: 'x' }], state);
		expect(newItems).toEqual([]);
		expect(nextState.lastTimestamp).toBe('2026-06-11T10:00:00.000Z');
		expect(nextState.seenIds).toEqual(['a']);
	});

	it('handles empty input', () => {
		const { newItems, nextState } = selectNewItems([], {});
		expect(newItems).toEqual([]);
		expect(nextState.lastTimestamp).toBeUndefined();
	});
});

describe('filterByRoles', () => {
	const items = [
		{ id: '1', role: 'User' },
		{ id: '2', role: 'Assistant' },
		{ id: '3' },
	];

	it('returns all items when roles list is empty', () => {
		expect(filterByRoles(items, [])).toHaveLength(3);
	});

	it('keeps only items with matching roles', () => {
		expect(filterByRoles(items, ['User']).map((i) => i.id)).toEqual(['1']);
	});
});
```

- [ ] **Step 3: Запустить тесты — убедиться, что падают**

Run: `npx jest`
Expected: FAIL — `Cannot find module './triggerHelpers'`.

- [ ] **Step 4: Реализовать `nodes/Happ/triggerHelpers.ts`**

```ts
export interface PollState {
	lastTimestamp?: string;
	seenIds?: string[];
}

export interface PollItem {
	id?: unknown;
	createdAt?: unknown;
	role?: unknown;
	[key: string]: unknown;
}

function timestampOf(item: PollItem): string {
	return typeof item.createdAt === 'string' ? item.createdAt : '';
}

export function selectNewItems(
	items: PollItem[],
	state: PollState,
): { newItems: PollItem[]; nextState: PollState } {
	const lastTimestamp = state.lastTimestamp ?? '';
	const seenIds = new Set(state.seenIds ?? []);

	const dated = items.filter((item) => timestampOf(item) !== '');
	const sorted = [...dated].sort((a, b) => timestampOf(a).localeCompare(timestampOf(b)));

	const newItems = sorted.filter((item) => {
		const ts = timestampOf(item);
		if (ts < lastTimestamp) return false;
		if (ts === lastTimestamp) {
			if (item.id === undefined) return false;
			return !seenIds.has(String(item.id));
		}
		return true;
	});

	let nextTimestamp = state.lastTimestamp;
	for (const item of sorted) {
		const ts = timestampOf(item);
		if (nextTimestamp === undefined || ts > nextTimestamp) nextTimestamp = ts;
	}

	const nextSeenIds = new Set<string>(
		nextTimestamp === state.lastTimestamp ? (state.seenIds ?? []) : [],
	);
	for (const item of sorted) {
		if (timestampOf(item) === nextTimestamp && item.id !== undefined) {
			nextSeenIds.add(String(item.id));
		}
	}

	return {
		newItems,
		nextState: { lastTimestamp: nextTimestamp, seenIds: [...nextSeenIds] },
	};
}

export function filterByRoles(items: PollItem[], roles: string[]): PollItem[] {
	if (roles.length === 0) return items;
	return items.filter((item) => roles.includes(String(item.role ?? '')));
}
```

- [ ] **Step 5: Запустить тесты — убедиться, что проходят**

Run: `npx jest`
Expected: PASS, 8 тестов.

- [ ] **Step 6: Commit**

```bash
git add jest.config.js nodes/Happ/triggerHelpers.ts nodes/Happ/triggerHelpers.test.ts
git commit -m "feat: add watermark-based polling helpers with tests"
```

---

### Task 7: Нода Happ Trigger

**Files:**
- Create: `nodes/Happ/HappTrigger.node.ts`

- [ ] **Step 1: Создать `nodes/Happ/HappTrigger.node.ts`**

```ts
import type {
	IDataObject,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IPollFunctions,
} from 'n8n-workflow';
import { NodeConnectionType } from 'n8n-workflow';

import { messageRoleOptions } from './descriptions/MessageDescription';
import { happApiRequest, toListItems } from './GenericFunctions';
import { filterByRoles, selectNewItems } from './triggerHelpers';
import type { PollItem, PollState } from './triggerHelpers';

export class HappTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Happ Trigger',
		name: 'happTrigger',
		icon: 'file:happ.svg',
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["event"]}}',
		description: 'Starts the workflow when new Happ chats or messages appear',
		defaults: {
			name: 'Happ Trigger',
		},
		polling: true,
		inputs: [],
		outputs: [NodeConnectionType.Main],
		credentials: [
			{
				name: 'happApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Event',
				name: 'event',
				type: 'options',
				options: [
					{ name: 'New Chat', value: 'newChat' },
					{ name: 'New Message', value: 'newMessage' },
				],
				default: 'newMessage',
			},
			{
				displayName: 'Chat ID',
				name: 'chatId',
				type: 'string',
				default: '',
				description:
					'Watch a single chat. Leave empty to watch the latest message of every chat (one extra API call per poll).',
				displayOptions: { show: { event: ['newMessage'] } },
			},
			{
				displayName: 'Roles',
				name: 'roles',
				type: 'multiOptions',
				options: messageRoleOptions,
				default: [],
				description:
					'Only emit messages whose role matches. Pick "User" to react to customer messages only. Empty means all roles.',
				displayOptions: { show: { event: ['newMessage'] } },
			},
		],
	};

	async poll(this: IPollFunctions): Promise<INodeExecutionData[][] | null> {
		const event = this.getNodeParameter('event') as string;
		const staticData = this.getWorkflowStaticData('node') as PollState;

		let items: PollItem[] = [];

		if (event === 'newChat') {
			const response = await happApiRequest.call(this, 'GET', '/api/chats', { take: 100 });
			items = toListItems(response) as PollItem[];
		} else {
			const chatId = this.getNodeParameter('chatId') as string;
			if (chatId) {
				const response = await happApiRequest.call(this, 'GET', '/api/messages', {
					chatId,
					take: 100,
				});
				items = toListItems(response) as PollItem[];
			} else {
				const chatsResponse = await happApiRequest.call(this, 'GET', '/api/chats', {
					take: 100,
				});
				const chatIds = toListItems(chatsResponse)
					.map((chat) => chat.id)
					.filter((id) => id !== undefined && id !== null)
					.join(',');
				if (chatIds !== '') {
					const lastMessages = (await happApiRequest.call(this, 'GET', '/api/messages/last', {
						chatIds,
					})) as Record<string, PollItem> | null;
					items = Object.values(lastMessages ?? {}).filter(
						(message): message is PollItem => message !== null && typeof message === 'object',
					);
				}
			}
			const roles = this.getNodeParameter('roles', []) as string[];
			items = filterByRoles(items, roles);
		}

		if (this.getMode() === 'manual') {
			const { newItems } = selectNewItems(items, {});
			const latest = newItems[newItems.length - 1];
			if (latest === undefined) return null;
			return [this.helpers.returnJsonArray([latest as IDataObject])];
		}

		const isFirstPoll = staticData.lastTimestamp === undefined;
		const { newItems, nextState } = selectNewItems(items, staticData);

		staticData.lastTimestamp = nextState.lastTimestamp;
		staticData.seenIds = nextState.seenIds;

		if (isFirstPoll && staticData.lastTimestamp === undefined) {
			// Не было ни одного элемента с createdAt — фиксируем "сейчас", чтобы
			// следующий опрос не выдал всю историю.
			staticData.lastTimestamp = new Date().toISOString();
			staticData.seenIds = [];
		}

		if (isFirstPoll || newItems.length === 0) return null;

		return [this.helpers.returnJsonArray(newItems as IDataObject[])];
	}
}
```

Поведение: первый запуск только инициализирует watermark (ничего не эмитит — нет потопа истории); ручной запуск ("Fetch Test Event") возвращает самый свежий элемент.

- [ ] **Step 2: Сборка, линт, тесты**

Run: `npm run build`
Expected: PASS, есть `dist/nodes/Happ/HappTrigger.node.js`.

Run: `npm run lint`
Expected: PASS.

Run: `npx jest`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add nodes/Happ/HappTrigger.node.ts
git commit -m "feat: add Happ Trigger polling node (new chat / new message)"
```

---

### Task 8: README, финальная проверка, локальная установка

**Files:**
- Create: `README.md`

- [ ] **Step 1: Создать `README.md`**

````markdown
# n8n-nodes-happ

n8n community node for the [Happ Platform API](https://api.happ.tools/reference) —
connect messenger channels (Telegram, Instagram, WhatsApp) and AI voice assistants
to your n8n workflows.

## Installation

In n8n: **Settings → Community Nodes → Install** → enter `n8n-nodes-happ`.

Manual install into a self-hosted n8n:

```bash
cd ~/.n8n/nodes
npm install n8n-nodes-happ
```

## Credentials

1. Sign in at [my.happ.tools](https://my.happ.tools) and generate an **Access Token**
   (or `POST /api/companies/{companyId}/access-tokens` with a JWT).
2. In n8n create **Happ API** credentials: paste the token (`happ_...`) and pick the
   environment (Production / Development).

## Nodes

### Happ

| Resource | Operations |
|---|---|
| Chat | Get Many, Get, Create, Update, Delete, Toggle AI Control, Assign/Unassign Assistant, Get Messengers |
| Message | Send, Get Many, Get, Get Last, Update, Delete |
| Assistant | Get Many, Get, Create, Update, Delete, Originate Call |

The node is marked `usableAsTool`, so an n8n AI Agent can call it as a tool.

### Happ Trigger

Polling trigger. Events:

- **New Message** — all chats (via last-message endpoint) or a single chat; optional
  role filter (e.g. only `User` messages).
- **New Chat** — fires when a new conversation appears.

## Resources

- [Happ API reference](https://api.happ.tools/reference)
- [Happ docs](https://docs.happ.tools/en/docs/api)

## License

MIT
````

- [ ] **Step 2: Полная проверка**

Run: `npm run lint`
Expected: PASS, 0 ошибок.

Run: `npm run build`
Expected: PASS.

Run: `npx jest`
Expected: PASS.

Run: `npm pack --dry-run`
Expected: в составе пакета только `dist/**`, `README.md`, `package.json` (поле `files` ограничивает состав).

- [ ] **Step 3: Проверить состав dist**

Run (PowerShell): `Get-ChildItem dist -Recurse -File | Select-Object FullName`
Expected: `dist/credentials/HappApi.credentials.js`, `dist/nodes/Happ/Happ.node.js`, `dist/nodes/Happ/HappTrigger.node.js`, `dist/nodes/Happ/happ.svg`, сопутствующие `.d.ts/.js.map` и `descriptions/*`, `GenericFunctions.js`, `triggerHelpers.js`. Тестовых файлов быть не должно.

- [ ] **Step 4: Живая проверка с пользователем (требуется доступ к n8n и токен)**

Спросить у пользователя, где развёрнут его n8n, и установить пакет:

```bash
npm pack            # создаст n8n-nodes-happ-0.1.0.tgz
# в каталоге пользовательского n8n:
cd ~/.n8n/nodes && npm install /путь/к/n8n-nodes-happ-0.1.0.tgz
# перезапустить n8n
```

Проверить с реальным Access Token:
1. Credential test (должен пройти — `GET /api/companies/my`).
2. Chat → Get Many (Return All = false и true). **Если при Return All = true элементы задвоены или обёрнуты** — убрать `output.postReceive` из операции Get Many чата (пагинация с `rootProperty: 'data'` уже разворачивает) и пересобрать.
3. Message → Send в существующий чат.
4. Chat → Assign Assistant. **Если API вернул 400** — открыть https://docs.happ.tools/llms.txt, найти описание assign-assistant, исправить имя поля в body (`assistantId` → фактическое) в `ChatDescription.ts`.
5. Happ Trigger → Fetch Test Event (режим manual должен вернуть последнее сообщение).

- [ ] **Step 5: Финальный commit**

```bash
git add README.md
git commit -m "docs: add README with installation and usage"
```

---

## Отступления от спеки / решения

- Пагинация Return All реализована через декларативную offset-пагинацию n8n (`take`/`skip`); живое поведение проверяется в Task 8 Step 4 с конкретным fallback.
- `specificType` сделан строковым полем (20 enum-значений загромождают UI; значения перечислены в описании).
- Сортировка опций внутри объединённых массивов (`updateFields`) может не быть строго алфавитной после спреда — линт проверяет только литеральные массивы, это допустимо.
- Кастомная подсказка при 401 («проверьте Access Token») не реализуется: декларативные ноды используют стандартный маппинг ошибок n8n (`NodeApiError` с текстом ответа API), а указание на токен есть в описании credentials и README. Этого достаточно.

# Make Custom App «Happ» Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make.com Custom App «Happ» в папке `make/` (формат Apps SDK, локальная git-папка), полный паритет логики с n8n-нодой: Connection + Base с `X-Access-Token`, ~21 модуль Action/Search по Chat/Message/Assistant, два polling-триггера, три RPC-выпадашки, IML-функция `recordToArray`.

**Architecture:** Приложение собирается вручную в документированном формате расширения «Make Apps Editor» (Local Development). Источник истины структуры — исходники `integromat/vscode-apps-sdk` и реальные приложения. Все компоненты объявляются в `make/makecomapp.json`; каждый компонент — папка с `.iml.json` файлами. Деплой выполняет пользователь из VS Code (Deploy to Make) в EU-зону. Автоматический контроль — zero-dependency Node-скрипт `make/scripts/validate.mjs` (валидность JSON + соответствие манифеста и файлов на диске) и `node --test` для IML-функции.

**Tech Stack:** Make Apps SDK (JSON + IML), Node 22 (встроенные `node --test` и ESM для харнесса валидации), без внешних зависимостей.

## Global Constraints

- **Папка:** всё кладётся в `make/` текущего репозитория; n8n-пакет в корне не трогаем.
- **Формат файлов компонентов:** `.iml.json` (валидный JSON, **без комментариев** — харнесс парсит их `JSON.parse`). Плоский JSON для `common.json`, `groups.json`.
- **Имена файлов:** паттерн `<kebab-id>.<segment>.iml.json`. Ключи `codeFiles` в манифесте ≠ сегментам имён файлов: `staticParams`→`static-params`, `mappableParams`→`mappable-params`, остальные совпадают (`communication`, `interface`, `samples`, `scope`, `epoch`, `params`, `common`).
- **`makecomapp.json`:** обязательны 4 ключа в `generalCodeFiles` (`base`, `common`, `readme`, `groups`) и 5 ключей в `components` (`connection`, `module`, `rpc`, `webhook`, `function`), даже если значение `null`/`{}`.
- **Auth:** заголовок `X-Access-Token`. В Base и модулях — `{{connection.accessToken}}`; в communication самого соединения — `{{parameters.accessToken}}`. Базовый URL — `{{connection.environment}}` (значение select = URL).
- **API:** серверы `https://api.happ.tools` (prod), `https://api.dev.happ.tools` (dev). Проверка соединения и список компаний — company-scoped (`/api/chats/messengers`, `/api/companies`); `/api/companies/my` НЕ использовать (даёт 401 company-токену).
- **Enum-значения** (из `happ-openapi.json`): source — TELEGRAM, TELEGRAM_BOT, INSTAGRAM, WHATSAPP, MESSENGER, ECHAT, CUSTOM_MESSENGER, WIDGET, PLATFORM, MOBILE, API, AI, PLAYGROUND; role — System, Assistant, User, Developer; type — Text, Audio, File, Document, Photo, Video, Specific, FunctionCallOutput, FunctionCall.
- **Деплой** не автоматизируем: пользователь правит `origins` (appId, зона eu1/eu2) и `.secrets/apikey`, затем Deploy to Make. Все задачи проверяются `npm run --prefix make validate` (или `cd make && node scripts/validate.mjs`).

---

### Task 1: Каркас + харнесс валидации + Base + Connection

**Files:**
- Create: `make/package.json`
- Create: `make/.gitignore`
- Create: `make/scripts/validate.mjs`
- Create: `make/makecomapp.json`
- Create: `make/general/base.iml.json`
- Create: `make/modules/groups.json`
- Create: `make/connections/happ/happ.params.iml.json`
- Create: `make/connections/happ/happ.communication.iml.json`
- Create: `make/README.md`

**Interfaces:**
- Produces: connection local id `happ`; Base referencing `{{connection.environment}}` и `{{connection.accessToken}}`; validation command `node scripts/validate.mjs` (запускать из `make/`); manifest со всеми 5 пустыми `components` группами кроме `connection.happ`.

- [ ] **Step 1: Создать `make/package.json`**

```json
{
	"name": "make-app-happ-dev",
	"private": true,
	"version": "0.1.0",
	"description": "Local dev and validation harness for the Happ Make custom app",
	"type": "module",
	"scripts": {
		"validate": "node scripts/validate.mjs",
		"test": "node --test tests/"
	}
}
```

- [ ] **Step 2: Создать `make/.gitignore`**

```
.secrets/
node_modules/
```

- [ ] **Step 3: Создать `make/scripts/validate.mjs`**

```js
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const referenced = new Set();

function parseJson(relPath) {
	const abs = join(root, relPath);
	if (!existsSync(abs)) {
		errors.push(`Missing file referenced in manifest: ${relPath}`);
		return null;
	}
	try {
		return JSON.parse(readFileSync(abs, 'utf8'));
	} catch (e) {
		errors.push(`Invalid JSON in ${relPath}: ${e.message}`);
		return null;
	}
}

const manifest = parseJson('makecomapp.json');
if (manifest) {
	for (const key of ['fileVersion', 'generalCodeFiles', 'components', 'origins']) {
		if (!(key in manifest)) errors.push(`makecomapp.json missing top-level key: ${key}`);
	}
	const gcf = manifest.generalCodeFiles ?? {};
	for (const key of ['base', 'common', 'readme', 'groups']) {
		if (!(key in gcf)) errors.push(`generalCodeFiles missing key: ${key}`);
		if (gcf[key]) {
			referenced.add(gcf[key]);
			if (gcf[key].endsWith('.json')) parseJson(gcf[key]);
		}
	}
	const comp = manifest.components ?? {};
	for (const key of ['connection', 'module', 'rpc', 'webhook', 'function']) {
		if (!(key in comp)) errors.push(`components missing key: ${key}`);
	}
	for (const [type, group] of Object.entries(comp)) {
		for (const [id, entry] of Object.entries(group ?? {})) {
			const cf = entry.codeFiles ?? {};
			for (const path of Object.values(cf)) {
				if (path === null) continue;
				referenced.add(path);
				if (path.endsWith('.json')) parseJson(path);
			}
			if (type === 'module' && entry.moduleType === 'trigger' && !cf.epoch) {
				errors.push(`Trigger module ${id} missing epoch code file`);
			}
		}
	}
	// groups.json must reference only existing module ids
	if (gcf.groups) {
		const groups = parseJson(gcf.groups);
		const moduleIds = new Set(Object.keys(comp.module ?? {}));
		for (const g of groups ?? []) {
			for (const m of g.modules ?? []) {
				if (!moduleIds.has(m)) errors.push(`groups.json references unknown module: ${m}`);
			}
		}
	}
}

// Symmetry: every component file on disk must be referenced by the manifest
function walk(dir) {
	const abs = join(root, dir);
	if (!existsSync(abs)) return;
	for (const name of readdirSync(abs)) {
		const rel = join(dir, name).replace(/\\/g, '/');
		if (statSync(join(root, rel)).isDirectory()) walk(rel);
		else if ((rel.endsWith('.iml.json') || rel.endsWith('.json')) && !referenced.has(rel)) {
			errors.push(`Orphan file not referenced in manifest: ${rel}`);
		}
	}
}
for (const dir of ['general', 'connections', 'modules', 'rpcs', 'webhooks', 'functions']) walk(dir);

if (errors.length) {
	console.error(`VALIDATION FAILED (${errors.length}):`);
	for (const e of errors) console.error('  - ' + e);
	process.exit(1);
}
console.log('VALIDATION OK');
```

- [ ] **Step 4: Создать `make/general/base.iml.json`**

```json
{
	"baseUrl": "{{connection.environment}}",
	"headers": {
		"X-Access-Token": "{{connection.accessToken}}"
	},
	"response": {
		"error": {
			"message": "[{{statusCode}}] {{if(body.message, body.message, body)}}"
		}
	},
	"log": {
		"sanitize": ["request.headers.X-Access-Token"]
	}
}
```

- [ ] **Step 5: Создать `make/modules/groups.json`**

```json
[
	{ "label": "Chats", "modules": [] },
	{ "label": "Messages", "modules": [] },
	{ "label": "Assistants", "modules": [] }
]
```

- [ ] **Step 6: Создать `make/connections/happ/happ.params.iml.json`**

```json
[
	{
		"name": "accessToken",
		"type": "password",
		"label": "Access Token",
		"required": true,
		"help": "Company-scoped access token (format: happ_...). Generate it at my.happ.tools."
	},
	{
		"name": "environment",
		"type": "select",
		"label": "Environment",
		"required": true,
		"default": "https://api.happ.tools",
		"options": [
			{ "label": "Production", "value": "https://api.happ.tools" },
			{ "label": "Development", "value": "https://api.dev.happ.tools" }
		]
	}
]
```

- [ ] **Step 7: Создать `make/connections/happ/happ.communication.iml.json`**

Проверка соединения выполняется без Base, поэтому URL абсолютный и заголовок явный.

```json
{
	"url": "{{parameters.environment}}/api/chats/messengers",
	"method": "GET",
	"headers": {
		"X-Access-Token": "{{parameters.accessToken}}"
	},
	"response": {
		"valid": "{{statusCode === 200}}",
		"error": "[{{statusCode}}] Authorization failed — check the access token and environment."
	}
}
```

- [ ] **Step 8: Создать `make/makecomapp.json`**

`origins.appId`, зона и `apikeyFile` — пользователь правит перед деплоем (см. README). `idMapping` стартует пустым.

```json
{
	"fileVersion": 1,
	"generalCodeFiles": {
		"base": "general/base.iml.json",
		"common": null,
		"readme": "README.md",
		"groups": "modules/groups.json"
	},
	"components": {
		"connection": {
			"happ": {
				"label": "Happ",
				"connectionType": "basic",
				"codeFiles": {
					"communication": "connections/happ/happ.communication.iml.json",
					"params": "connections/happ/happ.params.iml.json",
					"common": null
				}
			}
		},
		"module": {},
		"rpc": {},
		"webhook": {},
		"function": {}
	},
	"origins": [
		{
			"label": "EU",
			"baseUrl": "https://eu1.make.com/api",
			"appId": "happ-REPLACE-ME",
			"appVersion": 1,
			"idMapping": {
				"connection": [],
				"module": [],
				"function": [],
				"rpc": [],
				"webhook": []
			},
			"apikeyFile": "../.secrets/apikey"
		}
	]
}
```

- [ ] **Step 9: Создать `make/README.md`**

````markdown
# Happ — Make Custom App

Make.com custom app for the [Happ platform](https://my.happ.tools/) — messenger
channels (Telegram, Instagram, WhatsApp) and AI voice assistants. Mirrors the
[n8n-nodes-happ](https://www.npmjs.com/package/n8n-nodes-happ) node.

## Local development

This folder is a Make Apps SDK local app. Edit it in VS Code with the
**Make Apps Editor** extension.

Validate the structure (no dependencies, Node 18+):

```bash
cd make
node scripts/validate.mjs
```

## Deploy to your Make account

1. Install the **Make Apps Editor** VS Code extension.
2. Create a Make API key (profile → API) and save it to `make/.secrets/apikey`
   (the `.secrets/` folder is git-ignored).
3. In `makecomapp.json` → `origins[0]`: set `baseUrl` to your zone
   (`https://eu1.make.com/api` or `https://eu2.make.com/api`) and `appId` to your
   app's id. If you have no app yet, create one in Make (Custom apps → create) and
   copy its id, or use the extension's create-from-local flow.
4. Right-click `makecomapp.json` → **Deploy to Make**.

## Connection

Create a **Happ** connection: paste your Access Token (`happ_...`, company-scoped,
from my.happ.tools) and pick the environment (Production / Development).

## Components

- **Chat**: Get Many, Get, Create, Update, Delete, Toggle AI Control,
  Assign/Unassign Assistant, Get Messengers
- **Message**: Send, Get Many, Get, Get Last, Update, Delete
- **Assistant**: Get Many, Get, Create, Update, Delete, Originate Call
- **Triggers**: Watch New Chats, Watch New Messages (single chat)

## Resources

- [Happ platform](https://my.happ.tools/)
- [Happ API reference](https://api.happ.tools/reference)
````

- [ ] **Step 10: Запустить валидацию**

Run: `cd make && node scripts/validate.mjs`
Expected: `VALIDATION OK`

- [ ] **Step 11: Commit**

```bash
git add make/.gitignore make/package.json make/scripts make/makecomapp.json make/general make/modules/groups.json make/connections make/README.md
git commit -m "feat(make): scaffold app with base, connection and validation harness"
```

---

### Task 2: IML-функция recordToArray

**Files:**
- Create: `make/functions/record-to-array/record-to-array.code.js`
- Create: `make/functions/record-to-array/record-to-array.test.js`
- Create: `make/tests/recordToArray.test.mjs`
- Modify: `make/makecomapp.json` (добавить компонент function)

**Interfaces:**
- Consumes: manifest из Task 1.
- Produces: IML-функция `recordToArray(record)` → массив значений объекта (или `[]`/сам массив), вызывается из IML как `{{recordToArray(body)}}`. Используется в Task 4 (Message Get Last).

- [ ] **Step 1: Написать падающий node-тест `make/tests/recordToArray.test.mjs`**

Тест загружает реальный файл функции и оборачивает его (функция в Make — top-level, без export).

```js
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const here = dirname(fileURLToPath(import.meta.url));
const code = readFileSync(
	join(here, '../functions/record-to-array/record-to-array.code.js'),
	'utf8',
);
const recordToArray = new Function(code + '\nreturn recordToArray;')();

test('converts a Record<key, value> object to an array of values', () => {
	const input = { a: { id: '1' }, b: { id: '2' } };
	assert.deepEqual(recordToArray(input), [{ id: '1' }, { id: '2' }]);
});

test('returns an array unchanged', () => {
	assert.deepEqual(recordToArray([{ id: '1' }]), [{ id: '1' }]);
});

test('returns [] for null or non-object', () => {
	assert.deepEqual(recordToArray(null), []);
	assert.deepEqual(recordToArray('x'), []);
	assert.deepEqual(recordToArray(undefined), []);
});
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `cd make && node --test tests/`
Expected: FAIL — нет файла `record-to-array.code.js` (ENOENT).

- [ ] **Step 3: Создать `make/functions/record-to-array/record-to-array.code.js`**

```js
function recordToArray(record) {
	if (record === null || typeof record !== 'object') {
		return [];
	}
	if (Array.isArray(record)) {
		return record;
	}
	return Object.values(record);
}
```

- [ ] **Step 4: Создать `make/functions/record-to-array/record-to-array.test.js`**

Make-овский файл теста (выполняется в IML-песочнице Make). Держим минимальным и валидным JS.

```js
// Verified locally by ../../tests/recordToArray.test.mjs (node --test).
// Make runs IML-function tests in its own sandbox; no assertions needed here.
```

- [ ] **Step 5: Запустить тест — убедиться, что проходит**

Run: `cd make && node --test tests/`
Expected: PASS, 3 теста.

- [ ] **Step 6: Зарегистрировать функцию в `make/makecomapp.json`**

В объекте `components.function` (сейчас `{}`) записать:

```json
"function": {
	"recordToArray": {
		"codeFiles": {
			"code": "functions/record-to-array/record-to-array.code.js",
			"test": "functions/record-to-array/record-to-array.test.js"
		}
	}
}
```

- [ ] **Step 7: Валидация + тесты**

Run: `cd make && node scripts/validate.mjs`
Expected: `VALIDATION OK`. (Скрипт проверяет только `.json`/`.iml.json`, `.js` не парсит — функция уже учтена как referenced.)

Run: `cd make && node --test tests/`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add make/functions make/tests make/makecomapp.json
git commit -m "feat(make): add recordToArray IML function with tests"
```

---

### Task 3: RPC-выпадашки (getAssistants, getCompanies, getChats)

**Files:**
- Create: `make/rpcs/get-assistants/get-assistants.communication.iml.json`
- Create: `make/rpcs/get-assistants/get-assistants.params.iml.json`
- Create: `make/rpcs/get-companies/get-companies.communication.iml.json`
- Create: `make/rpcs/get-companies/get-companies.params.iml.json`
- Create: `make/rpcs/get-chats/get-chats.communication.iml.json`
- Create: `make/rpcs/get-chats/get-chats.params.iml.json`
- Modify: `make/makecomapp.json`

**Interfaces:**
- Consumes: connection `happ`, Base.
- Produces: RPC-идентификаторы `getAssistants`, `getCompanies`, `getChats`, ссылаемые из параметров модулей как `"options": "rpc://getAssistants"` и т.д.

- [ ] **Step 1: Все три `*.params.iml.json` — пустой список параметров**

Содержимое каждого из `get-assistants.params.iml.json`, `get-companies.params.iml.json`, `get-chats.params.iml.json`:

```json
[]
```

- [ ] **Step 2: Создать `make/rpcs/get-assistants/get-assistants.communication.iml.json`**

```json
{
	"url": "/api/assistants",
	"method": "GET",
	"qs": { "take": 100 },
	"response": {
		"iterate": "{{body}}",
		"output": {
			"label": "{{item.name}}",
			"value": "{{item.id}}"
		}
	}
}
```

- [ ] **Step 3: Создать `make/rpcs/get-companies/get-companies.communication.iml.json`**

```json
{
	"url": "/api/companies",
	"method": "GET",
	"qs": { "take": 100 },
	"response": {
		"iterate": "{{body}}",
		"output": {
			"label": "{{item.name}}",
			"value": "{{item.id}}"
		}
	}
}
```

- [ ] **Step 4: Создать `make/rpcs/get-chats/get-chats.communication.iml.json`**

```json
{
	"url": "/api/chats",
	"method": "GET",
	"qs": { "take": 100 },
	"response": {
		"iterate": "{{body.data}}",
		"output": {
			"label": "{{if(item.displayName, item.displayName, item.id)}}",
			"value": "{{item.id}}"
		}
	}
}
```

- [ ] **Step 5: Зарегистрировать RPC в `make/makecomapp.json`**

В объект `components.rpc` (сейчас `{}`) записать:

```json
"rpc": {
	"getAssistants": {
		"label": "List Assistants",
		"connection": "happ",
		"altConnection": null,
		"codeFiles": {
			"communication": "rpcs/get-assistants/get-assistants.communication.iml.json",
			"params": "rpcs/get-assistants/get-assistants.params.iml.json"
		}
	},
	"getCompanies": {
		"label": "List Companies",
		"connection": "happ",
		"altConnection": null,
		"codeFiles": {
			"communication": "rpcs/get-companies/get-companies.communication.iml.json",
			"params": "rpcs/get-companies/get-companies.params.iml.json"
		}
	},
	"getChats": {
		"label": "List Chats",
		"connection": "happ",
		"altConnection": null,
		"codeFiles": {
			"communication": "rpcs/get-chats/get-chats.communication.iml.json",
			"params": "rpcs/get-chats/get-chats.params.iml.json"
		}
	}
}
```

- [ ] **Step 6: Валидация**

Run: `cd make && node scripts/validate.mjs`
Expected: `VALIDATION OK`

- [ ] **Step 7: Commit**

```bash
git add make/rpcs make/makecomapp.json
git commit -m "feat(make): add getAssistants/getCompanies/getChats RPCs"
```

---

### Task 4: Модули ресурса Chat (9 модулей)

**Files (по папке на модуль, `make/modules/<id>/`):**
- Create: `chat-get-many`, `chat-get`, `chat-create`, `chat-update`, `chat-delete`, `chat-toggle-ai-control`, `chat-assign-assistant`, `chat-unassign-assistant`, `chat-get-messengers`
- Modify: `make/makecomapp.json`, `make/modules/groups.json`

**Interfaces:**
- Consumes: connection `happ`, Base, RPC `getAssistants`.
- Produces: module-id'ы выше (используются только в groups.json).

**Boilerplate для КАЖДОГО модуля этой задачи.** В папке `make/modules/<id>/` создаются 6 файлов. Четыре из них одинаковы у всех модулей задачи:
- `<id>.static-params.iml.json` → `[]`
- `<id>.samples.iml.json` → `{}`
- `<id>.scope.iml.json` → `[]`
- `<id>.interface.iml.json` → `[]`

Различаются `<id>.communication.iml.json` и `<id>.mappable-params.iml.json` — приведены ниже для каждого модуля.

- [ ] **Step 1: `chat-get-many` (Search)**

`chat-get-many.communication.iml.json`:
```json
{
	"url": "/api/chats",
	"method": "GET",
	"qs": { "take": 100, "skip": "{{(pagination.page - 1) * 100}}" },
	"pagination": { "condition": "{{length(body.data) > 0}}" },
	"response": {
		"limit": "{{parameters.limit}}",
		"iterate": "{{body.data}}",
		"output": "{{item}}"
	}
}
```
`chat-get-many.mappable-params.iml.json`:
```json
[
	{ "name": "limit", "type": "uinteger", "label": "Limit", "default": 50 }
]
```

- [ ] **Step 2: `chat-get` (Action, read)**

`chat-get.communication.iml.json`:
```json
{
	"url": "/api/chats/{{parameters.chatId}}",
	"method": "GET",
	"qs": { "include": "{{parameters.include}}" },
	"response": { "output": "{{body}}" }
}
```
`chat-get.mappable-params.iml.json`:
```json
[
	{ "name": "chatId", "type": "text", "label": "Chat ID", "required": true },
	{ "name": "include", "type": "text", "label": "Include", "default": "messages", "help": "Comma-separated related data to include, e.g. messages." }
]
```

- [ ] **Step 3: `chat-create` (Action, create)**

`chat-create.communication.iml.json`:
```json
{
	"url": "/api/chats",
	"method": "POST",
	"headers": { "Content-Type": "application/json" },
	"body": "{{parameters.bodyJson}}",
	"response": { "output": "{{body}}" }
}
```
`chat-create.mappable-params.iml.json`:
```json
[
	{ "name": "bodyJson", "type": "text", "label": "Body (JSON)", "default": "{}", "help": "Raw JSON body. The public API spec does not document chat fields — see docs.happ.tools." }
]
```

- [ ] **Step 4: `chat-update` (Action, update)**

`chat-update.communication.iml.json`:
```json
{
	"url": "/api/chats/{{parameters.chatId}}",
	"method": "PATCH",
	"headers": { "Content-Type": "application/json" },
	"body": "{{parameters.bodyJson}}",
	"response": { "output": "{{body}}" }
}
```
`chat-update.mappable-params.iml.json`:
```json
[
	{ "name": "chatId", "type": "text", "label": "Chat ID", "required": true },
	{ "name": "bodyJson", "type": "text", "label": "Body (JSON)", "default": "{}", "help": "Raw JSON body. See docs.happ.tools." }
]
```

- [ ] **Step 5: `chat-delete` (Action, delete)**

`chat-delete.communication.iml.json`:
```json
{
	"url": "/api/chats/{{parameters.chatId}}",
	"method": "DELETE",
	"response": { "output": "{{body}}" }
}
```
`chat-delete.mappable-params.iml.json`:
```json
[
	{ "name": "chatId", "type": "text", "label": "Chat ID", "required": true }
]
```

- [ ] **Step 6: `chat-toggle-ai-control` (Action, update)**

`chat-toggle-ai-control.communication.iml.json`:
```json
{
	"url": "/api/chats/{{parameters.chatId}}/ai-control",
	"method": "PATCH",
	"headers": { "Content-Type": "application/json" },
	"body": {
		"isUnderAiControl": "{{parameters.isUnderAiControl}}",
		"aiDisableReason": "{{parameters.aiDisableReason}}"
	},
	"response": { "output": "{{body}}" }
}
```
`chat-toggle-ai-control.mappable-params.iml.json`:
```json
[
	{ "name": "chatId", "type": "text", "label": "Chat ID", "required": true },
	{ "name": "isUnderAiControl", "type": "boolean", "label": "AI Control Enabled", "required": true, "default": true },
	{ "name": "aiDisableReason", "type": "select", "label": "AI Disable Reason", "options": [ { "label": "Manual", "value": "manual" }, { "label": "Auto", "value": "auto" } ] }
]
```

- [ ] **Step 7: `chat-assign-assistant` (Action, update)**

`chat-assign-assistant.communication.iml.json`:
```json
{
	"url": "/api/chats/{{parameters.chatId}}/assign-assistant",
	"method": "PATCH",
	"headers": { "Content-Type": "application/json" },
	"body": { "assistantId": "{{parameters.assistantId}}" },
	"response": { "output": "{{body}}" }
}
```
`chat-assign-assistant.mappable-params.iml.json`:
```json
[
	{ "name": "chatId", "type": "text", "label": "Chat ID", "required": true },
	{ "name": "assistantId", "type": "select", "label": "Assistant", "required": true, "options": "rpc://getAssistants" }
]
```

- [ ] **Step 8: `chat-unassign-assistant` (Action, update)**

`chat-unassign-assistant.communication.iml.json`:
```json
{
	"url": "/api/chats/{{parameters.chatId}}/unassign-assistant",
	"method": "PATCH",
	"response": { "output": "{{body}}" }
}
```
`chat-unassign-assistant.mappable-params.iml.json`:
```json
[
	{ "name": "chatId", "type": "text", "label": "Chat ID", "required": true }
]
```

- [ ] **Step 9: `chat-get-messengers` (Search)**

`chat-get-messengers.communication.iml.json`:
```json
{
	"url": "/api/chats/messengers",
	"method": "GET",
	"response": {
		"iterate": "{{body}}",
		"output": "{{item}}"
	}
}
```
`chat-get-messengers.mappable-params.iml.json`:
```json
[]
```

- [ ] **Step 10: Boilerplate-файлы для всех 9 модулей**

Для каждого `<id>` из списка задачи создать `<id>.static-params.iml.json`=`[]`, `<id>.samples.iml.json`=`{}`, `<id>.scope.iml.json`=`[]`, `<id>.interface.iml.json`=`[]`.

- [ ] **Step 11: Зарегистрировать модули в `make/makecomapp.json`**

В объект `components.module` (сейчас `{}`) добавить 9 записей. Шаблон записи (подставить `<id>`, `<Label>`, `<moduleType>`, `<actionCrud|null>`; `connection` у всех `"happ"`):

```json
"chatGetMany": {
	"label": "Get Many Chats",
	"description": "List chat conversations",
	"moduleType": "search",
	"connection": "happ",
	"altConnection": null,
	"codeFiles": {
		"communication": "modules/chat-get-many/chat-get-many.communication.iml.json",
		"staticParams": "modules/chat-get-many/chat-get-many.static-params.iml.json",
		"mappableParams": "modules/chat-get-many/chat-get-many.mappable-params.iml.json",
		"interface": "modules/chat-get-many/chat-get-many.interface.iml.json",
		"samples": "modules/chat-get-many/chat-get-many.samples.iml.json",
		"scope": "modules/chat-get-many/chat-get-many.scope.iml.json"
	}
}
```

Значения для остальных (manifest key → label → moduleType → actionCrud):
- `chatGet` → "Get a Chat" → action → read
- `chatCreate` → "Create a Chat" → action → create
- `chatUpdate` → "Update a Chat" → action → update
- `chatDelete` → "Delete a Chat" → action → delete
- `chatToggleAiControl` → "Toggle AI Control" → action → update
- `chatAssignAssistant` → "Assign Assistant" → action → update
- `chatUnassignAssistant` → "Unassign Assistant" → action → update
- `chatGetMessengers` → "Get Connected Messengers" → search → (без actionCrud)

Правило: у `action`-модулей добавить поле `"actionCrud": "<value>"`; у `search`-модулей поля `actionCrud` нет. `codeFiles` пути строятся по `modules/<kebab-id>/<kebab-id>.<segment>...`. Manifest-ключ — camelCase, имя папки/файлов — kebab-case (`chatGetMany` → `chat-get-many`).

- [ ] **Step 12: Обновить `make/modules/groups.json`**

Группа Chats получает все 9 module-id'ов:
```json
[
	{ "label": "Chats", "modules": ["chatGetMany", "chatGet", "chatCreate", "chatUpdate", "chatDelete", "chatToggleAiControl", "chatAssignAssistant", "chatUnassignAssistant", "chatGetMessengers"] },
	{ "label": "Messages", "modules": [] },
	{ "label": "Assistants", "modules": [] }
]
```

- [ ] **Step 13: Валидация**

Run: `cd make && node scripts/validate.mjs`
Expected: `VALIDATION OK`

- [ ] **Step 14: Commit**

```bash
git add make/modules make/makecomapp.json
git commit -m "feat(make): add Chat resource modules"
```

---

### Task 5: Модули ресурса Message (6 модулей)

**Files (`make/modules/<id>/`):** `message-send`, `message-get-many`, `message-get`, `message-get-last`, `message-update`, `message-delete`; Modify `make/makecomapp.json`, `make/modules/groups.json`.

**Interfaces:**
- Consumes: connection `happ`, Base, функция `recordToArray`, RPC `getChats`.
- Produces: module-id'ы (для groups.json).

**Boilerplate для КАЖДОГО модуля:** `<id>.static-params.iml.json`=`[]`, `<id>.samples.iml.json`=`{}`, `<id>.scope.iml.json`=`[]`, `<id>.interface.iml.json`=`[]`.

- [ ] **Step 1: `message-send` (Action, create)**

`message-send.communication.iml.json`:
```json
{
	"url": "/api/messages",
	"method": "POST",
	"headers": { "Content-Type": "application/json" },
	"body": {
		"chatId": "{{parameters.chatId}}",
		"source": "{{parameters.source}}",
		"role": "{{parameters.role}}",
		"type": "{{parameters.type}}",
		"text": "{{parameters.text}}",
		"externalId": "{{parameters.externalId}}",
		"sessionId": "{{parameters.sessionId}}",
		"fromId": "{{parameters.fromId}}",
		"toId": "{{parameters.toId}}",
		"transcription": "{{parameters.transcription}}",
		"audioUrl": "{{parameters.audioUrl}}",
		"fileUrl": "{{parameters.fileUrl}}",
		"specificType": "{{parameters.specificType}}",
		"functionCallId": "{{parameters.functionCallId}}",
		"functionCallName": "{{parameters.functionCallName}}",
		"functionCallInput": "{{parameters.functionCallInput}}",
		"functionCallOutput": "{{parameters.functionCallOutput}}"
	},
	"response": { "output": "{{body}}" }
}
```
`message-send.mappable-params.iml.json`:
```json
[
	{ "name": "chatId", "type": "text", "label": "Chat ID", "required": true },
	{ "name": "source", "type": "select", "label": "Source", "required": true, "default": "API", "options": [ { "label": "AI", "value": "AI" }, { "label": "API", "value": "API" }, { "label": "Custom Messenger", "value": "CUSTOM_MESSENGER" }, { "label": "Echat", "value": "ECHAT" }, { "label": "Instagram", "value": "INSTAGRAM" }, { "label": "Messenger", "value": "MESSENGER" }, { "label": "Mobile", "value": "MOBILE" }, { "label": "Platform", "value": "PLATFORM" }, { "label": "Playground", "value": "PLAYGROUND" }, { "label": "Telegram", "value": "TELEGRAM" }, { "label": "Telegram Bot", "value": "TELEGRAM_BOT" }, { "label": "WhatsApp", "value": "WHATSAPP" }, { "label": "Widget", "value": "WIDGET" } ] },
	{ "name": "role", "type": "select", "label": "Role", "required": true, "default": "Assistant", "options": [ { "label": "Assistant", "value": "Assistant" }, { "label": "Developer", "value": "Developer" }, { "label": "System", "value": "System" }, { "label": "User", "value": "User" } ] },
	{ "name": "type", "type": "select", "label": "Type", "required": true, "default": "Text", "options": [ { "label": "Audio", "value": "Audio" }, { "label": "Document", "value": "Document" }, { "label": "File", "value": "File" }, { "label": "Function Call", "value": "FunctionCall" }, { "label": "Function Call Output", "value": "FunctionCallOutput" }, { "label": "Photo", "value": "Photo" }, { "label": "Specific", "value": "Specific" }, { "label": "Text", "value": "Text" }, { "label": "Video", "value": "Video" } ] },
	{ "name": "text", "type": "text", "label": "Text" },
	{ "name": "externalId", "type": "text", "label": "External ID" },
	{ "name": "sessionId", "type": "text", "label": "Session ID" },
	{ "name": "fromId", "type": "text", "label": "From ID" },
	{ "name": "toId", "type": "text", "label": "To ID" },
	{ "name": "transcription", "type": "text", "label": "Transcription" },
	{ "name": "audioUrl", "type": "text", "label": "Audio URL" },
	{ "name": "fileUrl", "type": "text", "label": "File URL" },
	{ "name": "specificType", "type": "text", "label": "Specific Type" },
	{ "name": "functionCallId", "type": "text", "label": "Function Call ID" },
	{ "name": "functionCallName", "type": "text", "label": "Function Call Name" },
	{ "name": "functionCallInput", "type": "text", "label": "Function Call Input" },
	{ "name": "functionCallOutput", "type": "text", "label": "Function Call Output" }
]
```

- [ ] **Step 2: `message-get-many` (Search)**

`message-get-many.communication.iml.json`:
```json
{
	"url": "/api/messages",
	"method": "GET",
	"qs": { "chatId": "{{parameters.chatId}}", "take": 100, "skip": "{{(pagination.page - 1) * 100}}" },
	"pagination": { "condition": "{{length(body) > 0}}" },
	"response": {
		"limit": "{{parameters.limit}}",
		"iterate": "{{body}}",
		"output": "{{item}}"
	}
}
```
`message-get-many.mappable-params.iml.json`:
```json
[
	{ "name": "chatId", "type": "text", "label": "Chat ID", "required": true },
	{ "name": "limit", "type": "uinteger", "label": "Limit", "default": 50 }
]
```

- [ ] **Step 3: `message-get` (Action, read)**

`message-get.communication.iml.json`:
```json
{
	"url": "/api/messages/{{parameters.messageId}}",
	"method": "GET",
	"response": { "output": "{{body}}" }
}
```
`message-get.mappable-params.iml.json`:
```json
[
	{ "name": "messageId", "type": "text", "label": "Message ID", "required": true }
]
```

- [ ] **Step 4: `message-get-last` (Search, использует recordToArray)**

`message-get-last.communication.iml.json`:
```json
{
	"url": "/api/messages/last",
	"method": "GET",
	"qs": { "chatIds": "{{parameters.chatIds}}" },
	"response": {
		"iterate": "{{recordToArray(body)}}",
		"output": "{{item}}"
	}
}
```
`message-get-last.mappable-params.iml.json`:
```json
[
	{ "name": "chatIds", "type": "text", "label": "Chat IDs", "required": true, "help": "Comma-separated list of chat UUIDs." }
]
```

- [ ] **Step 5: `message-update` (Action, update)**

`message-update.communication.iml.json`:
```json
{
	"url": "/api/messages/{{parameters.messageId}}",
	"method": "PATCH",
	"headers": { "Content-Type": "application/json" },
	"body": {
		"chatId": "{{parameters.chatId}}",
		"text": "{{parameters.text}}",
		"transcription": "{{parameters.transcription}}"
	},
	"response": { "output": "{{body}}" }
}
```
`message-update.mappable-params.iml.json`:
```json
[
	{ "name": "messageId", "type": "text", "label": "Message ID", "required": true },
	{ "name": "chatId", "type": "text", "label": "Chat ID" },
	{ "name": "text", "type": "text", "label": "Text" },
	{ "name": "transcription", "type": "text", "label": "Transcription" }
]
```

- [ ] **Step 6: `message-delete` (Action, delete)**

`message-delete.communication.iml.json`:
```json
{
	"url": "/api/messages/{{parameters.messageId}}",
	"method": "DELETE",
	"response": { "output": "{{body}}" }
}
```
`message-delete.mappable-params.iml.json`:
```json
[
	{ "name": "messageId", "type": "text", "label": "Message ID", "required": true }
]
```

- [ ] **Step 7: Boilerplate-файлы для всех 6 модулей**

Для каждого `<id>`: `<id>.static-params.iml.json`=`[]`, `<id>.samples.iml.json`=`{}`, `<id>.scope.iml.json`=`[]`, `<id>.interface.iml.json`=`[]`.

- [ ] **Step 8: Зарегистрировать модули в `make/makecomapp.json`**

Добавить 6 записей в `components.module` по шаблону из Task 4 Step 11 (manifest key → label → moduleType → actionCrud, connection `"happ"`, у search нет `actionCrud`):
- `messageSend` → "Send a Message" → action → create
- `messageGetMany` → "Get Many Messages" → search
- `messageGet` → "Get a Message" → action → read
- `messageGetLast` → "Get Last Messages" → search
- `messageUpdate` → "Update a Message" → action → update
- `messageDelete` → "Delete a Message" → action → delete

- [ ] **Step 9: Обновить группу Messages в `make/modules/groups.json`**

```json
{ "label": "Messages", "modules": ["messageSend", "messageGetMany", "messageGet", "messageGetLast", "messageUpdate", "messageDelete"] }
```

- [ ] **Step 10: Валидация**

Run: `cd make && node scripts/validate.mjs`
Expected: `VALIDATION OK`

- [ ] **Step 11: Commit**

```bash
git add make/modules make/makecomapp.json
git commit -m "feat(make): add Message resource modules"
```

---

### Task 6: Модули ресурса Assistant (6 модулей)

**Files (`make/modules/<id>/`):** `assistant-get-many`, `assistant-get`, `assistant-create`, `assistant-update`, `assistant-delete`, `assistant-originate-call`; Modify `make/makecomapp.json`, `make/modules/groups.json`.

**Interfaces:**
- Consumes: connection `happ`, Base, RPC `getAssistants`, `getCompanies`.
- Produces: module-id'ы (для groups.json).

**Boilerplate для КАЖДОГО модуля:** `<id>.static-params.iml.json`=`[]`, `<id>.samples.iml.json`=`{}`, `<id>.scope.iml.json`=`[]`, `<id>.interface.iml.json`=`[]`.

- [ ] **Step 1: `assistant-get-many` (Search)**

`assistant-get-many.communication.iml.json`:
```json
{
	"url": "/api/assistants",
	"method": "GET",
	"qs": {
		"take": 100,
		"skip": "{{(pagination.page - 1) * 100}}",
		"name": "{{parameters.name}}",
		"type": "{{parameters.type}}",
		"companyId": "{{parameters.companyId}}",
		"search": "{{parameters.search}}",
		"folderId": "{{parameters.folderId}}"
	},
	"pagination": { "condition": "{{length(body) > 0}}" },
	"response": {
		"limit": "{{parameters.limit}}",
		"iterate": "{{body}}",
		"output": "{{item}}"
	}
}
```
`assistant-get-many.mappable-params.iml.json`:
```json
[
	{ "name": "limit", "type": "uinteger", "label": "Limit", "default": 50 },
	{ "name": "name", "type": "text", "label": "Name" },
	{ "name": "type", "type": "select", "label": "Type", "options": [ { "label": "Hybrid", "value": "hybrid" }, { "label": "Text", "value": "text" }, { "label": "Voice", "value": "voice" } ] },
	{ "name": "companyId", "type": "select", "label": "Company", "options": "rpc://getCompanies" },
	{ "name": "search", "type": "text", "label": "Search" },
	{ "name": "folderId", "type": "text", "label": "Folder ID" }
]
```

- [ ] **Step 2: `assistant-get` (Action, read)**

`assistant-get.communication.iml.json`:
```json
{
	"url": "/api/assistants/{{parameters.assistantId}}",
	"method": "GET",
	"response": { "output": "{{body}}" }
}
```
`assistant-get.mappable-params.iml.json`:
```json
[
	{ "name": "assistantId", "type": "select", "label": "Assistant", "required": true, "options": "rpc://getAssistants" }
]
```

- [ ] **Step 3: `assistant-create` (Action, create)**

`assistant-create.communication.iml.json`:
```json
{
	"url": "/api/assistants",
	"method": "POST",
	"headers": { "Content-Type": "application/json" },
	"body": {
		"name": "{{parameters.name}}",
		"promptText": "{{parameters.promptText}}",
		"companyId": "{{parameters.companyId}}",
		"firstMessage": "{{parameters.firstMessage}}",
		"language": "{{parameters.language}}",
		"providerId": "{{parameters.providerId}}",
		"eagerness": "{{parameters.eagerness}}",
		"ttsModel": "{{parameters.ttsModel}}",
		"elevenLabsVoiceId": "{{parameters.elevenLabsVoiceId}}",
		"vaVoice": "{{parameters.vaVoice}}",
		"voiceAssistantId": "{{parameters.voiceAssistantId}}",
		"textLlmModelId": "{{parameters.textLlmModelId}}",
		"voiceLlmModelId": "{{parameters.voiceLlmModelId}}",
		"assistantOutputAudioFormat": "{{parameters.assistantOutputAudioFormat}}",
		"userInputAudioFormat": "{{parameters.userInputAudioFormat}}",
		"softTimeout": "{{parameters.softTimeout}}",
		"softTimeoutMessage": "{{parameters.softTimeoutMessage}}",
		"streamingLatency": "{{parameters.streamingLatency}}",
		"turnAfterSilence": "{{parameters.turnAfterSilence}}",
		"silenceEndCallTimeout": "{{parameters.silenceEndCallTimeout}}",
		"disableFirstMessageInterruption": "{{parameters.disableFirstMessageInterruption}}"
	},
	"response": { "output": "{{body}}" }
}
```
`assistant-create.mappable-params.iml.json`:
```json
[
	{ "name": "name", "type": "text", "label": "Name", "required": true },
	{ "name": "promptText", "type": "text", "label": "Prompt Text", "required": true },
	{ "name": "companyId", "type": "select", "label": "Company", "required": true, "options": "rpc://getCompanies" },
	{ "name": "firstMessage", "type": "text", "label": "First Message" },
	{ "name": "language", "type": "text", "label": "Language" },
	{ "name": "providerId", "type": "text", "label": "Provider ID" },
	{ "name": "eagerness", "type": "select", "label": "Eagerness", "options": [ { "label": "Eager", "value": "eager" }, { "label": "Normal", "value": "normal" }, { "label": "Patient", "value": "patient" } ] },
	{ "name": "ttsModel", "type": "text", "label": "TTS Model" },
	{ "name": "elevenLabsVoiceId", "type": "text", "label": "ElevenLabs Voice ID" },
	{ "name": "vaVoice", "type": "text", "label": "VA Voice" },
	{ "name": "voiceAssistantId", "type": "text", "label": "Voice Assistant ID" },
	{ "name": "textLlmModelId", "type": "text", "label": "Text LLM Model ID" },
	{ "name": "voiceLlmModelId", "type": "text", "label": "Voice LLM Model ID" },
	{ "name": "assistantOutputAudioFormat", "type": "select", "label": "Assistant Output Audio Format", "options": [ { "label": "PCM 8000", "value": "pcm_8000" }, { "label": "PCM 16000", "value": "pcm_16000" }, { "label": "PCM 22050", "value": "pcm_22050" }, { "label": "PCM 24000", "value": "pcm_24000" }, { "label": "PCM 44100", "value": "pcm_44100" }, { "label": "PCM 48000", "value": "pcm_48000" }, { "label": "ULAW 8000", "value": "ulaw_8000" } ] },
	{ "name": "userInputAudioFormat", "type": "select", "label": "User Input Audio Format", "options": [ { "label": "PCM 8000", "value": "pcm_8000" }, { "label": "PCM 16000", "value": "pcm_16000" }, { "label": "PCM 22050", "value": "pcm_22050" }, { "label": "PCM 24000", "value": "pcm_24000" }, { "label": "PCM 44100", "value": "pcm_44100" }, { "label": "PCM 48000", "value": "pcm_48000" }, { "label": "ULAW 8000", "value": "ulaw_8000" } ] },
	{ "name": "softTimeout", "type": "number", "label": "Soft Timeout" },
	{ "name": "softTimeoutMessage", "type": "text", "label": "Soft Timeout Message" },
	{ "name": "streamingLatency", "type": "number", "label": "Streaming Latency" },
	{ "name": "turnAfterSilence", "type": "number", "label": "Turn After Silence" },
	{ "name": "silenceEndCallTimeout", "type": "number", "label": "Silence End Call Timeout" },
	{ "name": "disableFirstMessageInterruption", "type": "boolean", "label": "Disable First Message Interruption" }
]
```

- [ ] **Step 4: `assistant-update` (Action, update)**

`assistant-update.communication.iml.json`:
```json
{
	"url": "/api/assistants/{{parameters.assistantId}}",
	"method": "PATCH",
	"headers": { "Content-Type": "application/json" },
	"body": {
		"name": "{{parameters.name}}",
		"promptText": "{{parameters.promptText}}",
		"firstMessage": "{{parameters.firstMessage}}",
		"language": "{{parameters.language}}"
	},
	"response": { "output": "{{body}}" }
}
```
`assistant-update.mappable-params.iml.json`:
```json
[
	{ "name": "assistantId", "type": "select", "label": "Assistant", "required": true, "options": "rpc://getAssistants" },
	{ "name": "name", "type": "text", "label": "Name" },
	{ "name": "promptText", "type": "text", "label": "Prompt Text" },
	{ "name": "firstMessage", "type": "text", "label": "First Message" },
	{ "name": "language", "type": "text", "label": "Language" }
]
```

- [ ] **Step 5: `assistant-delete` (Action, delete)**

`assistant-delete.communication.iml.json`:
```json
{
	"url": "/api/assistants/{{parameters.assistantId}}",
	"method": "DELETE",
	"response": { "output": "{{body}}" }
}
```
`assistant-delete.mappable-params.iml.json`:
```json
[
	{ "name": "assistantId", "type": "select", "label": "Assistant", "required": true, "options": "rpc://getAssistants" }
]
```

- [ ] **Step 6: `assistant-originate-call` (Action, create)**

`assistant-originate-call.communication.iml.json`:
```json
{
	"url": "/api/assistants/{{parameters.assistantId}}/originate",
	"method": "POST",
	"headers": { "Content-Type": "application/json" },
	"body": {
		"phoneNumber": "{{parameters.phoneNumber}}",
		"callerAssistantId": "{{parameters.callerAssistantId}}"
	},
	"response": { "output": "{{body}}" }
}
```
`assistant-originate-call.mappable-params.iml.json`:
```json
[
	{ "name": "assistantId", "type": "select", "label": "Assistant", "required": true, "options": "rpc://getAssistants" },
	{ "name": "phoneNumber", "type": "text", "label": "Phone Number", "required": true, "help": "+<digits>, digits with country code (380...), or local format starting with 0." },
	{ "name": "callerAssistantId", "type": "select", "label": "Caller Assistant", "options": "rpc://getAssistants", "help": "If empty, the route assistant is used." }
]
```

- [ ] **Step 7: Boilerplate-файлы для всех 6 модулей**

Для каждого `<id>`: `<id>.static-params.iml.json`=`[]`, `<id>.samples.iml.json`=`{}`, `<id>.scope.iml.json`=`[]`, `<id>.interface.iml.json`=`[]`.

- [ ] **Step 8: Зарегистрировать модули в `make/makecomapp.json`**

Добавить 6 записей в `components.module` по шаблону Task 4 Step 11:
- `assistantGetMany` → "Get Many Assistants" → search
- `assistantGet` → "Get an Assistant" → action → read
- `assistantCreate` → "Create an Assistant" → action → create
- `assistantUpdate` → "Update an Assistant" → action → update
- `assistantDelete` → "Delete an Assistant" → action → delete
- `assistantOriginateCall` → "Originate Call" → action → create

- [ ] **Step 9: Обновить группу Assistants в `make/modules/groups.json`**

```json
{ "label": "Assistants", "modules": ["assistantGetMany", "assistantGet", "assistantCreate", "assistantUpdate", "assistantDelete", "assistantOriginateCall"] }
```

- [ ] **Step 10: Валидация**

Run: `cd make && node scripts/validate.mjs`
Expected: `VALIDATION OK`

- [ ] **Step 11: Commit**

```bash
git add make/modules make/makecomapp.json
git commit -m "feat(make): add Assistant resource modules"
```

---

### Task 7: Polling-триггеры (New Chat, New Message)

**Files (`make/modules/<id>/`):** `watch-new-chats`, `watch-new-messages`; Modify `make/makecomapp.json`, `make/modules/groups.json`.

**Interfaces:**
- Consumes: connection `happ`, Base, RPC `getChats`.
- Produces: trigger-модули `watchNewChats`, `watchNewMessages`.

**Boilerplate для КАЖДОГО триггера:** `<id>.static-params.iml.json`=`[]`, `<id>.samples.iml.json`=`{}`, `<id>.scope.iml.json`=`[]`, `<id>.interface.iml.json`=`[]`. Триггеры ДОПОЛНИТЕЛЬНО имеют `<id>.epoch.iml.json` (см. ниже) и в манифесте `moduleType: "trigger"`.

- [ ] **Step 1: `watch-new-chats` (Trigger)**

`watch-new-chats.communication.iml.json`:
```json
{
	"url": "/api/chats",
	"method": "GET",
	"qs": { "take": 100 },
	"response": {
		"iterate": "{{body.data}}",
		"output": "{{item}}",
		"trigger": {
			"id": "{{item.id}}",
			"date": "{{item.createdAt}}",
			"type": "date",
			"order": "desc"
		}
	}
}
```
`watch-new-chats.mappable-params.iml.json`:
```json
[]
```
`watch-new-chats.epoch.iml.json`:
```json
{
	"url": "/api/chats",
	"method": "GET",
	"qs": { "take": 100 },
	"response": {
		"iterate": "{{body.data}}",
		"output": {
			"id": "{{item.id}}",
			"date": "{{item.createdAt}}",
			"label": "{{if(item.displayName, item.displayName, item.id)}}"
		}
	}
}
```

- [ ] **Step 2: `watch-new-messages` (Trigger)**

`watch-new-messages.communication.iml.json`:
```json
{
	"url": "/api/messages",
	"method": "GET",
	"qs": { "chatId": "{{parameters.chatId}}", "take": 100 },
	"response": {
		"iterate": "{{body}}",
		"output": "{{item}}",
		"trigger": {
			"id": "{{item.id}}",
			"date": "{{item.createdAt}}",
			"type": "date",
			"order": "desc"
		}
	}
}
```
`watch-new-messages.mappable-params.iml.json`:
```json
[
	{ "name": "chatId", "type": "select", "label": "Chat", "required": true, "options": "rpc://getChats" }
]
```
`watch-new-messages.epoch.iml.json`:
```json
{
	"url": "/api/messages",
	"method": "GET",
	"qs": { "chatId": "{{parameters.chatId}}", "take": 100 },
	"response": {
		"iterate": "{{body}}",
		"output": {
			"id": "{{item.id}}",
			"date": "{{item.createdAt}}",
			"label": "{{item.text}}"
		}
	}
}
```

- [ ] **Step 3: Boilerplate-файлы для обоих триггеров**

Для `watch-new-chats` и `watch-new-messages`: `<id>.static-params.iml.json`=`[]`, `<id>.samples.iml.json`=`{}`, `<id>.scope.iml.json`=`[]`, `<id>.interface.iml.json`=`[]`.

- [ ] **Step 4: Зарегистрировать триггеры в `make/makecomapp.json`**

Добавить 2 записи в `components.module`. У триггера `moduleType: "trigger"`, нет `actionCrud`, есть `epoch` в `codeFiles`. Пример:

```json
"watchNewChats": {
	"label": "Watch New Chats",
	"description": "Triggers when a new chat conversation appears",
	"moduleType": "trigger",
	"connection": "happ",
	"altConnection": null,
	"codeFiles": {
		"communication": "modules/watch-new-chats/watch-new-chats.communication.iml.json",
		"staticParams": "modules/watch-new-chats/watch-new-chats.static-params.iml.json",
		"mappableParams": "modules/watch-new-chats/watch-new-chats.mappable-params.iml.json",
		"interface": "modules/watch-new-chats/watch-new-chats.interface.iml.json",
		"samples": "modules/watch-new-chats/watch-new-chats.samples.iml.json",
		"scope": "modules/watch-new-chats/watch-new-chats.scope.iml.json",
		"epoch": "modules/watch-new-chats/watch-new-chats.epoch.iml.json"
	}
}
```

Вторая запись `watchNewMessages` — аналогично, label "Watch New Messages", description "Triggers when a new message appears in the selected chat", пути `modules/watch-new-messages/watch-new-messages.<segment>...`.

- [ ] **Step 5: Обновить `make/modules/groups.json` — добавить группу Triggers**

```json
[
	{ "label": "Chats", "modules": ["chatGetMany", "chatGet", "chatCreate", "chatUpdate", "chatDelete", "chatToggleAiControl", "chatAssignAssistant", "chatUnassignAssistant", "chatGetMessengers"] },
	{ "label": "Messages", "modules": ["messageSend", "messageGetMany", "messageGet", "messageGetLast", "messageUpdate", "messageDelete"] },
	{ "label": "Assistants", "modules": ["assistantGetMany", "assistantGet", "assistantCreate", "assistantUpdate", "assistantDelete", "assistantOriginateCall"] },
	{ "label": "Triggers", "modules": ["watchNewChats", "watchNewMessages"] }
]
```

- [ ] **Step 6: Валидация**

Run: `cd make && node scripts/validate.mjs`
Expected: `VALIDATION OK` (валидатор отдельно проверяет, что у `moduleType:"trigger"` есть `epoch`).

- [ ] **Step 7: Commit**

```bash
git add make/modules make/makecomapp.json
git commit -m "feat(make): add New Chat and New Message polling triggers"
```

---

### Task 8: Финальная проверка структуры и деплой-гайд

**Files:**
- Modify: `make/README.md` (при необходимости)
- Verify: весь `make/`

**Interfaces:**
- Consumes: всё из Task 1–7.
- Produces: проверенное, готовое к деплою приложение.

- [ ] **Step 1: Полная валидация структуры**

Run: `cd make && node scripts/validate.mjs`
Expected: `VALIDATION OK`

- [ ] **Step 2: Прогон node-тестов**

Run: `cd make && node --test tests/`
Expected: PASS (3 теста recordToArray).

- [ ] **Step 3: Проверить полноту манифеста (счётчики)**

Run (PowerShell): `cd make; node -e "const m=require('./makecomapp.json'); console.log('modules', Object.keys(m.components.module).length, 'rpc', Object.keys(m.components.rpc).length, 'fn', Object.keys(m.components.function).length, 'conn', Object.keys(m.components.connection).length)"`
Expected: `modules 23 rpc 3 fn 1 conn 1` (21 action/search + 2 trigger = 23 модуля).

- [ ] **Step 4: Проверить отсутствие осиротевших файлов и валидность всех JSON**

Это уже покрыто `validate.mjs` (symmetry + JSON.parse). Убедиться, что вывод `VALIDATION OK` без предупреждений.

- [ ] **Step 5: Живой деплой и проверка (требует аккаунт Make пользователя)**

Документировано в `make/README.md`. Проверочный сценарий:
1. Установить VS Code «Make Apps Editor», создать Make API key → `make/.secrets/apikey`.
2. В `makecomapp.json` → `origins[0]`: подставить зону (`https://eu1.make.com/api` или eu2) и реальный `appId` (создать приложение в Make или через extension).
3. Right-click `makecomapp.json` → **Deploy to Make**.
4. Создать Connection Happ (Access Token + Production) — проверка соединения должна пройти (`/api/chats/messengers`).
5. Прогнать: Get Many Chats, Send a Message, Get Many Assistants; RPC-выпадашки (Assistant/Company/Chat).
6. Триггеры: Watch New Chats и Watch New Messages (выбрать чат) — проверить выбор epoch и появление новых записей.

**Если deploy выдаёт ошибку схемы манифеста** — расширение укажет недопустимое поле; поправить `makecomapp.json` по сообщению (наиболее вероятно: имена `codeFiles`-ключей или отсутствие обязательного файла). Пересобрать, повторить.

- [ ] **Step 6: Commit (если правился README/манифест)**

```bash
git add make
git commit -m "docs(make): finalize deploy guide and verify structure"
```

---

## Отступления от спеки / решения

- **Тело JSON у chat create/update** передаётся как строка (`"body": "{{parameters.bodyJson}}"` + `Content-Type: application/json`). Если Make экранирует строку и сервер не принимает — на живом тесте заменить на парсинг (`{{parse(...)}}`) или collection-поле. Помечено как live-test (DTO пуст в спеке, как и в n8n).
- **Вызов `recordToArray` в IML** записан как `{{recordToArray(body)}}`. Если среда Make требует префикс (`{{iml.recordToArray(...)}}`) — поправить в `message-get-last.communication.iml.json` на живом тесте. Изолировано одним модулем.
- **interface всех модулей = `[]`**, вывод данных — passthrough (`{{body}}`/`{{item}}`). Поля в маппинге появятся после первого реального прогона (sample). Осознанное упрощение (не выдумываем схемы под недокументированные объекты).
- **Пустые опциональные поля** в body (например `aiDisableReason`, optional message-поля) Make может отправлять пустыми строками. Для основного потока это безопасно; при необходимости на живом тесте обернуть в условие.
- **New Message-триггер — по одному чату** (через `getChats`), режим «все чаты» недоступен в Make polling (см. спеку). Единственное логическое расхождение с n8n.
- **`origins.appId` и зона eu1/eu2** — заполняет пользователь перед деплоем (нельзя узнать из кода).

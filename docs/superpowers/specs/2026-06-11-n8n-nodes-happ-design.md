# Дизайн: n8n-nodes-happ — community-нода n8n для Happ Platform API

**Дата:** 2026-06-11
**Статус:** утверждён пользователем

## Цель

Кастомная нода n8n для [Happ Platform API](https://api.happ.tools/reference) — сервиса подключения мессенджер-каналов (Telegram, Instagram, WhatsApp) и голосового ассистента к бизнесу. Пакет оформляется как community-нода (`n8n-nodes-happ`) с возможностью публикации в npm и установки через Settings → Community Nodes.

## Решения (утверждены)

- **Охват API:** ядро — ресурсы Chats, Messages, Assistants. Административные ресурсы (Companies, Access Tokens, Invitations, Assistant Tools/Knowledge) не входят.
- **Триггер:** да — отдельная polling-триггер-нода (событийных вебхуков в API нет).
- **Дистрибуция:** community-нода по стандартам n8n (npm-совместимая).
- **AI Tool:** `usableAsTool: true` — нода доступна как инструмент для AI Agent в n8n.
- **Стиль реализации:** основная нода — декларативная (routing-based), триггер — программный (декларативный стиль триггеры не поддерживает).

## Справка по API

- Спек: `GET https://api.happ.tools/api/swagger-json` (локальная копия: `happ-openapi.json` в корне проекта).
- Документация: https://docs.happ.tools/en/docs/api, индекс для LLM: https://docs.happ.tools/llms.txt
- Серверы: Production `https://api.happ.tools`, Development `https://api.dev.happ.tools`.
- Аутентификация интеграций: заголовок `X-Access-Token: happ_...` (токен скоупится на одну компанию). JWT — только для админки, в ноде не используется.

## Структура пакета

```
n8n-nodes-happ/
├── package.json              # манифест community-ноды (раздел "n8n")
├── tsconfig.json
├── credentials/
│   └── HappApi.credentials.ts    # X-Access-Token + выбор сервера (prod/dev)
├── nodes/
│   └── Happ/
│       ├── Happ.node.ts           # декларативная нода-действия
│       ├── HappTrigger.node.ts    # программный polling-триггер
│       ├── descriptions/
│       │   ├── ChatDescription.ts
│       │   ├── MessageDescription.ts
│       │   └── AssistantDescription.ts
│       └── happ.svg               # иконка
└── README.md
```

## Credentials: HappApi

- **Access Token** (string, password-masked) → отправляется в заголовке `X-Access-Token`.
- **Environment** (options): Production `https://api.happ.tools` (по умолчанию) / Development `https://api.dev.happ.tools`. Используется как `baseURL`.
- Тест credentials: `GET /api/companies/my`.

## Нода Happ (действия)

Декларативный стиль, `usableAsTool: true`. Тщательные `description` у всех полей и операций — они же служат подсказками для AI Agent.

### Resource: Chat

| Операция | Endpoint | Примечания |
|---|---|---|
| Get Many | `GET /api/chats` | пагинация skip/take, опция Return All |
| Get | `GET /api/chats/{id}` | query `include` (обязателен в спеке) — подгрузка сообщений |
| Create | `POST /api/chats` | DTO в спеке пуст → гибкое поле JSON Body |
| Update | `PATCH /api/chats/{id}` | DTO пуст → JSON Body |
| Delete | `DELETE /api/chats/{id}` | |
| Toggle AI Control | `PATCH /api/chats/{id}/ai-control` | `isUnderAiControl` (boolean, обяз.), `aiDisableReason` (`manual`/`auto`) |
| Assign Assistant | `PATCH /api/chats/{id}/assign-assistant` | DTO пуст → поле Assistant ID + JSON-fallback |
| Unassign Assistant | `PATCH /api/chats/{id}/unassign-assistant` | без тела |
| Get Messengers | `GET /api/chats/messengers` | список подключённых мессенджеров |

### Resource: Message

| Операция | Endpoint | Примечания |
|---|---|---|
| Send (Create) | `POST /api/messages` | обязательные: `source`, `role`, `type` (dropdown по enum из спека); основные: `chatId`, `text`; остальное (externalId, sessionId, fromId, toId, transcription, audioUrl, fileUrl, functionCall*) — Additional Fields |
| Get Many | `GET /api/messages` | `chatId` обязателен; пагинация skip/take, Return All |
| Get | `GET /api/messages/{id}` | |
| Update | `PATCH /api/messages/{id}` | |
| Delete | `DELETE /api/messages/{id}` | |
| Get Last | `GET /api/messages/last` | `chatIds` — comma-separated список UUID чатов |

Enum-значения (из спека): `source` — TELEGRAM, TELEGRAM_BOT, INSTAGRAM, WHATSAPP, MESSENGER, ECHAT, CUSTOM_MESSENGER, WIDGET, PLATFORM, MOBILE, API, AI, PLAYGROUND; `role` — System, Assistant, User, Developer; `type` — Text, Audio, File, Document, Photo, Video, Specific, FunctionCallOutput, FunctionCall.

### Resource: Assistant

| Операция | Endpoint | Примечания |
|---|---|---|
| Get Many | `GET /api/assistants` | фильтры: name, type (voice/text/hybrid), companyId, search, folderId; пагинация |
| Get | `GET /api/assistants/{id}` | |
| Create | `POST /api/assistants` | обязательные: `name`, `promptText`, `companyId`; ~20 опциональных (voice-настройки, LLM-модели, таймауты) — Additional Fields |
| Update | `PATCH /api/assistants/{id}` | |
| Delete | `DELETE /api/assistants/{id}` | |
| Originate Call | `POST /api/assistants/{id}/originate` | `phoneNumber` (обяз.), `callerAssistantId` (опц.) |

### UX

- `companyId` и `assistantId` — `resourceLocator`/`loadOptions`: динамическая подгрузка списка из `GET /api/companies/my` и `GET /api/assistants`, плюс ручной ввод ID или выражение.

## Нода Happ Trigger (polling)

Программный стиль, метод `poll()`.

- **События:** New Message, New Chat.
- **Механизм:** в `workflowStaticData` хранится отметка последнего увиденного (timestamp создания/ID). На каждом тике:
  - New Chat: `GET /api/chats` → отдать записи новее отметки.
  - New Message (конкретный чат): `GET /api/messages?chatId=...`.
  - New Message (все чаты): `GET /api/chats` → собрать ID → `GET /api/messages/last?chatIds=...` → отдать новые.
- **Фильтры:** по `chatId`; по `role` (например, только User — чтобы workflow не зацикливался на ответах ассистента).

## Обработка ошибок

- Декларативная нода: стандартный маппинг n8n в `NodeApiError`; для 401 — подсказка «проверьте Access Token и окружение (prod/dev)».
- Поддержка `continueOnFail` (стандартно для декларативных нод и в `poll()` триггера).

## Сборка и проверка

- TypeScript, сборка `tsc` + gulp-таск копирования иконок (стандартный шаблон n8n-nodes-starter).
- Линт `eslint-plugin-n8n-nodes-base` — обязателен для верификации community-нод.
- Локальная проверка: `npm link` в локальный n8n, ручной прогон операций против `api.dev.happ.tools` (при наличии токена) или production с тестовой компанией.

## Риски и открытые вопросы

1. **Пустые DTO** — `CreateChatDto`, `UpdateChatDto`, `AssignAssistantDto` в спеке не содержат полей. План: при реализации уточнить реальные поля по docs.happ.tools; fallback — поле JSON Body (для Assign Assistant — поле Assistant ID с отправкой `{ assistantId }` + JSON-fallback).
2. **`GET /api/messages` требует `chatId`** — режим триггера «New Message по всем чатам» реализуется двухстадийным опросом через `/api/messages/last` (см. выше).
3. **Rate limits не документированы** — polling-интервал по умолчанию оставить консервативным (стандартный n8n «every minute»).

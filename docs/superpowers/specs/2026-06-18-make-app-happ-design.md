# Дизайн: Make Custom App «Happ» — папка `make/`

**Дата:** 2026-06-18
**Статус:** утверждён пользователем

## Цель

Custom App для [Make.com](https://www.make.com/) к [Happ Platform API](https://api.happ.tools/reference), **полностью аналогичный по логике** уже опубликованной n8n-ноде `n8n-nodes-happ`. Те же ресурсы (Chat, Message, Assistant) и тот же набор операций (~21), плюс polling-триггеры. Приложение готовится как локальная git-папка в формате расширения VS Code «Make Apps Editor» (Apps SDK), деплоится в аккаунт пользователя в EU-зоне.

## Решения (утверждены)

- **Охват:** полный паритет с n8n-нодой.
- **Формат поставки:** локальная git-папка Apps SDK (`makecomapp.json` + компоненты), деплой через VS Code «Make Apps Editor» → Deploy to Make.
- **Зона Make:** EU (по умолчанию `eu1.make.com/api`; точное eu1/eu2 пользователь подставит перед деплоем).
- **Размещение:** подпапка `make/` в текущем репозитории (n8n-пакет остаётся в корне).

## Справка по API (переиспользуется из n8n-работы)

- OpenAPI: `happ-openapi.json` (корень репо). Серверы: Production `https://api.happ.tools`, Development `https://api.dev.happ.tools`.
- Аутентификация: заголовок `X-Access-Token: happ_...`. Токен **company-scoped**.
- **Важный урок:** `/api/companies/my` — user-scoped (только JWT), company-токену даёт 401. Для проверки соединения и списка компаний используем company-scoped эндпоинты (`/api/chats/messengers`, `/api/companies`).

## Маппинг концепций n8n → Make

| n8n | Make |
|---|---|
| credentials (X-Access-Token + prod/dev) | **Connection** (Basic) + **Base** |
| нода-действие (одиночный ответ) | **Action**-модуль |
| операция Get Many / список | **Search**-модуль (с `pagination`) |
| polling-триггер | **Trigger (polling)**-модуль с watermark `trigger.date` |
| loadOptions (выпадашки) | **RPC** (Remote Procedure Call) |
| GenericFunctions / хелперы | **IML-функции** (JS) |

## Архитектура компонентов

### Base (`base.iml.json`)
- `baseUrl`: `{{connection.environmentUrl}}` — берётся из соединения, сохраняя выбор Production/Development.
- `headers`: `{ "X-Access-Token": "{{connection.accessToken}}" }` — наследуется всеми модулями и RPC.
- `response.error`: единый разбор ошибок (`[{{statusCode}}]: ...` из тела ответа).
- `log.sanitize`: `["request.headers.X-Access-Token"]`.

### Connection (Basic, `connections/happ`)
- Параметры:
  - `accessToken` — type `password`, required. Описание: формат `happ_...`, company-scoped, с my.happ.tools.
  - `environment` — type `select`, опции: Production `https://api.happ.tools` (по умолчанию), Development `https://api.dev.happ.tools`. Выбранное значение сохраняется как `environmentUrl` через `response.data` (или эквивалент), чтобы Base мог его прочитать как `{{connection.environmentUrl}}`.
- Проверка (communication): `GET {environmentUrl}/api/chats/messengers` с заголовком `X-Access-Token: {{parameters.accessToken}}`; `valid` при `statusCode === 200`.

  Примечание: внутри самого блока проверки соединения значения берутся как `{{parameters.accessToken}}` (ещё не сохранены); во всех остальных местах (Base, модули, RPC) — `{{connection.accessToken}}`.

### Модули (полный паритет)

Все URL относительные (наследуют `baseUrl`). Заголовок авторизации наследуется из Base.

**Chat**
| Модуль | Тип | Метод / URL | Примечания |
|---|---|---|---|
| Get Many | Search | GET `/api/chats` | пагинация skip/take, `iterate {{body.data}}` |
| Get | Action | GET `/api/chats/{{parameters.chatId}}` | query `include` (обяз.) |
| Create | Action | POST `/api/chats` | DTO пуст → поле «Body (JSON)» |
| Update | Action | PATCH `/api/chats/{{parameters.chatId}}` | DTO пуст → Body (JSON) |
| Delete | Action | DELETE `/api/chats/{{parameters.chatId}}` | |
| Toggle AI Control | Action | PATCH `/api/chats/{{parameters.chatId}}/ai-control` | body `isUnderAiControl` (bool, обяз.), `aiDisableReason` (manual/auto) |
| Assign Assistant | Action | PATCH `/api/chats/{{parameters.chatId}}/assign-assistant` | body `assistantId` (через RPC getAssistants) |
| Unassign Assistant | Action | PATCH `/api/chats/{{parameters.chatId}}/unassign-assistant` | без тела |
| Get Messengers | Search | GET `/api/chats/messengers` | список мессенджеров |

**Message**
| Модуль | Тип | Метод / URL | Примечания |
|---|---|---|---|
| Send | Action | POST `/api/messages` | обяз.: source/role/type (enum), chatId, text; прочее опционально |
| Get Many | Search | GET `/api/messages` | `chatId` обязателен; пагинация |
| Get | Action | GET `/api/messages/{{parameters.messageId}}` | |
| Get Last | Search | GET `/api/messages/last` | `chatIds` (CSV); ответ `Record<chatId,msg>` → IML-функция `recordToArray` |
| Update | Action | PATCH `/api/messages/{{parameters.messageId}}` | |
| Delete | Action | DELETE `/api/messages/{{parameters.messageId}}` | |

Enum (из спека): `source` — TELEGRAM, TELEGRAM_BOT, INSTAGRAM, WHATSAPP, MESSENGER, ECHAT, CUSTOM_MESSENGER, WIDGET, PLATFORM, MOBILE, API, AI, PLAYGROUND; `role` — System, Assistant, User, Developer; `type` — Text, Audio, File, Document, Photo, Video, Specific, FunctionCallOutput, FunctionCall.

**Assistant**
| Модуль | Тип | Метод / URL | Примечания |
|---|---|---|---|
| Get Many | Search | GET `/api/assistants` | фильтры name/type/companyId/search/folderId; пагинация |
| Get | Action | GET `/api/assistants/{{parameters.assistantId}}` | |
| Create | Action | POST `/api/assistants` | обяз.: name, promptText, companyId; ~18 опц. полей |
| Update | Action | PATCH `/api/assistants/{{parameters.assistantId}}` | |
| Delete | Action | DELETE `/api/assistants/{{parameters.assistantId}}` | |
| Originate Call | Action | POST `/api/assistants/{{parameters.assistantId}}/originate` | body `phoneNumber` (обяз.), `callerAssistantId` (опц.) |

### Триггеры (polling)
- **New Chat** — GET `/api/chats`, `iterate {{body.data}}`, `trigger { id: item.id, date: item.createdAt, type: date, order: desc }`.
- **New Message** — GET `/api/messages?chatId={{parameters.chatId}}`, `iterate {{body}}`, watermark по `createdAt`.

**Отличие от n8n (принято пользователем):** в Make polling-триггер — один запрос, поэтому режим «все чаты разом» (через `/messages/last`) недоступен. New Message в Make **требует выбора конкретного чата** (поле `chatId`, через RPC getChats). Единственное логическое расхождение с n8n.

### RPC (динамические выпадашки)
- `getAssistants` → GET `/api/assistants`, `iterate {{body}}`, output `{ label: item.name, value: item.id }`.
- `getCompanies` → GET `/api/companies`, output `{ label: item.name, value: item.id }`.
- `getChats` → GET `/api/chats`, `iterate {{body.data}}`, output `{ label: item.displayName ?? item.id, value: item.id }`.

### IML-функции (`functions`)
- `recordToArray(obj)` — возвращает `Object.values(obj)` (для Get Last, где API отдаёт объект, а Search-модулю нужен массив).

## Структура папки

```
make/
├── makecomapp.json          # манифест: метаданные, компоненты, origins → eu1.make.com/api
├── .gitignore               # .secrets/
├── base.iml.json
├── common.json
├── connections/
│   └── happ/                # параметры + communication соединения
├── modules/
│   └── <module>/            # api/parameters/expect/interface/samples (.iml.json)
├── rpcs/
│   └── <rpc>/
├── functions/
│   └── recordToArray/
└── README.md
```

Точные имена файлов внутри компонентов и схема `makecomapp.json` — по документированному формату Apps SDK; манифест явно перечисляет пути к файлам компонентов, поэтому имена внутренне согласованы.

## Деплой

1. Пользователь открывает `make/` в VS Code с расширением **Make Apps Editor**.
2. Добавляет SDK-окружение: API-ключ Make + `eu1.make.com/api` (или eu2).
3. **Deploy to Make** — приложение появляется приватно в аккаунте.
4. Точную зону (eu1/eu2) пользователь подставляет в `makecomapp.json` (`origins`) перед деплоем; по умолчанию eu1.

Альтернатива — Make CLI (`make-cli`), тоже умеет деплоить app-компоненты (API-ключ + зона).

## Тестирование

Локального прогона как у npm-пакета нет — Make-приложение проверяется в среде Make. План верификации:
1. Deploy в аккаунт пользователя.
2. Проверка Connection (должна пройти на `/api/chats/messengers`).
3. Прогон ключевых модулей: Chat Get Many, Message Send, Assistant Get Many, RPC-выпадашки.
4. Триггеры New Chat / New Message (один чат) — проверка watermark.

## Риски и открытые вопросы

1. **Схема `makecomapp.json`** официально не опубликована целиком (точные имена файлов внутри компонентов локальной разработки). Блоки base/connection/module/rpc/IML — стабильны и задокументированы. **Митигация:** собрать компоненты по документированному формату + best-effort манифест; при первом `Deploy` расширение укажет на неточности манифеста — доведём по сообщениям. Подстраховка: создать пустое приложение через расширение (сгенерит корректный манифест) и наполнить компоненты.
2. **Пустые DTO** (`CreateChatDto`, `UpdateChatDto`, `AssignAssistantDto`) — как и в n8n: для chat create/update поле «Body (JSON)»; для assign-assistant поле `assistantId` (имя предположительное, как в n8n — живой тест).
3. **New Message по всем чатам** недоступен (см. выше) — осознанное упрощение.
4. **Get Last** возвращает объект, не массив — решается IML-функцией `recordToArray`.
5. **Зона eu1 vs eu2** — уточняется перед деплоем; тривиально правится в манифесте.

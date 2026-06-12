# n8n-nodes-happ

n8n community node for the [Happ platform](https://my.happ.tools/) —
connect messenger channels (Telegram, Instagram, WhatsApp) and AI voice assistants
to your n8n workflows via the [Happ Platform API](https://api.happ.tools/reference).

## Installation

In n8n: **Settings → Community Nodes → Install** → enter `n8n-nodes-happ`.

Manual install into a self-hosted n8n:

```bash
cd ~/.n8n/nodes
npm install n8n-nodes-happ
```

## Credentials

1. Sign in at [my.happ.tools](https://my.happ.tools/) and generate an **Access Token**
   (or `POST /api/companies/{companyId}/access-tokens` with a JWT). The token is
   company-scoped (`happ_...`).
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

- **New Message** — a single chat, or all chats via the last-message endpoint
  (in all-chats mode only the latest message per chat is delivered each poll and
  at most the first 100 chats are watched); optional role filter (e.g. only `User`
  messages).
- **New Chat** — fires when a new conversation appears.

## Resources

- [Happ platform](https://my.happ.tools/)
- [Happ API reference](https://api.happ.tools/reference)
- [Happ docs](https://docs.happ.tools/en/docs/api)

## License

MIT

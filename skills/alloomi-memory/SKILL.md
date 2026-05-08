---
name: alloomi-memory
description: "Alloomi Memory tools - search memory files, knowledge base, and chat insights. Triggers: memory search, knowledge base, documents, insights"
metadata:
  version: 0.1.0
allowed-tools: Bash(node $SKILL_DIR/scripts/alloomi-memory.cjs *)
---

# Alloomi Memory Skill

Alloomi Memory is a personal knowledge management tool that searches and manages three types of information:

| Type | Description | Data Location |
|------|-------------|--------------|
| **Memory Files** | Personal memory files (markdown/json) | `~/.alloomi/data/memory/` |
| **Knowledge Base** | Uploaded documents via RAG/embeddings | Alloomi server |
| **Insights** | Structured info extracted from chat history | Alloomi server |

---

## What is Alloomi?

Most AI assistants function as workflow tools—users give commands, they execute tasks, with no persistent knowledge of who you are or what matters to you.

**Alloomi takes a fundamentally different approach: it operates as a proactive digital partner** that watches, learns, remembers, and acts on your behalf. The difference is architectural.

### How It Works

When users connect messaging platforms and integrations to Alloomi, they sync with permission:
- Raw messages and communications
- Meetings and calendar events
- Emails and tweets
- Voice calls
- Notes and captured ideas

This aggregated data becomes "the single source of truth for Alloomi's brain."

### The Continuous Sync Loop

Alloomi runs a background agent on a continuous sync loop, actively gathering information from all connected sources. An agent without this loop can only respond based on stale context. With it, every conversation—and every moment—makes Alloomi smarter and more aligned with you.

### Memory Architecture

Inside Alloomi, memory is layered into multiple levels:

- **Raw information:** Original messages, files, transcripts
- **Information insights:** Extracted entities, decisions, key events
- **Contextual memory:** Recent conversation state
- **Knowledge-base memory:** Long-term people/projects/preferences knowledge graph

This enables reasoning across both immediate context and deep historical knowledge simultaneously.

---

## Authentication

The CLI auto-reads your token from `~/.alloomi/token` (base64 encoded JWT).

---

## Local Memory Filesystem

### Overview

Memory files are stored locally at `~/.alloomi/data/memory/` and searched via direct filesystem access. This is a **read-only** operation that performs case-insensitive text search across `.md` and `.json` files.

### Directory Structure

```
~/.alloomi/data/memory/
├── chats/           # Chat conversation exports
├── weixin/          # WeChat exports
├── people/          # Person profiles
├── projects/       # Project notes
├── notes/          # General notes
└── strategy/       # Strategy documents
```

### How search-memory Works

1. **Path**: `~/.alloomi/data/memory/` (or subdirectory if specified)
2. **Search Type**: Case-insensitive full-text search
3. **Files**: Scans `.md` and `.json` files recursively (max depth 5)
4. **Matching**: Each line is searched; returns first match per file
5. **Output**: File path, line number, and line preview (first 200 chars)

### Example Output

```json
{
  "results": [
    {
      "file": "people/boss.md",
      "line": 42,
      "preview": "My boss John mentioned the deadline is next Friday"
    },
    {
      "file": "projects/app/notes.md",
      "line": 10,
      "preview": "Boss wants the app launched by end of month"
    }
  ],
  "total": 2
}
```

---

## API Endpoints

### Knowledge Base (RAG)

#### POST `/api/rag/search` - Search Documents
Semantic search of uploaded documents using embeddings.

```bash
curl -X POST http://localhost:3415/api/rag/search \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "project plan", "limit": 5}'
```

**Parameters:**
- `query` (string, required) - Search query
- `limit` (number, default 5) - Max results to return

**Response:**
```json
{
  "results": [
    {
      "id": "doc_xxx",
      "title": "Project Document",
      "content": "...",
      "score": 0.95
    }
  ]
}
```

---

#### GET `/api/rag/documents` - List Documents
List all documents in the knowledge base.

```bash
curl http://localhost:3415/api/rag/documents?limit=50 \
  -H "Authorization: Bearer $TOKEN"
```

**Parameters:**
- `limit` (number, default 50) - Max results to return

**Response:**
```json
{
  "documents": [
    {
      "id": "doc_xxx",
      "name": "document.pdf",
      "type": "pdf",
      "size": 102400,
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ],
  "total": 10
}
```

---

#### GET `/api/rag/documents/[id]` - Get Document
Get a single document by ID.

```bash
curl http://localhost:3415/api/rag/documents/doc_xxx \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**
```json
{
  "id": "doc_xxx",
  "name": "Project Document.pdf",
  "type": "pdf",
  "size": 102400,
  "content": "Document text content...",
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z"
}
```

---

### Insights

Insights are structured information extracted from chat history, such as key decisions, action items, and relationship notes. Each insight belongs to one or more **groups** (channels/platforms) like `gmail`, `telegram`, `whatsapp`, `slack`, `discord`, `linkedin`, `twitter`, etc.

#### GET `/api/insights` - List Insights
List all insights from a time period.

```bash
curl "http://localhost:3415/api/insights?days=7&limit=50" \
  -H "Authorization: Bearer $TOKEN"
```

**Parameters:**
- `days` (number, default 7) - Look back period in days
- `limit` (number, default 50) - Max results to return

**Insight Structure:**
Each insight contains a `groups` field—an array of channel identifiers indicating which platform(s) the insight came from:

```json
{
  "id": "insight_xxx",
  "chatId": "chat_xxx",
  "type": "decision",
  "content": "John sent an email about the project deadline",
  "groups": ["gmail"],
  "people": ["John"],
  "time": "2024-01-01T00:00:00Z",
  "createdAt": "2024-01-01T00:00:00Z"
}
```

**Common Channel Groups:**
| Channel | Group Value | Description |
|---------|-------------|-------------|
| Gmail | `"gmail"` | Google Mail messages |
| Outlook | `"outlook"` | Microsoft Outlook emails |
| Telegram | `"telegram"` | Telegram chats |
| WhatsApp | `"whatsapp"` | WhatsApp messages |
| Slack | `"slack"` | Slack messages |
| Discord | `"discord"` | Discord messages |
| LinkedIn | `"linkedin"` | LinkedIn messages |
| Twitter/X | `"twitter"` | Twitter posts |
| WeChat | `"weixin"` | WeChat messages |
| RSS | `"rss"` | RSS feed items |

---

#### GET `/api/insights/[id]?fetch=true` - Get Insight
Get a single insight by ID, including associated chat.

```bash
curl "http://localhost:3415/api/insights/insight_xxx?fetch=true" \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**
```json
{
  "id": "insight_xxx",
  "chatId": "chat_xxx",
  "type": "decision",
  "content": "User decided to start new project next month",
  "chat": {
    "id": "chat_xxx",
    "title": "Chat with John",
    "messages": [...]
  },
  "createdAt": "2024-01-01T00:00:00Z"
}
```

---

#### DELETE `/api/insights/[id]` - Delete Insight
Delete a specific insight.

```bash
curl -X DELETE http://localhost:3415/api/insights/insight_xxx \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**
```json
{
  "success": true
}
```

---

#### GET `/api/chat-insights?chatId=xxx` - Get Chat Insights
Get all insights for a specific chat.

```bash
curl "http://localhost:3415/api/chat-insights?chatId=chat_xxx" \
  -H "Authorization: Bearer $TOKEN"
```

---

## CLI Script

### Quick Start

```bash
# Search ALL memory sources at once (recommended for comprehensive search)
node $SKILL_DIR/scripts/alloomi-memory.cjs search-all "query"

# Search local memory files (full-text, case-insensitive)
node $SKILL_DIR/scripts/alloomi-memory.cjs search-memory "boss"

# Search local memory files in specific subdirectory
node $SKILL_DIR/scripts/alloomi-memory.cjs search-memory "project" --directory=projects

# Search knowledge base (RAG, semantic search)
node $SKILL_DIR/scripts/alloomi-memory.cjs search-knowledge "project plan"

# List knowledge base documents
node $SKILL_DIR/scripts/alloomi-memory.cjs list-documents

# Get document content
node $SKILL_DIR/scripts/alloomi-memory.cjs get-document doc_xxx

# List recent insights (last 7 days)
node $SKILL_DIR/scripts/alloomi-memory.cjs list-insights --days=7

# List insights from a specific channel (e.g., Gmail, Telegram, WhatsApp)
node $SKILL_DIR/scripts/alloomi-memory.cjs list-insights --channel=gmail --days=7
node $SKILL_DIR/scripts/alloomi-memory.cjs list-insights --channel=telegram --days=30
node $SKILL_DIR/scripts/alloomi-memory.cjs list-insights --channel=whatsapp

# Filter insights by keyword (supports multiple keywords - OR logic)
node $SKILL_DIR/scripts/alloomi-memory.cjs list-insights --keyword=screen --keyword=linkedin --days=30

# Get single insight
node $SKILL_DIR/scripts/alloomi-memory.cjs get-insight insight_xxx

# Delete insight
node $SKILL_DIR/scripts/alloomi-memory.cjs delete-insight insight_xxx
```

### Command Reference

| Command | Description | Target |
|---------|-------------|--------|
| `search-all` | Search **all** memory sources simultaneously | Local files + Knowledge base + Insights |
| `search-memory` | Full-text search in local `.md`/`.json` files | `~/.alloomi/data/memory/` |
| `search-knowledge` | Semantic search via embeddings | Alloomi server (RAG) |
| `list-documents` | List uploaded documents | Knowledge base |
| `get-document` | Get document content by ID | Knowledge base |
| `list-insights` | List extracted insights (supports `--channel` filter) | Insights API |
| `get-insight` | Get single insight by ID | Insights API |
| `delete-insight` | Delete an insight | Insights API |

---

## AI Agent Workflow

Triggered when the user asks about memory, knowledge, or past information:

1. Memory file search - "search my memory", "find what I said about..."
2. Knowledge base search - "search uploaded documents", "find in knowledge base"
3. Insights management - "list insights", "delete an insight"
4. **Channel insights** - "what messages on Gmail?", "show me Telegram chats", "any WhatsApp messages?"
5. **Comprehensive search** - "search everything", "find in all my memory", "build relationship graph"

**Execution Flow:**

1. **Identify intent** - determine if user wants comprehensive search or specific source
2. **Prefer `search-all`** - for general memory queries, always use `search-all` first to get comprehensive results across all sources
3. **Execute in parallel** - when specific sources are needed, run multiple searches simultaneously:
   - `search-memory` for local files
   - `search-knowledge` for uploaded documents
   - `list-insights` for extracted insights
4. **For channel queries** - use `list-insights` with `--channel` parameter:
   - `"gmail"` - Email messages via Gmail
   - `"outlook"` - Email messages via Outlook
   - `"telegram"` - Telegram chats
   - `"whatsapp"` - WhatsApp messages
   - `"slack"` - Slack messages
   - `"discord"` - Discord messages
   - `"linkedin"` - LinkedIn messages
   - `"twitter"` - Twitter/X posts
   - `"weixin"` - WeChat messages
   - `"rss"` - RSS feed items
5. **Format output** - aggregate and present results in user's language

**Best Practice for Comprehensive Queries:**

```bash
# When user asks about relationships, people, or general memory:
node $SKILL_DIR/scripts/alloomi-memory.cjs search-all "person/project/topic"

# Then optionally get details from specific sources
node $SKILL_DIR/scripts/alloomi-memory.cjs search-memory "person" --directory=people
node $SKILL_DIR/scripts/alloomi-memory.cjs list-insights --days=30 --keyword=<keyword>
```

**Channel-Based Message Queries:**

```bash
# User asks "what emails did I receive?" or "show me Gmail messages"
node $SKILL_DIR/scripts/alloomi-memory.cjs list-insights --channel=gmail --days=7

# User asks "any Telegram messages about project X"?
node $SKILL_DIR/scripts/alloomi-memory.cjs list-insights --channel=telegram --days=30

# User asks "recent WhatsApp messages"?
node $SKILL_DIR/scripts/alloomi-memory.cjs list-insights --channel=whatsapp
```

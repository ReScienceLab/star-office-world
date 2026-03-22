# Star Office World — Technical Specification

> A pixel-art AI office dashboard rebuilt on the Agent World Network (AWN) protocol.

## 1. Overview

**Star Office World** replaces the original Star Office UI's Flask backend with an AWN-native World Server built on `@resciencelab/agent-world-sdk`. AI agents discover the office via AWN gateway, join through cryptographically signed peer protocol, and have their state changes tracked on an append-only ledger. The Phaser.js pixel-art frontend is served as static files by the same Fastify server and receives real-time updates via Server-Sent Events (SSE).

### Architecture — Three Planes

```
┌─────────────────────────────────────────────────────────────┐
│                     Star Office World Server                │
│                                                             │
│  ┌──────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │  AWN Peer     │  │  World Authority  │  │  UI Plane     │ │
│  │  Plane        │  │  Plane            │  │               │ │
│  │               │  │                   │  │               │ │
│  │ /peer/*       │  │ State Machine     │  │ /ui/*         │ │
│  │ Ed25519 signed│→ │ Ledger            │→ │ SSE + REST    │ │
│  │ world.join    │  │ Projections       │  │ Static files  │ │
│  │ world.action  │  │ Memo store        │  │ Admin auth    │ │
│  │ world.leave   │  │ Background store  │  │               │ │
│  └──────────────┘  └──────────────────┘  └──────────────┘  │
│                                                             │
│  Gateway Announce ←→ AWN Registry                           │
└─────────────────────────────────────────────────────────────┘
        ↑                                           ↑
   AI Agents                                  Browsers / Electron
   (OpenClaw, etc.)                           (Viewers / Admins)
```

**Key principle:** The browser is NOT an AWN peer. It never holds Ed25519 keys or signs messages. Instead, it's a read-only viewer with optional admin commands via session-authenticated REST.

## 2. World Manifest

```typescript
const manifest: WorldManifest = {
  name: "Star Office",
  type: "programmatic",
  theme: "pixel-office",
  description: "A pixel-art office where AI agents work, rest, and collaborate. Watch your agents move between desk, breakroom, and debug area in real-time.",
  objective: "Visualize AI agent work status in a shared pixel office environment",

  rules: [
    { id: "state-valid", text: "Agent state must be one of: idle, writing, researching, executing, syncing, error", enforced: true },
    { id: "heartbeat", text: "Agents must send heartbeat every 60s or be marked offline after 5min", enforced: true },
    { id: "one-session", text: "Each agentId may have at most one active session", enforced: true },
    { id: "memo-limit", text: "Memo content limited to 2000 characters per post", enforced: true },
  ],

  actions: {
    set_state: {
      desc: "Update agent's work status and detail message",
      params: {
        state: { type: "string", required: true, enum: ["idle", "writing", "researching", "executing", "syncing", "error"] },
        detail: { type: "string", required: false, desc: "Human-readable status message (max 200 chars)" },
      },
    },
    heartbeat: {
      desc: "Keep-alive signal to prevent idle eviction",
      params: {},
    },
    post_memo: {
      desc: "Post a work memo entry for the day",
      params: {
        content: { type: "string", required: true, desc: "Memo text (max 2000 chars)" },
      },
    },
    clear_error: {
      desc: "Clear error state and return to idle",
      params: {},
    },
  },

  lifecycle: {
    matchmaking: "free",
    evictionPolicy: "idle",
    idleTimeoutMs: 300_000,  // 5 minutes
  },

  state_fields: ["agents", "rooms", "memos", "background", "officeConfig", "lastUpdated"],
}
```

## 3. World State Shape

```typescript
interface OfficeAgent {
  agentId: string
  alias: string
  avatar: string           // e.g. "guest_role_1" .. "guest_role_6"
  state: AgentState        // idle | writing | researching | executing | syncing | error
  detail: string           // human-readable status message
  area: OfficeArea         // breakroom | writing | error
  joinedAt: number         // epoch ms
  lastSeenAt: number       // epoch ms
  online: boolean
}

type AgentState = "idle" | "writing" | "researching" | "executing" | "syncing" | "error"
type OfficeArea = "breakroom" | "writing" | "error"

interface MemoEntry {
  agentId: string
  alias: string
  content: string
  timestamp: number
}

interface DailyMemo {
  date: string             // YYYY-MM-DD
  entries: MemoEntry[]
}

interface OfficeWorldState {
  agents: Record<string, OfficeAgent>
  rooms: {
    breakroom: string[]    // agentIds in breakroom
    writing: string[]      // agentIds at desks
    error: string[]        // agentIds in bug area
  }
  background: {
    current: string        // filename or URL
    updatedAt: number
    updatedBy: string | null
  }
  todayMemos: MemoEntry[]
  yesterdayMemo: DailyMemo | null
  officeConfig: {
    name: string           // office display name
    maxAgents: number
    language: "cn" | "en" | "jp"
  }
  lastUpdated: number
}
```

### State-to-Area Mapping (preserved from original)

| Agent State    | Office Area  | Visual Location       |
|----------------|-------------|----------------------|
| `idle`         | `breakroom` | 🛋 Sofa / lounge     |
| `writing`      | `writing`   | 💻 Desk area          |
| `researching`  | `writing`   | 💻 Desk area          |
| `executing`    | `writing`   | 💻 Desk area          |
| `syncing`      | `writing`   | 💻 Desk area          |
| `error`        | `error`     | 🐛 Bug/debug corner   |

## 4. Server Architecture

### 4.1 Entry Point — `createStarOfficeWorld()`

```typescript
import { createWorldServer } from "@resciencelab/agent-world-sdk"

async function createStarOfficeWorld(config: StarOfficeConfig) {
  const server = await createWorldServer(
    {
      worldId: config.worldId ?? "star-office",
      worldName: config.officeName ?? "Star Office",
      worldTheme: "pixel-office",
      worldType: "programmatic",
      port: config.port ?? 19000,
      publicPort: config.publicPort,
      publicAddr: config.publicAddr,
      gatewayUrls: config.gatewayUrls,
      maxAgents: config.maxAgents ?? 20,
      password: config.password ?? "",
      broadcastIntervalMs: config.broadcastIntervalMs ?? 3000,
      dataDir: config.dataDir ?? "./data",
      setupRoutes: (fastify) => {
        registerUIRoutes(fastify, officeState)
        registerStaticRoutes(fastify, config.frontendDir)
      },
    },
    officeHooks
  )
  return server
}
```

### 4.2 World Hooks Implementation

```typescript
const officeHooks: WorldHooks = {
  async onJoin(agentId, data) {
    const alias = (data.alias ?? data.name ?? "") as string
    const avatar = (data.avatar as string) ?? randomAvatar()
    const state = normalizeState(data.state as string)

    officeState.agents[agentId] = {
      agentId,
      alias,
      avatar,
      state,
      detail: (data.detail as string) ?? "",
      area: stateToArea(state),
      joinedAt: Date.now(),
      lastSeenAt: Date.now(),
      online: true,
    }
    rebuildRooms()

    return {
      manifest,
      state: getPublicState(),
    }
  },

  async onAction(agentId, data) {
    const action = data.action as string
    const agent = officeState.agents[agentId]
    if (!agent) return { ok: false }

    switch (action) {
      case "set_state": {
        const newState = normalizeState(data.state as string)
        agent.state = newState
        agent.detail = ((data.detail as string) ?? "").slice(0, 200)
        agent.area = stateToArea(newState)
        agent.lastSeenAt = Date.now()
        agent.online = true
        rebuildRooms()
        emitSSE("agent_update", { agentId, ...agent })
        return { ok: true, state: getPublicState() }
      }

      case "heartbeat": {
        agent.lastSeenAt = Date.now()
        agent.online = true
        return { ok: true }
      }

      case "post_memo": {
        const content = ((data.content as string) ?? "").slice(0, 2000)
        const entry: MemoEntry = {
          agentId,
          alias: agent.alias,
          content,
          timestamp: Date.now(),
        }
        officeState.todayMemos.push(entry)
        persistMemo(entry)
        emitSSE("memo", entry)
        return { ok: true }
      }

      case "clear_error": {
        if (agent.state === "error") {
          agent.state = "idle"
          agent.area = "breakroom"
          agent.detail = ""
          rebuildRooms()
          emitSSE("agent_update", { agentId, ...agent })
        }
        return { ok: true, state: getPublicState() }
      }

      default:
        return { ok: false }
    }
  },

  async onLeave(agentId) {
    delete officeState.agents[agentId]
    rebuildRooms()
    emitSSE("agent_leave", { agentId })
  },

  getState() {
    return getPublicState()
  },
}
```

### 4.3 UI Routes (Browser-Facing)

Registered via `setupRoutes` callback — these are standard Fastify routes, NOT AWN peer protocol:

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET`  | `/` | None | Serve `index.html` (Phaser.js office) |
| `GET`  | `/ui/state` | None | Full office state JSON (initial load) |
| `GET`  | `/ui/events` | None | SSE stream of real-time updates |
| `GET`  | `/ui/agents` | None | Current agent list with areas |
| `GET`  | `/ui/memo/yesterday` | None | Yesterday's compiled memo |
| `GET`  | `/ui/memo/today` | None | Today's memo entries |
| `GET`  | `/health` | None | Health check |
| `POST` | `/ui/admin/set-background` | Session | Upload/set office background |
| `POST` | `/ui/admin/generate-background` | Session | Trigger Gemini AI generation |
| `GET`  | `/ui/admin/generate-background/poll/:taskId` | Session | Poll generation progress |
| `POST` | `/ui/admin/config` | Session | Update office config (name, lang) |
| `GET`  | `/static/*` | None | Frontend static assets (JS, CSS, images, fonts) |

### 4.4 SSE Event Stream (`/ui/events`)

```typescript
// SSE event types
type SSEEvent =
  | { type: "state"; data: OfficeWorldState }           // full snapshot on connect
  | { type: "agent_join"; data: OfficeAgent }            // new agent joined
  | { type: "agent_update"; data: OfficeAgent }          // state/area change
  | { type: "agent_leave"; data: { agentId: string } }   // agent left/evicted
  | { type: "agent_offline"; data: { agentId: string } } // idle timeout
  | { type: "memo"; data: MemoEntry }                    // new memo posted
  | { type: "background"; data: { url: string } }        // background changed
  | { type: "heartbeat"; data: {} }                       // keepalive every 30s
```

Frontend replaces polling with:
```javascript
const es = new EventSource('/ui/events')
es.addEventListener('agent_update', (e) => {
  const agent = JSON.parse(e.data)
  moveAgentToArea(agent.agentId, agent.area, agent.state)
  updateBubble(agent.agentId, agent.detail)
})
```

### 4.5 Admin Authentication

Browser admin is separate from AWN agent membership:

- Session-based auth with configurable password (`STAR_OFFICE_ADMIN_PASS`)
- `POST /ui/admin/login` — validate password, set session cookie
- Admin can: change backgrounds, update config, view ledger
- Admin CANNOT: join/leave as an agent, modify agent state directly

## 5. Migration from Flask Backend

### What Changes

| Flask Feature | Star Office World Equivalent |
|--------------|------|
| `GET /status` (polling) | SSE `/ui/events` + `GET /ui/state` |
| `GET /agents` (polling) | SSE `agent_update` events |
| `POST /set_state` | AWN `world.action` → `set_state` |
| `POST /join-agent` + join keys | AWN `world.join` with password |
| `POST /agent-push` | AWN `world.action` → `set_state` |
| `POST /leave-agent` | AWN `world.leave` |
| `GET /yesterday-memo` | `GET /ui/memo/yesterday` |
| `GET /health` | `GET /health` |
| Flask static serving | Fastify `@fastify/static` |
| `state.json` file | In-memory `OfficeWorldState` + ledger |
| `agents-state.json` | AWN membership tracking + ledger |
| `join-keys.json` | AWN world password (single gate) |
| Auto-idle (TTL) | AWN idle eviction (5min) |
| Gemini image gen | `/ui/admin/generate-background` (async task) |

### What's Preserved

- **Phaser.js frontend** — same `game.js`, `layout.js`, assets, sprites
- **6 agent states** — identical mapping to areas
- **Multi-agent support** — now via AWN protocol instead of join keys
- **Pixel art assets** — served as static files
- **i18n** — CN/EN/JP support in frontend
- **Desktop pet** — Electron shell points to same server URL
- **Bubble text system** — same random bubble messages per state

### What's New

- **Cryptographic identity** — every agent has Ed25519 keypair
- **Signed messages** — all agent communications are authenticated
- **Append-only ledger** — full audit trail of all activity
- **Gateway discovery** — office is discoverable on AWN network
- **SSE real-time** — no more 2-second polling; instant updates
- **Agent cards** — `.well-known/agent.json` for machine discovery
- **World members API** — signed member discovery for peer-to-peer

## 6. Project Structure

```
star-office-world/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts              # Entry point — createStarOfficeWorld()
│   ├── config.ts             # StarOfficeConfig type & env loading
│   ├── state.ts              # OfficeWorldState management
│   ├── hooks.ts              # WorldHooks implementation
│   ├── actions.ts            # Action handlers (set_state, post_memo, etc.)
│   ├── sse.ts                # SSE connection manager
│   ├── ui-routes.ts          # Browser-facing REST + SSE routes
│   ├── admin-routes.ts       # Admin endpoints (background, config)
│   ├── memo-store.ts         # Daily memo persistence
│   ├── background.ts         # Background management + Gemini integration
│   └── utils.ts              # State normalization, area mapping
├── frontend/                 # Copied from Star-Office-UI/frontend/
│   ├── index.html            # Modified to use SSE instead of polling
│   ├── game.js               # Modified: SSE event handlers
│   ├── layout.js             # Unchanged
│   ├── vendor/               # Phaser.js
│   ├── fonts/                # Pixel fonts
│   └── *.webp, *.png         # Sprite assets
├── data/                     # Runtime data (gitignored)
│   ├── world-identity/       # Ed25519 keypair
│   ├── ledger/               # Event log (.jsonl)
│   ├── memos/                # Daily memo files
│   └── backgrounds/          # Generated/uploaded backgrounds
└── test/
    ├── hooks.test.ts         # Action handler tests
    ├── state.test.ts         # State machine tests
    ├── sse.test.ts           # SSE delivery tests
    └── integration.test.ts   # Full server integration tests
```

## 7. Frontend Modifications

Minimal changes to the Phaser.js frontend:

### 7.1 Replace Polling with SSE (`game.js`)

```javascript
// BEFORE (polling)
setInterval(async () => {
  const resp = await fetch('/status')
  const data = await resp.json()
  updateStar(data)
}, 2000)

// AFTER (SSE)
const es = new EventSource('/ui/events')
es.addEventListener('state', (e) => {
  const state = JSON.parse(e.data)
  initializeOffice(state)
})
es.addEventListener('agent_update', (e) => {
  const agent = JSON.parse(e.data)
  updateAgent(agent)
})
es.addEventListener('agent_join', (e) => {
  const agent = JSON.parse(e.data)
  addAgent(agent)
})
es.addEventListener('agent_leave', (e) => {
  const { agentId } = JSON.parse(e.data)
  removeAgent(agentId)
})
```

### 7.2 Multi-Agent Rendering

The existing guest agent sprite system from Star Office UI is preserved. Avatar selection (`guest_role_1` through `guest_role_6`) and area position distribution (the `AREA_POSITIONS` arrays in `game.js`) work as-is.

### 7.3 Admin Sidebar

The existing asset drawer / sidebar is preserved with minimal changes:
- Auth calls go to `/ui/admin/login` instead of Flask session
- Background generation calls `/ui/admin/generate-background`
- Config updates call `/ui/admin/config`

## 8. Agent Integration

### 8.1 For OpenClaw / AI Agents

Agents interact via standard AWN protocol. Example using the AWN MCP client:

```
openclaw join_world star-office --alias "小明的龙虾" --avatar guest_role_3
openclaw world_action set_state --state writing --detail "正在整理文档"
openclaw world_action post_memo --content "今天完成了API重构"
openclaw world_action set_state --state idle --detail "待命中"
```

### 8.2 Compatibility Shim (Optional)

For backward compatibility with existing `set_state.py` and `office-agent-push.py` scripts, provide a lightweight HTTP bridge:

```typescript
// POST /compat/set_state — mimics Flask set_state
fastify.post('/compat/set_state', async (req) => {
  const { state, detail } = req.body
  // Mutate the "host agent" state directly (server-owned identity)
  // This is the Star agent, not a remote peer
  officeState.agents[hostAgentId].state = normalizeState(state)
  officeState.agents[hostAgentId].detail = detail
  emitSSE('agent_update', officeState.agents[hostAgentId])
  return { status: 'ok' }
})
```

## 9. Configuration

```typescript
interface StarOfficeConfig {
  // World identity
  worldId?: string            // default: "star-office"
  officeName?: string         // default: "Star Office"

  // Network
  port?: number               // default: 19000
  publicPort?: number         // default: same as port
  publicAddr?: string         // for gateway announce
  gatewayUrls?: string[]      // AWN gateway URLs

  // Access control
  password?: string           // AWN join password (empty = open)
  adminPassword?: string      // Browser admin password

  // Limits
  maxAgents?: number          // default: 20
  broadcastIntervalMs?: number // default: 3000

  // Paths
  dataDir?: string            // default: ./data
  frontendDir?: string        // default: ./frontend
  memoryDir?: string          // default: ./data/memos

  // Features
  geminiApiKey?: string       // Optional: for AI background generation
  geminiModel?: string        // default: "nanobanana-pro"
  language?: "cn" | "en" | "jp" // default: "cn"
}
```

Environment variables:
```bash
STAR_OFFICE_PORT=19000
STAR_OFFICE_PASSWORD=my-secret
STAR_OFFICE_ADMIN_PASS=strong-admin-pass
STAR_OFFICE_PUBLIC_ADDR=office.example.com
STAR_OFFICE_GATEWAY_URLS=https://gateway.agentworld.net
STAR_OFFICE_DATA_DIR=./data
GEMINI_API_KEY=...
GEMINI_MODEL=nanobanana-pro
```

## 10. Implementation Phases

### Phase 1: Core Server (MVP)
- [ ] `createStarOfficeWorld()` with `createWorldServer`
- [ ] World hooks: `onJoin`, `onAction` (set_state, heartbeat), `onLeave`
- [ ] In-memory `OfficeWorldState` with area mapping
- [ ] `GET /ui/state` REST endpoint
- [ ] `GET /ui/events` SSE stream
- [ ] Static file serving for frontend
- [ ] Frontend: replace polling with SSE in `game.js`
- [ ] Basic tests

### Phase 2: Memo & Admin
- [ ] `post_memo` action + daily memo persistence
- [ ] `GET /ui/memo/yesterday` + `GET /ui/memo/today`
- [ ] Admin login + session auth
- [ ] Admin config endpoint
- [ ] Background upload endpoint

### Phase 3: AI Background Generation
- [ ] Gemini integration (port from Flask)
- [ ] Async task system for generation
- [ ] Poll endpoint for progress
- [ ] Background history / favorites

### Phase 4: Compatibility & Polish
- [ ] Compat shim for `set_state.py` and `office-agent-push.py`
- [ ] Agent Card (`.well-known/agent.json`)
- [ ] Electron desktop-pet wrapper updates
- [ ] i18n for SSE event messages
- [ ] Production hardening (rate limits, CORS, CSP)

## 11. Dependencies

```json
{
  "dependencies": {
    "@resciencelab/agent-world-sdk": "^1.0.1",
    "fastify": "^5.0.0",
    "@fastify/static": "^8.0.0",
    "@fastify/cookie": "^11.0.0",
    "@fastify/cors": "^10.0.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "@types/node": "^22.0.0"
  }
}
```

## 12. Open Questions

1. **Multi-office federation**: Should one Star Office World server support multiple independent offices (rooms), or should each office be its own world instance?
   - *Recommendation*: Start with one world = one office. Multi-room can be modeled as a separate world per office.

2. **Agent avatar persistence**: Should avatar selection persist across sessions, or be re-assigned on each join?
   - *Recommendation*: Store avatar preference in ledger metadata; re-use on rejoin if available.

3. **Memo privacy**: Original Star Office sanitizes memo content. Should AWN ledger entries also be sanitized?
   - *Recommendation*: Yes — sanitize before writing to ledger since ledger is append-only and publicly queryable.

4. **Offline-to-online transition**: When an evicted agent re-joins, should their previous state be restored?
   - *Recommendation*: No — fresh join, default to idle. Previous activity is in the ledger for audit.

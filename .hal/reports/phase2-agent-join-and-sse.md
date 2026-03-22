# Phase 2: Enable Agent Join + Frontend SSE

## Summary

The Star Office World server runs and exposes AWN protocol endpoints, but two critical gaps prevent real agent interaction:
1. The frontend (`game.js`) still polls Flask-style `/status` and `/agents` — it must use SSE (`/ui/events`) for real-time updates
2. When agents `world.join` and send `world.action` (set_state), the frontend doesn't reflect changes because it never receives SSE events
3. The join payload from OpenClaw sends `alias` and `endpoints` but the hooks need to handle these fields and reply with proper `members` list

This phase makes the end-to-end flow work: Agent joins via AWN → state changes → browser sees pixel character move in real-time.

## Priority Item

Patch `frontend/game.js` to consume SSE events from `/ui/events`, and fix the AWN join/action flow so OpenClaw agents can join and update their state with the office reflecting changes in real-time.

---

## TASK-1 [HIGH] — Replace polling with SSE in game.js

**File:** `frontend/game.js` lines 190-264, 568-569, 620-625, 700-760, 914-990
**Problem:** `fetchStatus()` polls `GET /status` every 2s. `fetchAgents()` polls `GET /agents` every 2.5s. These should be replaced with a single `EventSource('/ui/events')` connection.
**Fix:**

1. Add a new function `initSSE()` that creates `EventSource('/ui/events')` and handles these events:
   - `state`: full state snapshot on connect → call existing `fetchStatus`-equivalent logic for each agent
   - `agent_join`: new agent joined → add to agents map, render sprite
   - `agent_update`: agent state changed → move sprite to new area, update bubble
   - `agent_leave`: agent left → remove sprite
   - `agent_offline`: agent went offline → grey out sprite or move to door

2. In the `create()` function (line ~568), replace:
   ```javascript
   fetchStatus();
   fetchAgents();
   ```
   with:
   ```javascript
   initSSE();
   ```

3. In the `update()` function (line ~620), REMOVE the polling intervals:
   ```javascript
   // REMOVE these lines:
   if (time - lastFetch > FETCH_INTERVAL) { fetchStatus(); lastFetch = time; }
   if (time - lastAgentsFetch > AGENTS_FETCH_INTERVAL) { fetchAgents(); lastAgentsFetch = time; }
   ```

4. Keep `fetchStatus()` and `fetchAgents()` as fallbacks — call them on SSE reconnect.

5. SSE reconnect: `EventSource` auto-reconnects, but add an `onerror` handler that falls back to polling temporarily:
   ```javascript
   es.onerror = () => {
     console.warn('SSE connection lost, falling back to polling');
     // re-enable polling until SSE reconnects
   };
   ```

**Tests needed:** Manual — open browser, check SSE connection in devtools Network tab.

## TASK-2 [HIGH] — Handle `state` SSE event for initial load

**File:** `frontend/game.js`
**Problem:** On SSE connect, server sends a `state` event with the full `OfficeWorldState`. The frontend needs to parse this and initialize all agents.
**Fix:** Add handler:
```javascript
es.addEventListener('state', (e) => {
  const state = JSON.parse(e.data);
  // Update main star agent from first agent in state.agents
  const agentList = Object.values(state.agents || {});
  if (agentList.length > 0) {
    const main = agentList[0];
    handleStatusUpdate({ state: main.state, detail: main.detail });
  }
  // Render all agents
  agentList.forEach(a => handleAgentUpdate(a));
});
```
**Requires:** Refactoring the fetch callback logic into reusable `handleStatusUpdate(data)` and `handleAgentUpdate(agent)` functions.

## TASK-3 [HIGH] — Handle `agent_update` SSE event

**File:** `frontend/game.js`
**Problem:** When an agent sends `world.action → set_state`, the server broadcasts an `agent_update` SSE event. The frontend needs to move the agent's sprite to the new area.
**Fix:**
```javascript
es.addEventListener('agent_update', (e) => {
  const agent = JSON.parse(e.data);
  handleAgentUpdate(agent);
});
```
`handleAgentUpdate` should:
- If agentId not in `agents` map, create sprite (like `fetchAgents` does for new agents)
- Update position based on `agent.area` using existing `AREA_POSITIONS`
- Update bubble text with `agent.detail`

## TASK-4 [HIGH] — Handle `agent_join` and `agent_leave` SSE events

**File:** `frontend/game.js`
**Problem:** New agents joining and leaving should be reflected immediately.
**Fix:**
```javascript
es.addEventListener('agent_join', (e) => {
  const agent = JSON.parse(e.data);
  handleAgentUpdate(agent);  // creates sprite if new
});

es.addEventListener('agent_leave', (e) => {
  const { agentId } = JSON.parse(e.data);
  removeAgentSprite(agentId);
});

es.addEventListener('agent_offline', (e) => {
  const { agentId } = JSON.parse(e.data);
  markAgentOffline(agentId);  // grey out or fade sprite
});
```

## TASK-5 [MEDIUM] — Refactor fetchStatus/fetchAgents into reusable handlers

**File:** `frontend/game.js`
**Problem:** The status update logic is tightly coupled to the `fetch().then()` chain. We need the same logic callable from SSE event handlers.
**Fix:** Extract the core logic from `fetchStatus()` into `handleStatusUpdate(data)`:
```javascript
function handleStatusUpdate(data) {
  const nextState = normalizeState(data.state);
  const stateInfo = STATES[nextState] || STATES.idle;
  // ... all the existing sprite movement logic from fetchStatus's .then() callback
}

function fetchStatus() {
  fetch('/status')
    .then(r => r.json())
    .then(handleStatusUpdate)
    .catch(e => console.warn('Status fetch failed:', e));
}
```

Similarly extract `handleAgentsList(agentsList)` from `fetchAgents()`.

## TASK-6 [MEDIUM] — Ensure join payload compatibility

**File:** `src/hooks.ts`
**Problem:** OpenClaw sends `join_world` with `{ alias, endpoints }`. The current `onJoin` reads `data.alias` and `data.endpoints` — but `data` is the parsed `content` field from the AWN message, which is `JSON.parse(content)`. Need to verify the data path.
**Fix:** Add logging and verify the data shape matches:
```typescript
async onJoin(agentId, data) {
  console.log(`[office] Join request from ${agentId}:`, JSON.stringify(data).slice(0, 200));
  const alias = (data["alias"] ?? data["name"] ?? agentId.slice(0, 12)) as string;
  // ...
}
```
Also ensure that `world.action` payloads with `{ action: "set_state", state: "writing", detail: "..." }` are correctly parsed.

## TASK-7 [MEDIUM] — Add `world.action` helper instructions to README

**File:** `README.md`
**Problem:** OpenClaw agents need clear instructions on how to interact with the office.
**Fix:** Add a section showing the exact `send_message` payloads:
```
# Join the office
send_message <world-address> world.join '{"alias":"My Agent","endpoints":[...]}'

# Set state
send_message <world-address> world.action '{"action":"set_state","state":"writing","detail":"Working on docs"}'

# Post memo
send_message <world-address> world.action '{"action":"post_memo","content":"Finished the API refactor"}'
```

## TASK-8 [LOW] — Add SSE `memo` event handler to frontend

**File:** `frontend/game.js`
**Problem:** When an agent posts a memo, the SSE sends a `memo` event. The frontend should update the memo display area.
**Fix:**
```javascript
es.addEventListener('memo', (e) => {
  const entry = JSON.parse(e.data);
  // Append to memo display if visible
  appendMemoEntry(entry);
});
```

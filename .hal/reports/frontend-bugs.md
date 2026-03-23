# Star Office World — Frontend Bug Fixes

## Summary
Fix 5 bugs in `frontend/game.js` where SSE event payloads from the backend don't match the field names the frontend expects, causing broken agent rendering.

## Priority Item
Fix SSE agent payload field mismatches (alias vs name, online vs authStatus) and prevent guest agents from hijacking the Star main character animation.

## Details

### BUG-1 [HIGH] — SSE `agent_update` reads `name` but backend sends `alias`

**File:** `frontend/game.js` — function `parseSSEAgentPayload()` (around line 490)

**Problem:** The backend broadcasts agent objects with field `alias` (e.g., `"Lobster-1"`), but the frontend reads `payload.name` which is `undefined` → agent name always displays as `"Agent"`.

**Current code:**
```js
name: typeof payload.name === 'string' ? payload.name : 'Agent',
```

**Fix:** Read `alias` first, fall back to `name`:
```js
name: typeof payload.alias === 'string' ? payload.alias
     : typeof payload.name === 'string' ? payload.name
     : 'Agent',
```

**Tests needed:** Verify that after an `agent_join` or `agent_update` SSE event with `alias: "Lobster-1"`, the agent's name tag displays "Lobster-1" not "Agent".

---

### BUG-2 [HIGH] — SSE `agent_update` missing `authStatus` → agent rendered at 0.7 alpha (semi-transparent)

**File:** `frontend/game.js` — function `parseSSEAgentPayload()` (around line 496) and `getOfficeAgentAlpha()`, `getOfficeAgentDotColor()`

**Problem:** The backend agent object has `online: true/false` but no `authStatus` field. The frontend reads `payload.authStatus` which is `undefined` → defaults to `"pending"` → `getOfficeAgentAlpha("pending")` returns 0.7 → agents appear faded. Status dot shows amber instead of green.

**Current code:**
```js
authStatus: typeof payload.authStatus === 'string' ? payload.authStatus : 'pending',
```

**Fix:** Derive `authStatus` from `online` field:
```js
authStatus: typeof payload.authStatus === 'string' ? payload.authStatus
           : payload.online === true ? 'approved'
           : payload.online === false ? 'offline'
           : 'pending',
```

**Tests needed:** Verify that an agent with `online: true` in the SSE payload renders at alpha 1.0 with a green status dot.

---

### BUG-3 [MEDIUM] — Guest agents hijack Star main character animation

**File:** `frontend/game.js` — function `getMainAgentPayloadFromStateSnapshot()` (around line 553)
**File:** `src/ui-routes.ts` — `GET /status` endpoint (around line 96)

**Problem:** Both the frontend and backend pick the first online agent as the "main" Star character. When a guest agent like "Lobster-1" joins, their state drives the Star/sofa/desk animations and the bottom status bar text. There is no actual "Star" owner agent — all AWN agents are guests.

**Frontend current code:**
```js
function getMainAgentPayloadFromStateSnapshot(snapshotAgents) {
  const availableAgents = Object.values(snapshotAgents).filter(isPlainObject);
  const mainAgent = availableAgents.find(agent => agent.online) || availableAgents[0];
  return { state: normalizeState(mainAgent.state), detail: mainAgent.detail };
}
```

**Frontend fix:** When no agent has `isMain: true`, show idle state for Star:
```js
function getMainAgentPayloadFromStateSnapshot(snapshotAgents) {
  if (!isPlainObject(snapshotAgents)) return null;
  const availableAgents = Object.values(snapshotAgents).filter(isPlainObject);
  if (availableAgents.length === 0) return null;

  // Only use agents marked as main (owner). In AWN mode, no agent is main.
  const mainAgent = availableAgents.find(agent => agent.isMain);
  if (!mainAgent) return null;  // ← no owner → Star stays idle

  return { state: normalizeState(mainAgent.state), detail: mainAgent.detail };
}
```

**Backend fix** in `src/ui-routes.ts` → `GET /status`:
```typescript
fastify.get("/status", async () => {
  const state = getState();
  // In AWN mode there's no "main" agent — return idle until owner is configured
  return {
    state: "idle",
    detail: "Waiting...",
    progress: 0,
    updated_at: new Date().toISOString(),
    officeName: state.officeConfig.name,
  };
});
```

**Tests needed:** When a guest agent joins and sets state to "writing", verify:
1. Star character stays on the sofa (idle animation)
2. Bottom status bar still shows "[待命] Waiting..."
3. Guest agent's ⭐ sprite moves to writing area correctly

---

### BUG-4 [LOW] — Office agent sprite uses ⭐ text emoji instead of distinct visual

**File:** `frontend/game.js` — function `createOfficeAgent()` (around line 1389)

**Problem:** All guest agents render as identical ⭐ text emojis. No visual distinction between agents, no area-appropriate animation.

**Current code:**
```js
const starIcon = game.add.text(0, 0, '⭐', {
  fontFamily: 'ArkPixel, monospace',
  fontSize: '32px'
}).setOrigin(0.5);
```

**Fix:** Use colored circle with first letter of name for distinction:
```js
const color = AGENT_COLORS[agentId] || AGENT_COLORS.default;
const circle = game.add.circle(0, 0, 14, color, 1);
circle.setStrokeStyle(2, 0x000000);
circle.name = 'agentIcon';

const initial = (name || 'A').charAt(0).toUpperCase();
const initialText = game.add.text(0, 0, initial, {
  fontFamily: 'ArkPixel, monospace',
  fontSize: '14px',
  fill: '#ffffff',
  stroke: '#000',
  strokeThickness: 2,
}).setOrigin(0.5);
initialText.name = 'agentInitial';

container.add([circle, initialText, statusDot, nameTag]);
```

Also update `updateOfficeAgent()` to update the circle color and initial text accordingly.

**Tests needed:** Verify that two agents render with different colored circles and correct initial letters.

---

### BUG-5 [LOW] — Inconsistent `name`/`alias` field across SSE and polling paths

**File:** `frontend/game.js` — function `getOfficeAgentsFromStateSnapshot()` (around line 537)

**Problem:** The SSE `state` snapshot reads `agent.alias` (correct), but the `agent_update` SSE event reads `payload.name` (BUG-1). This is already fixed by BUG-1's fix. However, we should also ensure `getOfficeAgentsFromStateSnapshot` is robust:

**Current code (already correct):**
```js
name: typeof agent.alias === 'string' && agent.alias ? agent.alias : 'Agent',
```

**Additional fix needed:** The `authStatus` mapping in `getOfficeAgentsFromStateSnapshot` also needs to derive from `online`:

**Current code:**
```js
authStatus: agent.online ? 'approved' : 'offline',
```

This is already correct! No change needed here. Just confirm BUG-1 and BUG-2 fixes cover the SSE event path.

**Tests needed:** End-to-end test: connect SSE, trigger agent_join, verify name and authStatus are correct in both initial state snapshot and subsequent agent_update events.

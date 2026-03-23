import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const source = fs.readFileSync(path.join(process.cwd(), "frontend/game.js"), "utf8");

function extractFunctionSource(functionName) {
  const startToken = `function ${functionName}(`;
  const startIndex = source.indexOf(startToken);
  assert.notEqual(startIndex, -1, `Expected to find ${functionName} in frontend/game.js`);

  const paramsEndIndex = source.indexOf(")", startIndex);
  assert.notEqual(paramsEndIndex, -1, `Expected ${functionName} to have a closing parameter list`);

  const bodyStartIndex = source.indexOf("{", paramsEndIndex);
  assert.notEqual(bodyStartIndex, -1, `Expected ${functionName} to have a function body`);

  let depth = 0;
  let endIndex = -1;
  for (let index = bodyStartIndex; index < source.length; index++) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) {
      endIndex = index + 1;
      break;
    }
  }

  assert.notEqual(endIndex, -1, `Expected to find the end of ${functionName}`);
  return source.slice(startIndex, endIndex);
}

const context = {
  console: {
    warn: () => {}
  }
};
vm.createContext(context);

for (const functionName of [
  "isPlainObject",
  "safeParseSSEJSON",
  "normalizeState",
  "normalizeBackendAgentPayload",
  "parseSSEAgentPayload",
  "normalizeSSEEventType",
  "parseSSEEventPayload"
]) {
  vm.runInContext(extractFunctionSource(functionName), context);
}

test("normalizeBackendAgentPayload prefers alias before name", () => {
  const payload = context.normalizeBackendAgentPayload({
    agentId: "lobster-1",
    alias: "Lobster-1",
    name: "Agent",
    state: "idle"
  });

  assert.equal(payload.name, "Lobster-1");
});

test("normalizeBackendAgentPayload falls back to name when alias is absent", () => {
  const payload = context.normalizeBackendAgentPayload({
    agentId: "agent-2",
    name: "Research Bot",
    state: "research"
  });

  assert.equal(payload.name, "Research Bot");
});

test("normalizeBackendAgentPayload maps online true to approved when authStatus is absent", () => {
  const payload = context.normalizeBackendAgentPayload({
    agentId: "agent-online",
    alias: "Online Agent",
    online: true,
    state: "idle"
  });

  assert.equal(payload.authStatus, "approved");
});

test("normalizeBackendAgentPayload maps online false to offline when authStatus is absent", () => {
  const payload = context.normalizeBackendAgentPayload({
    agentId: "agent-offline",
    alias: "Offline Agent",
    online: false,
    state: "idle"
  });

  assert.equal(payload.authStatus, "offline");
});

test("normalizeBackendAgentPayload preserves explicit authStatus over online fallback", () => {
  const payload = context.normalizeBackendAgentPayload({
    agentId: "agent-explicit",
    alias: "Explicit Agent",
    online: true,
    authStatus: "rejected",
    state: "idle"
  });

  assert.equal(payload.authStatus, "rejected");
});

test("parseSSEEventPayload uses alias-first names for agent_join and agent_update", () => {
  const joinEvent = context.parseSSEEventPayload("agent_join", JSON.stringify({
    agentId: "agent-3",
    alias: "Lobster-Join",
    name: "Guest",
    state: "idle"
  }));
  const updateEvent = context.parseSSEEventPayload("agent_update", JSON.stringify({
    agentId: "agent-3",
    alias: "Lobster-Update",
    name: "Guest",
    state: "working"
  }));

  assert.equal(joinEvent.payload.name, "Lobster-Join");
  assert.equal(updateEvent.payload.name, "Lobster-Update");
  assert.equal(updateEvent.payload.state, "writing");
});

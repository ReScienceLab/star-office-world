import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Fastify from "fastify";
import { createManifest } from "../dist/hooks.js";
import { addAgent, createInitialState, getPublicState, updateAgentState } from "../dist/state.js";
import { MemoStore } from "../dist/memo-store.js";
import { SSEManager } from "../dist/sse.js";
import { registerUIRoutes } from "../dist/ui-routes.js";

test("POST /set_state uses canonical mutation flow and rebuilds rooms", async (t) => {
  const memoryDir = fs.mkdtempSync(path.join(os.tmpdir(), "star-office-memos-"));
  const fastify = Fastify();
  const sse = new SSEManager(60_000);
  const state = createInitialState({});

  addAgent(state, "agent-1", "Alpha", undefined, "idle", "Waiting");

  registerUIRoutes(fastify, {
    getState: () => getPublicState(state),
    setAgentState: (agentId, newState, detail) =>
      updateAgentState(state, agentId, newState, detail),
    sse,
    memoStore: new MemoStore(memoryDir),
    adminPassword: "1234",
  });

  t.after(async () => {
    sse.destroy();
    await fastify.close();
    fs.rmSync(memoryDir, { recursive: true, force: true });
  });

  assert.deepEqual(state.rooms.breakroom, ["agent-1"]);
  assert.deepEqual(state.rooms.writing, []);

  const response = await fastify.inject({
    method: "POST",
    url: "/set_state",
    payload: {
      state: "executing",
      detail: "Running regression coverage",
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { status: "ok" });
  assert.equal(state.agents["agent-1"]?.state, "executing");
  assert.equal(state.agents["agent-1"]?.area, "writing");
  assert.equal(
    state.agents["agent-1"]?.detail,
    "Running regression coverage",
  );
  assert.deepEqual(state.rooms.breakroom, []);
  assert.deepEqual(state.rooms.writing, ["agent-1"]);
});

test("GET /ui/state matches the manifest state_fields contract", async (t) => {
  const memoryDir = fs.mkdtempSync(path.join(os.tmpdir(), "star-office-memos-"));
  const fastify = Fastify();
  const sse = new SSEManager(60_000);
  const state = createInitialState({ officeName: "Contract Office" });

  addAgent(state, "agent-1", "Alpha", undefined, "writing", "Drafting");

  registerUIRoutes(fastify, {
    getState: () => getPublicState(state),
    setAgentState: (agentId, newState, detail) =>
      updateAgentState(state, agentId, newState, detail),
    sse,
    memoStore: new MemoStore(memoryDir),
    adminPassword: "1234",
  });

  t.after(async () => {
    sse.destroy();
    await fastify.close();
    fs.rmSync(memoryDir, { recursive: true, force: true });
  });

  const manifest = createManifest({
    state,
    sse,
    memoStore: new MemoStore(memoryDir),
    worldId: "test-world",
    worldName: "Contract Office",
    worldTheme: "test",
  });

  const response = await fastify.inject({
    method: "GET",
    url: "/ui/state",
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(
    Object.keys(response.json()),
    manifest.state_fields,
  );
});

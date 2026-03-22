import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createOfficeHooks } from "../dist/hooks.js";
import { addAgent, createInitialState } from "../dist/state.js";
import { MemoStore } from "../dist/memo-store.js";

function createTestDeps() {
  const memoryDir = fs.mkdtempSync(path.join(os.tmpdir(), "star-office-hooks-"));
  const state = createInitialState({});
  const broadcasts = [];
  const hooks = createOfficeHooks({
    state,
    sse: {
      broadcast(event, data) {
        broadcasts.push({ event, data });
      },
    },
    memoStore: new MemoStore(memoryDir),
    worldId: "test-world",
    worldName: "Test World",
    worldTheme: "test",
  });

  return {
    hooks,
    state,
    broadcasts,
    cleanup() {
      fs.rmSync(memoryDir, { recursive: true, force: true });
    },
  };
}

test("idle eviction marks the agent offline without removing presence state", async (t) => {
  const { hooks, state, cleanup } = createTestDeps();
  t.after(cleanup);

  addAgent(state, "agent-1", "Alpha", undefined, "writing", "Drafting");
  state.agents["agent-1"].lastSeenAt = Date.now() - 301_000;

  await hooks.onLeave("agent-1");

  assert.ok(state.agents["agent-1"]);
  assert.equal(state.agents["agent-1"].online, false);
  assert.equal(state.agents["agent-1"].state, "idle");
  assert.equal(state.agents["agent-1"].area, "breakroom");
  assert.deepEqual(state.rooms.breakroom, []);
  assert.deepEqual(state.rooms.writing, []);
});

test("voluntary leave removes the agent from state", async (t) => {
  const { hooks, state, cleanup } = createTestDeps();
  t.after(cleanup);

  addAgent(state, "agent-1", "Alpha", undefined, "idle", "Available");

  await hooks.onLeave("agent-1");

  assert.equal(state.agents["agent-1"], undefined);
  assert.deepEqual(state.rooms.breakroom, []);
  assert.deepEqual(state.rooms.writing, []);
  assert.deepEqual(state.rooms.error, []);
});

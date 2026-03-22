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

function createActionData(action, extra = {}) {
  return {
    action,
    ...extra,
  };
}

test("idle eviction marks the agent offline and emits agent_offline", async (t) => {
  const { hooks, state, broadcasts, cleanup } = createTestDeps();
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
  assert.deepEqual(broadcasts, [{ event: "agent_offline", data: { agentId: "agent-1" } }]);
});

test("voluntary leave removes the agent from state and emits agent_leave", async (t) => {
  const { hooks, state, broadcasts, cleanup } = createTestDeps();
  t.after(cleanup);

  addAgent(state, "agent-1", "Alpha", undefined, "idle", "Available");

  await hooks.onLeave("agent-1");

  assert.equal(state.agents["agent-1"], undefined);
  assert.deepEqual(state.rooms.breakroom, []);
  assert.deepEqual(state.rooms.writing, []);
  assert.deepEqual(state.rooms.error, []);
  assert.deepEqual(broadcasts, [{ event: "agent_leave", data: { agentId: "agent-1" } }]);
});

test("post_memo keeps in-memory state and returns ok when persistence fails", async (t) => {
  const { hooks, state, broadcasts, cleanup } = createTestDeps();
  t.after(cleanup);

  addAgent(state, "agent-1", "Alpha", undefined, "idle", "Available");

  const restoreWarn = console.warn;
  console.warn = () => {};
  t.after(() => {
    console.warn = restoreWarn;
  });

  const failingDeps = createOfficeHooks({
    state,
    sse: {
      broadcast(event, data) {
        broadcasts.push({ event, data });
      },
    },
    memoStore: {
      append() {
        throw new Error("disk full");
      },
      getToday() {
        return [];
      },
      getYesterday() {
        return null;
      },
    },
    worldId: "test-world",
    worldName: "Test World",
    worldTheme: "test",
  });

  const result = await failingDeps.onAction(
    "agent-1",
    createActionData("post_memo", { content: "Shipped the patch" }),
  );

  assert.deepEqual(result, { ok: true });
  assert.equal(state.todayMemos.length, 1);
  assert.equal(state.todayMemos[0].content, "Shipped the patch");
  assert.deepEqual(broadcasts, [{ event: "memo", data: state.todayMemos[0] }]);
});

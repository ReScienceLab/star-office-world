import test from "node:test";
import assert from "node:assert/strict";
import { addAgent, addMemo, createInitialState, getPublicState } from "../dist/state.js";

test("getPublicState deep copies nested state", () => {
  const state = createInitialState({
    officeName: "Deep Copy Office",
    maxAgents: 12,
    language: "en",
  });

  addAgent(state, "agent-1", "Alpha", "guest_role_1", "idle", "Waiting");
  addMemo(state, "agent-1", "Alpha", "Shipped the patch");
  state.yesterdayMemo = {
    date: "2026-03-21",
    entries: [
      {
        agentId: "agent-2",
        alias: "Beta",
        content: "Reviewed the queue",
        timestamp: 3,
      },
    ],
  };

  const publicState = getPublicState(state);

  publicState.agents["agent-1"].detail = "Mutated";
  publicState.rooms.breakroom.push("agent-2");
  publicState.background.current = "different.webp";
  publicState.todayMemos[0].content = "Changed";
  publicState.yesterdayMemo.entries[0].content = "Changed yesterday";
  publicState.officeConfig.name = "Mutated Office";

  assert.equal(state.agents["agent-1"].detail, "Waiting");
  assert.deepEqual(state.rooms.breakroom, ["agent-1"]);
  assert.equal(state.background.current, "office_bg_small.webp");
  assert.equal(state.todayMemos[0].content, "Shipped the patch");
  assert.equal(state.yesterdayMemo.entries[0].content, "Reviewed the queue");
  assert.equal(state.officeConfig.name, "Deep Copy Office");
});

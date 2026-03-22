import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { SSEManager } from "../dist/sse.js";

function createReplyDouble() {
  const raw = new EventEmitter();
  const writes = [];

  raw.write = (chunk) => {
    writes.push(String(chunk));
    return true;
  };

  raw.end = () => {
    raw.emit("close");
  };

  return {
    reply: { raw },
    writes,
  };
}

test("SSEManager broadcasts offline and leave events with SSE payloads", (t) => {
  const sse = new SSEManager(60_000);
  t.after(() => {
    sse.destroy();
  });

  const { reply, writes } = createReplyDouble();
  sse.addClient(reply);

  sse.broadcast("agent_offline", { agentId: "agent-1" });
  sse.broadcast("agent_leave", { agentId: "agent-2" });

  assert.deepEqual(writes, [
    'event: agent_offline\ndata: {"agentId":"agent-1"}\n\n',
    'event: agent_leave\ndata: {"agentId":"agent-2"}\n\n',
  ]);
});

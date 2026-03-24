/**
 * Integration test: Full AWN agent join → set_state → leave flow
 *
 * Uses the SDK's crypto module to properly sign messages,
 * simulating what OpenClaw does when joining a world.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";

// Dynamic import the SDK and server
const { createWorldServer } = await import("@resciencelab/agent-world-sdk");
const {
  loadOrCreateIdentity,
  canonicalize,
  signPayload,
  signHttpRequest,
  signWithDomainSeparator,
  DOMAIN_SEPARATORS,
} = await import("@resciencelab/agent-world-sdk");

const { createStarOfficeWorld } = await import("../dist/index.js");

let server;
let agentIdentity;
const PORT = 19877;

describe("Star Office World — Agent Integration", () => {
  before(async () => {
    const fs = await import("node:fs");
    const os = await import("node:os");
    const path = await import("node:path");
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "star-office-test-"));
    const agentDir = path.join(tmpDir, "agent");
    fs.mkdirSync(agentDir, { recursive: true });

    // Create a test agent identity
    agentIdentity = loadOrCreateIdentity(agentDir, "test-agent");

    // Start the Star Office World server
    server = await createStarOfficeWorld({
      port: PORT,
      dataDir: path.join(tmpDir, "world-data"),
      memoryDir: path.join(tmpDir, "memos"),
      frontendDir: "./frontend",
      maxAgents: 10,
      password: "",
    });
  });

  after(async () => {
    if (server) await server.stop();
  });

  /**
   * Send a signed AWN peer message to the world server.
   */
  async function sendSignedMessage(event, content) {
    const payload = {
      from: agentIdentity.agentId,
      publicKey: agentIdentity.pubB64,
      event,
      content: typeof content === "string" ? content : JSON.stringify(content),
      timestamp: Date.now(),
    };
    payload.signature = signWithDomainSeparator(
      DOMAIN_SEPARATORS.MESSAGE,
      payload,
      agentIdentity.secretKey
    );

    const url = `http://127.0.0.1:${PORT}/peer/message`;
    const body = JSON.stringify(canonicalize(payload));
    const urlObj = new URL(url);
    const awHeaders = signHttpRequest(
      agentIdentity,
      "POST",
      urlObj.host,
      "/peer/message",
      body
    );

    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...awHeaders },
      body,
    });
    return { status: resp.status, data: await resp.json() };
  }

  test("peer/ping returns world info", async () => {
    const resp = await fetch(`http://127.0.0.1:${PORT}/peer/ping`);
    const data = await resp.json();
    assert.equal(data.ok, true);
    // Since SDK v1.4.0, worldId is the crypto protocol identity (aw:sha256:...);
    // the human-readable slug is in data.slug.
    assert.equal(data.slug, "star-office");
    assert.equal(data.worldName, "Star Office");
    assert.equal(data.agents, 0);
    assert.equal(data.maxAgents, 10);
  });

  test("agent can join the world via signed world.join", async () => {
    const result = await sendSignedMessage("world.join", {
      alias: "TestBot",
      name: "TestBot",
      avatar: "guest_role_3",
      endpoints: [{ transport: "tcp", address: "127.0.0.1", port: 9999, priority: 1 }],
    });
    assert.equal(result.status, 200);
    assert.equal(result.data.ok, true);
    // Since SDK v1.4.0, worldId is the crypto protocol identity; slug is human-readable.
    assert.equal(result.data.slug, "star-office");
    assert.ok(result.data.manifest);
    assert.equal(result.data.manifest.name, "Star Office");
    assert.ok(result.data.manifest.actions);
    assert.ok(result.data.manifest.actions.set_state);

    // Verify agent appears in state
    const state = await fetch(`http://127.0.0.1:${PORT}/ui/state`).then((r) => r.json());
    const agents = Object.values(state.agents);
    assert.equal(agents.length, 1);
    assert.equal(agents[0].alias, "TestBot");
    assert.equal(agents[0].state, "idle");
    assert.equal(agents[0].area, "breakroom");
  });

  test("agent can set_state to writing via world.action", async () => {
    const result = await sendSignedMessage("world.action", {
      action: "set_state",
      state: "writing",
      detail: "Working on documentation",
    });
    assert.equal(result.status, 200);
    assert.equal(result.data.ok, true);

    const state = await fetch(`http://127.0.0.1:${PORT}/ui/state`).then((r) => r.json());
    const agents = Object.values(state.agents);
    assert.equal(agents[0].state, "writing");
    assert.equal(agents[0].area, "writing");
    assert.equal(agents[0].detail, "Working on documentation");
  });

  test("agent can post_memo via world.action", async () => {
    const result = await sendSignedMessage("world.action", {
      action: "post_memo",
      content: "Finished the API refactor today",
    });
    assert.equal(result.status, 200);
    assert.equal(result.data.ok, true);

    const memos = await fetch(`http://127.0.0.1:${PORT}/ui/memo/today`).then((r) => r.json());
    assert.equal(memos.success, true);
    assert.equal(memos.entries.length, 1);
    assert.equal(memos.entries[0].content, "Finished the API refactor today");
    assert.equal(memos.entries[0].alias, "TestBot");
  });

  test("agent can set_state to error then clear_error", async () => {
    await sendSignedMessage("world.action", {
      action: "set_state",
      state: "error",
      detail: "Build failed",
    });

    let state = await fetch(`http://127.0.0.1:${PORT}/ui/state`).then((r) => r.json());
    assert.equal(Object.values(state.agents)[0].state, "error");
    assert.equal(Object.values(state.agents)[0].area, "error");

    await sendSignedMessage("world.action", { action: "clear_error" });

    state = await fetch(`http://127.0.0.1:${PORT}/ui/state`).then((r) => r.json());
    assert.equal(Object.values(state.agents)[0].state, "idle");
    assert.equal(Object.values(state.agents)[0].area, "breakroom");
  });

  test("agent can leave via world.leave", async () => {
    const result = await sendSignedMessage("world.leave", {});
    assert.equal(result.status, 200);
    assert.equal(result.data.ok, true);

    const state = await fetch(`http://127.0.0.1:${PORT}/ui/state`).then((r) => r.json());
    assert.equal(Object.keys(state.agents).length, 0);
  });

  test("ledger records all events", async () => {
    const ledger = await fetch(`http://127.0.0.1:${PORT}/world/ledger`).then((r) => r.json());
    assert.ok(ledger.total >= 5); // genesis + join + actions + leave
    const events = ledger.entries.map((e) => e.event);
    assert.ok(events.includes("world.genesis"));
    assert.ok(events.includes("world.join"));
    assert.ok(events.includes("world.action"));
    assert.ok(events.includes("world.leave"));
  });

  test("SSE endpoint streams full state on connect", async () => {
    const controller = new AbortController();
    const resp = await fetch(`http://127.0.0.1:${PORT}/ui/events`, {
      signal: controller.signal,
    });
    assert.equal(resp.status, 200);
    assert.equal(resp.headers.get("content-type"), "text/event-stream");

    // Read first chunk
    const reader = resp.body.getReader();
    const { value } = await reader.read();
    const text = new TextDecoder().decode(value);
    assert.ok(text.includes("event: state"));
    assert.ok(text.includes('"agents"'));
    controller.abort();
  });

  test("Flask compat /status endpoint works", async () => {
    const data = await fetch(`http://127.0.0.1:${PORT}/status`).then((r) => r.json());
    assert.ok(data.state);
    assert.ok(data.updated_at);
    assert.equal(data.officeName, "Star Office");
  });

  test("health endpoint reports correctly", async () => {
    const data = await fetch(`http://127.0.0.1:${PORT}/health`).then((r) => r.json());
    assert.equal(data.status, "ok");
    assert.equal(data.service, "star-office-world");
    assert.ok(typeof data.sseClients === "number");
  });
});

/**
 * Star Office World — Browser-facing UI routes
 *
 * These are standard Fastify routes (NOT AWN peer protocol).
 * Served alongside the AWN peer routes registered by createWorldServer.
 */

import type { FastifyInstance } from "fastify";
import type { OfficeWorldState } from "./types.js";
import type { OfficeAgent } from "./types.js";
import type { SSEManager } from "./sse.js";
import type { MemoStore } from "./memo-store.js";

export interface UIRouteDeps {
  getState: () => OfficeWorldState;
  setAgentState: (
    agentId: string,
    newState: string,
    detail?: string,
  ) => OfficeAgent | null;
  sse: SSEManager;
  memoStore: MemoStore;
  adminPassword: string;
}

export function registerUIRoutes(
  fastify: FastifyInstance,
  deps: UIRouteDeps,
): void {
  const { getState, setAgentState, sse, memoStore, adminPassword } = deps;

  // ── SSE Stream ───────────────────────────────────────────────────────────

  fastify.get("/ui/events", async (req, reply) => {
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    const clientId = sse.addClient(reply);

    // Send full state on connect
    sse.sendTo(clientId, "state", getState());

    // Keep connection open — Fastify won't auto-close raw streams
    // The SSEManager handles cleanup on "close" event
    await new Promise<void>(() => {
      // never resolves — connection stays open until client disconnects
    });
  });

  // ── REST Endpoints ───────────────────────────────────────────────────────

  fastify.get("/ui/state", async () => {
    return getState();
  });

  fastify.get("/ui/agents", async () => {
    const state = getState();
    return {
      ok: true,
      agents: Object.values(state.agents),
      rooms: state.rooms,
    };
  });

  fastify.get("/ui/memo/yesterday", async () => {
    const memo = memoStore.getYesterday();
    if (memo) {
      return { success: true, date: memo.date, memo: memo.entries };
    }
    return { success: false, msg: "没有找到昨日日记" };
  });

  fastify.get("/ui/memo/today", async () => {
    return { success: true, entries: memoStore.getToday() };
  });

  // ── Health ───────────────────────────────────────────────────────────────

  fastify.get("/health", async () => {
    const state = getState();
    return {
      status: "ok",
      service: "star-office-world",
      agents: Object.keys(state.agents).length,
      sseClients: sse.size,
      timestamp: new Date().toISOString(),
    };
  });

  // ── Compat: Flask-style status endpoint ──────────────────────────────────

  fastify.get("/status", async () => {
    const state = getState();
    const agents = Object.values(state.agents);
    // Audit note: this fallback currently mirrors the first online agent,
    // then the first available agent, and only returns idle when none exist.
    const mainAgent = agents.find((a) => a.online) ?? agents[0];
    if (!mainAgent) {
      return {
        state: "idle",
        detail: "Waiting...",
        progress: 0,
        updated_at: new Date().toISOString(),
        officeName: state.officeConfig.name,
      };
    }
    return {
      state: mainAgent.state,
      detail: mainAgent.detail,
      progress: 0,
      updated_at: new Date(mainAgent.lastSeenAt).toISOString(),
      officeName: state.officeConfig.name,
    };
  });

  // ── Compat: Flask-style agents list ──────────────────────────────────────

  fastify.get("/agents", async () => {
    const state = getState();
    return Object.values(state.agents).map((a) => ({
      agentId: a.agentId,
      name: a.alias,
      isMain: false,
      state: a.state,
      detail: a.detail,
      updated_at: new Date(a.lastSeenAt).toISOString(),
      area: a.area,
      source: "awn-peer",
      authStatus: a.online ? "approved" : "offline",
      lastPushAt: new Date(a.lastSeenAt).toISOString(),
      avatar: a.avatar,
    }));
  });

  // ── Compat: Flask-style set_state (for set_state.py) ─────────────────────

  fastify.post("/set_state", async (req) => {
    const body = req.body as Record<string, unknown>;
    const state = getState();
    // Update first online agent or create a "host" agent
    const agents = Object.values(state.agents);
    let target = agents[0];
    if (!target) {
      return { status: "error", msg: "No agents in office" };
    }
    const nextState =
      typeof body["state"] === "string" ? body["state"] : target.state;
    const nextDetail =
      typeof body["detail"] === "string" ? body["detail"] : target.detail;
    const updated = setAgentState(target.agentId, nextState, nextDetail);
    if (!updated) {
      return { status: "error", msg: "Agent not found" };
    }
    sse.broadcast("agent_update", updated);
    return { status: "ok" };
  });

  // ── Admin Auth ───────────────────────────────────────────────────────────

  fastify.post("/ui/admin/login", async (req, reply) => {
    const body = req.body as Record<string, unknown>;
    const pass = (body["password"] as string) ?? "";
    if (pass === adminPassword) {
      // Simple token — in production use proper session/JWT
      reply.header(
        "Set-Cookie",
        `star_office_admin=1; Path=/; HttpOnly; SameSite=Lax; Max-Age=43200`,
      );
      return { ok: true };
    }
    reply.code(403);
    return { ok: false, msg: "密码错误" };
  });
}

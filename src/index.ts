/**
 * Star Office World — Entry point
 *
 * Creates an AWN World Server that serves a pixel-art office dashboard.
 * AI agents join via the AWN peer protocol; browsers view via SSE + REST.
 */

import path from "node:path";
import { createWorldServer } from "@resciencelab/agent-world-sdk";
import type { WorldServer } from "@resciencelab/agent-world-sdk";
import { loadConfig } from "./config.js";
import {
  createInitialState,
  getPublicState,
  updateAgentState,
  initSnapshotDir,
  loadAgentsSnapshot,
  rebuildRooms,
} from "./state.js";
import { createOfficeHooks } from "./hooks.js";
import { SSEManager } from "./sse.js";
import { MemoStore } from "./memo-store.js";
import { registerUIRoutes } from "./ui-routes.js";
import type { StarOfficeConfig } from "./types.js";

export { loadConfig } from "./config.js";
export type { StarOfficeConfig } from "./types.js";
export type {
  OfficeAgent,
  OfficeWorldState,
  AgentState,
  OfficeArea,
  MemoEntry,
  DailyMemo,
} from "./types.js";

export async function createStarOfficeWorld(
  overrides?: Partial<StarOfficeConfig>,
): Promise<WorldServer & { sse: SSEManager }> {
  const config = loadConfig(overrides);
  const dataDir = config.dataDir ?? "./data";
  const state = createInitialState(config);
  const sse = new SSEManager();
  const memoStore = new MemoStore(config.memoryDir ?? "./data/memos");

  // Load yesterday memo into state on startup
  state.yesterdayMemo = memoStore.getYesterday();
  state.todayMemos = memoStore.getToday();

  // Hydrate agents from last snapshot (all restored as offline)
  initSnapshotDir(dataDir);
  const snapshot = loadAgentsSnapshot(dataDir);
  if (snapshot) {
    for (const agent of Object.values(snapshot)) {
      state.agents[agent.agentId] = { ...agent, online: false };
    }
    rebuildRooms(state);
    console.log(`[office] Restored ${Object.keys(snapshot).length} agent(s) from snapshot`);
  }

  const hooks = createOfficeHooks({
    state,
    sse,
    memoStore,
    worldId: config.worldId ?? "star-office",
    worldName: config.officeName ?? "Star Office",
    worldTheme: "pixel-office",
    mainAgentId: config.mainAgentId,
  });

  const server = await createWorldServer(
    {
      worldId: config.worldId ?? "star-office",
      worldName: config.officeName ?? "Star Office",
      worldTheme: "pixel-office",
      worldType: "programmatic",
      port: config.port ?? 19000,
      publicPort: config.publicPort,
      publicAddr: config.publicAddr ?? null,
      gatewayUrls: config.gatewayUrls,
      maxAgents: config.maxAgents ?? 20,
      isPublic: !!config.gatewayUrls?.length,
      password: config.password ?? "",
      broadcastIntervalMs: config.broadcastIntervalMs ?? 3000,
      dataDir: config.dataDir ?? "./data",
      cardUrl: config.publicAddr
        ? `http://${config.publicAddr}:${config.publicPort ?? config.port ?? 19000}/.well-known/agent.json`
        : undefined,
      cardName: config.officeName ?? "Star Office",
      cardDescription:
        "A pixel-art AI office dashboard on the Agent World Network",
      setupRoutes: async (fastify) => {
        // Register browser-facing routes
        registerUIRoutes(fastify, {
          // UI routes currently receive a public snapshot, not the mutable
          // backing object used by AWN hooks. Route handlers that need to
          // change agent state must call the canonical helpers in `state.ts`
          // instead of mutating the object returned here.
          getState: () => getPublicState(state),
          setAgentState: (agentId, newState, detail) =>
            updateAgentState(state, agentId, newState, detail),
          sse,
          memoStore,
          adminPassword: config.adminPassword ?? "1234",
        });

        // Serve static frontend files
        const frontendDir = path.resolve(
          config.frontendDir ?? "./frontend",
        );
        try {
          const staticPlugin = await import("@fastify/static");
          await fastify.register(staticPlugin.default, {
            root: frontendDir,
            prefix: "/",
            decorateReply: false,
          });
        } catch (err) {
          console.warn(
            `[office] Could not register static file serving from ${frontendDir}:`,
            err,
          );
        }

        // CORS for browser access
        try {
          const corsPlugin = await import("@fastify/cors");
          await fastify.register(corsPlugin.default, { origin: true });
        } catch {
          // optional
        }
      },
    },
    hooks,
  );

  console.log(`[office] Star Office World running on port ${config.port ?? 19000}`);
  console.log(`[office] Frontend: http://localhost:${config.port ?? 19000}/`);
  console.log(`[office] SSE: http://localhost:${config.port ?? 19000}/ui/events`);
  console.log(`[office] Health: http://localhost:${config.port ?? 19000}/health`);

  // Wrap stop to also destroy SSE
  const originalStop = server.stop.bind(server);
  return {
    ...server,
    sse,
    async stop() {
      sse.destroy();
      await originalStop();
    },
  };
}

// ── CLI Entry Point ──────────────────────────────────────────────────────────

const isMain =
  process.argv[1] &&
  (process.argv[1].endsWith("/index.ts") ||
    process.argv[1].endsWith("/index.js"));

if (isMain) {
  createStarOfficeWorld().catch((err) => {
    console.error("Failed to start Star Office World:", err);
    process.exit(1);
  });
}

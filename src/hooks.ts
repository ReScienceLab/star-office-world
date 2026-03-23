/**
 * Star Office World — AWN WorldHooks implementation
 *
 * Translates AWN peer protocol events into office state mutations.
 */

import type { WorldHooks, WorldManifest } from "@resciencelab/agent-world-sdk";
import type { OfficeWorldState, MemoEntry } from "./types.js";
import { normalizeState, stateToArea } from "./types.js";
import {
  addAgent,
  updateAgentState,
  heartbeat,
  removeAgent,
  markOffline,
  addMemo,
  getPublicState,
  PUBLIC_STATE_FIELDS,
  rebuildRooms,
  randomAvatar,
} from "./state.js";
import type { SSEManager } from "./sse.js";
import type { MemoStore } from "./memo-store.js";

export interface HooksDeps {
  state: OfficeWorldState;
  sse: SSEManager;
  memoStore: MemoStore;
  worldId: string;
  worldName: string;
  worldTheme: string;
  mainAgentId?: string;
}

export function createManifest(deps: HooksDeps): WorldManifest {
  return {
    name: deps.worldName,
    type: "programmatic",
    theme: deps.worldTheme,
    description:
      "A pixel-art office where AI agents work, rest, and collaborate. Watch your agents move between desk, breakroom, and debug area in real-time.",
    objective:
      "Visualize AI agent work status in a shared pixel office environment",
    rules: [
      {
        id: "state-valid",
        text: "Agent state must be one of: idle, writing, researching, executing, syncing, error",
        enforced: true,
      },
      {
        id: "heartbeat",
        text: "Agents must send heartbeat every 60s or be marked offline after 5min",
        enforced: true,
      },
      {
        id: "one-session",
        text: "Each agentId may have at most one active session",
        enforced: true,
      },
      {
        id: "memo-limit",
        text: "Memo content limited to 2000 characters per post",
        enforced: true,
      },
    ],
    actions: {
      set_state: {
        desc: "Update agent's work status and detail message",
        params: {
          state: {
            type: "string",
            required: true,
            enum: [
              "idle",
              "writing",
              "researching",
              "executing",
              "syncing",
              "error",
            ],
          },
          detail: {
            type: "string",
            required: false,
            desc: "Human-readable status message (max 200 chars)",
          },
        },
      },
      heartbeat: {
        desc: "Keep-alive signal to prevent idle eviction",
        params: {},
      },
      post_memo: {
        desc: "Post a work memo entry for the day",
        params: {
          content: {
            type: "string",
            required: true,
            desc: "Memo text (max 2000 chars)",
          },
        },
      },
      clear_error: {
        desc: "Clear error state and return to idle",
        params: {},
      },
    },
    lifecycle: {
      matchmaking: "free",
      evictionPolicy: "idle",
      idleTimeoutMs: 300_000,
    },
    state_fields: [...PUBLIC_STATE_FIELDS],
  };
}

export function createOfficeHooks(deps: HooksDeps): WorldHooks {
  const { state, sse, memoStore, mainAgentId } = deps;
  const manifest = createManifest(deps);
  const idleTimeoutMs = manifest.lifecycle?.idleTimeoutMs ?? 300_000;

  return {
    async onJoin(agentId, data) {
      const alias = (data["alias"] ?? data["name"] ?? "") as string;
      const avatar = (data["avatar"] as string) ?? undefined;
      const initialState = (data["state"] as string) ?? undefined;
      const detail = (data["detail"] as string) ?? undefined;

      const isMain = !!mainAgentId && agentId === mainAgentId;
      const agent = addAgent(state, agentId, alias, avatar, initialState, detail, isMain);
      sse.broadcast("agent_join", agent);

      console.log(
        `[office] ${alias || agentId.slice(0, 8)} joined → ${agent.area} (${Object.keys(state.agents).length} agents)`,
      );

      const publicState = getPublicState(state);
      return {
        manifest,
        state: isMain
          ? {
              ...publicState,
              yourRole: "host",
              roleDescription:
                "You are the host of this office. Your state (set_state) drives the main character avatar visible to all visitors. Use set_state to reflect what you are working on, and post_memo to leave notes for visitors.",
            }
          : publicState,
      };
    },

    async onAction(agentId, data) {
      const action = data["action"] as string;
      const agent = state.agents[agentId];
      if (!agent) return { ok: false };

      switch (action) {
        case "set_state": {
          const updated = updateAgentState(
            state,
            agentId,
            data["state"] as string,
            data["detail"] as string | undefined,
          );
          if (updated) {
            sse.broadcast("agent_update", updated);
            console.log(
              `[office] ${agent.alias || agentId.slice(0, 8)} → ${updated.state} (${updated.area})`,
            );
          }
          return { ok: true, state: getPublicState(state) };
        }

        case "heartbeat": {
          heartbeat(state, agentId);
          return { ok: true };
        }

        case "post_memo": {
          const content = ((data["content"] as string) ?? "").slice(0, 2000);
          if (!content) return { ok: false };
          const entry = addMemo(state, agentId, agent.alias, content);
          try {
            memoStore.append(entry);
          } catch (error) {
            console.warn(
              `[office] Failed to persist memo for ${agent.alias || agentId.slice(0, 8)}:`,
              error,
            );
          }
          sse.broadcast("memo", entry);
          console.log(
            `[office] Memo from ${agent.alias || agentId.slice(0, 8)}: ${content.slice(0, 50)}...`,
          );
          return { ok: true };
        }

        case "clear_error": {
          if (agent.state === "error") {
            const updated = updateAgentState(state, agentId, "idle", "");
            if (updated) sse.broadcast("agent_update", updated);
          }
          return { ok: true, state: getPublicState(state) };
        }

        default:
          return { ok: false };
      }
    },

    async onLeave(agentId) {
      const agent = state.agents[agentId];
      const alias = agent?.alias ?? agentId.slice(0, 8);
      const wasIdleEvicted =
        !!agent && Date.now() - agent.lastSeenAt >= idleTimeoutMs;

      if (wasIdleEvicted) {
        markOffline(state, agentId);
        sse.broadcast("agent_offline", { agentId });
      } else {
        removeAgent(state, agentId);
        sse.broadcast("agent_leave", { agentId });
      }
      console.log(
        wasIdleEvicted
          ? `[office] ${alias} marked offline (${Object.keys(state.agents).length} agents)`
          : `[office] ${alias} left (${Object.keys(state.agents).length} agents)`,
      );
    },

    getState() {
      return getPublicState(state);
    },
  };
}

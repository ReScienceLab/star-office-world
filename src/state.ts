/**
 * Star Office World — In-memory state management
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type {
  OfficeWorldState,
  OfficeAgent,
  AgentState,
  OfficeArea,
  MemoEntry,
  StarOfficeConfig,
} from "./types.js";
import { normalizeState, stateToArea } from "./types.js";

const AVATARS = [
  "guest_role_1",
  "guest_role_2",
  "guest_role_3",
  "guest_role_4",
  "guest_role_5",
  "guest_role_6",
];

const SNAPSHOT_FILE = "agents-snapshot.json";
let _dataDir = "./data";

export function initSnapshotDir(dataDir: string): void {
  _dataDir = dataDir;
}

export function saveAgentsSnapshot(
  agents: Record<string, OfficeAgent>,
): void {
  const file = path.join(_dataDir, SNAPSHOT_FILE);
  fs.mkdirSync(_dataDir, { recursive: true });
  fs.writeFile(file, JSON.stringify(agents, null, 2), (err) => {
    if (err) console.warn("[office] Failed to save agents snapshot:", err);
  });
}

export function loadAgentsSnapshot(
  dataDir: string,
): Record<string, OfficeAgent> | null {
  const file = path.join(dataDir, SNAPSHOT_FILE);
  try {
    const raw = fs.readFileSync(file, "utf8");
    return JSON.parse(raw) as Record<string, OfficeAgent>;
  } catch {
    return null;
  }
}

export const PUBLIC_STATE_FIELDS: ReadonlyArray<keyof OfficeWorldState> = [
  "agents",
  "rooms",
  "background",
  "todayMemos",
  "yesterdayMemo",
  "officeConfig",
  "lastUpdated",
];

export function randomAvatar(): string {
  return AVATARS[Math.floor(Math.random() * AVATARS.length)]!;
}

export function createInitialState(config: StarOfficeConfig): OfficeWorldState {
  return {
    agents: {},
    rooms: { breakroom: [], writing: [], error: [] },
    background: {
      current: "office_bg_small.webp",
      updatedAt: Date.now(),
      updatedBy: null,
    },
    todayMemos: [],
    yesterdayMemo: null,
    officeConfig: {
      name: config.officeName ?? "Star Office",
      maxAgents: config.maxAgents ?? 20,
      language: config.language ?? "cn",
    },
    lastUpdated: Date.now(),
  };
}

export function rebuildRooms(state: OfficeWorldState): void {
  const rooms: OfficeWorldState["rooms"] = {
    breakroom: [],
    writing: [],
    error: [],
  };
  for (const [id, agent] of Object.entries(state.agents)) {
    if (agent.online) {
      rooms[agent.area].push(id);
    }
  }
  state.rooms = rooms;
  state.lastUpdated = Date.now();
}

export function addAgent(
  state: OfficeWorldState,
  agentId: string,
  alias: string,
  avatar?: string,
  initialState?: string,
  detail?: string,
  isMain?: boolean,
): OfficeAgent {
  const agState = normalizeState(initialState);
  const agent: OfficeAgent = {
    agentId,
    alias,
    avatar: avatar ?? randomAvatar(),
    state: agState,
    detail: detail ?? "",
    area: stateToArea(agState),
    joinedAt: Date.now(),
    lastSeenAt: Date.now(),
    online: true,
    isMain: isMain ?? false,
  };
  state.agents[agentId] = agent;
  rebuildRooms(state);
  saveAgentsSnapshot(state.agents);
  return agent;
}

export function updateAgentState(
  state: OfficeWorldState,
  agentId: string,
  newState: string,
  detail?: string,
): OfficeAgent | null {
  const agent = state.agents[agentId];
  if (!agent) return null;
  // Canonical runtime mutation path for agent presence/state changes.
  // AWN actions call this helper so agent fields and derived room membership
  // stay in sync before any public snapshot is returned or broadcast.
  agent.state = normalizeState(newState);
  agent.detail = (detail ?? "").slice(0, 200);
  agent.area = stateToArea(agent.state);
  agent.lastSeenAt = Date.now();
  agent.online = true;
  rebuildRooms(state);
  saveAgentsSnapshot(state.agents);
  return agent;
}

export function heartbeat(
  state: OfficeWorldState,
  agentId: string,
): boolean {
  const agent = state.agents[agentId];
  if (!agent) return false;
  agent.lastSeenAt = Date.now();
  agent.online = true;
  return true;
}

export function removeAgent(
  state: OfficeWorldState,
  agentId: string,
): boolean {
  if (!state.agents[agentId]) return false;
  delete state.agents[agentId];
  rebuildRooms(state);
  saveAgentsSnapshot(state.agents);
  return true;
}

export function markOffline(
  state: OfficeWorldState,
  agentId: string,
): boolean {
  const agent = state.agents[agentId];
  if (!agent) return false;
  agent.online = false;
  agent.state = "idle";
  agent.area = "breakroom";
  rebuildRooms(state);
  saveAgentsSnapshot(state.agents);
  return true;
}

export function addMemo(
  state: OfficeWorldState,
  agentId: string,
  alias: string,
  content: string,
): MemoEntry {
  const entry: MemoEntry = {
    agentId,
    alias,
    content: content.slice(0, 2000),
    timestamp: Date.now(),
  };
  state.todayMemos.push(entry);
  return entry;
}

/**
 * Get a sanitized copy of world state suitable for SSE/REST.
 * Strips internal fields and returns a frozen snapshot.
 */
export function getPublicState(state: OfficeWorldState): OfficeWorldState {
  return {
    ...state,
    agents: Object.fromEntries(
      Object.entries(state.agents).map(([agentId, agent]) => [agentId, { ...agent }]),
    ),
    rooms: {
      breakroom: [...state.rooms.breakroom],
      writing: [...state.rooms.writing],
      error: [...state.rooms.error],
    },
    background: { ...state.background },
    todayMemos: state.todayMemos.map((entry) => ({ ...entry })),
    yesterdayMemo: state.yesterdayMemo
      ? {
          ...state.yesterdayMemo,
          entries: state.yesterdayMemo.entries.map((entry) => ({ ...entry })),
        }
      : null,
    officeConfig: { ...state.officeConfig },
  };
}

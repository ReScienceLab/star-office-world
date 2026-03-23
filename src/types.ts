/**
 * Star Office World — Type definitions
 */

// ── Agent States ─────────────────────────────────────────────────────────────

export const VALID_AGENT_STATES = [
  "idle",
  "writing",
  "researching",
  "executing",
  "syncing",
  "error",
] as const;

export type AgentState = (typeof VALID_AGENT_STATES)[number];

export type OfficeArea = "breakroom" | "writing" | "error";

/** Canonical state → area mapping (matches original Star Office UI) */
export const STATE_TO_AREA: Record<AgentState, OfficeArea> = {
  idle: "breakroom",
  writing: "writing",
  researching: "writing",
  executing: "writing",
  syncing: "writing",
  error: "error",
};

/** Synonym normalization for external state values */
const STATE_SYNONYMS: Record<string, AgentState> = {
  working: "writing",
  busy: "writing",
  write: "writing",
  run: "executing",
  running: "executing",
  execute: "executing",
  exec: "executing",
  sync: "syncing",
  research: "researching",
  search: "researching",
};

export function normalizeState(raw: string | undefined | null): AgentState {
  if (!raw) return "idle";
  const s = raw.toLowerCase().trim();
  if (VALID_AGENT_STATES.includes(s as AgentState)) return s as AgentState;
  return STATE_SYNONYMS[s] ?? "idle";
}

export function stateToArea(state: AgentState): OfficeArea {
  return STATE_TO_AREA[state] ?? "breakroom";
}

// ── Office Agent ─────────────────────────────────────────────────────────────

export interface OfficeAgent {
  agentId: string;
  alias: string;
  avatar: string;
  state: AgentState;
  detail: string;
  area: OfficeArea;
  joinedAt: number;
  lastSeenAt: number;
  online: boolean;
  isMain?: boolean;
}

// ── Memo ─────────────────────────────────────────────────────────────────────

export interface MemoEntry {
  agentId: string;
  alias: string;
  content: string;
  timestamp: number;
}

export interface DailyMemo {
  date: string;
  entries: MemoEntry[];
}

// ── World State ──────────────────────────────────────────────────────────────

export interface OfficeWorldState {
  agents: Record<string, OfficeAgent>;
  rooms: {
    breakroom: string[];
    writing: string[];
    error: string[];
  };
  background: {
    current: string;
    updatedAt: number;
    updatedBy: string | null;
  };
  todayMemos: MemoEntry[];
  yesterdayMemo: DailyMemo | null;
  officeConfig: {
    name: string;
    maxAgents: number;
    language: "cn" | "en" | "jp";
  };
  lastUpdated: number;
}

// ── SSE Events ───────────────────────────────────────────────────────────────

export type SSEEventType =
  | "state"
  | "agent_join"
  | "agent_update"
  | "agent_leave"
  | "agent_offline"
  | "memo"
  | "background"
  | "heartbeat";

// ── Config ───────────────────────────────────────────────────────────────────

export interface StarOfficeConfig {
  worldId?: string;
  officeName?: string;
  port?: number;
  publicPort?: number;
  publicAddr?: string | null;
  gatewayUrls?: string[];
  password?: string;
  adminPassword?: string;
  maxAgents?: number;
  broadcastIntervalMs?: number;
  dataDir?: string;
  frontendDir?: string;
  memoryDir?: string;
  geminiApiKey?: string;
  geminiModel?: string;
  language?: "cn" | "en" | "jp";
  mainAgentId?: string;
}

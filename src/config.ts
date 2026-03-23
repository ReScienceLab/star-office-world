/**
 * Star Office World — Configuration loader
 *
 * Reads from environment variables with sensible defaults.
 */

import type { StarOfficeConfig } from "./types.js";

export function loadConfig(overrides?: Partial<StarOfficeConfig>): StarOfficeConfig {
  return {
    worldId: overrides?.worldId ?? process.env["STAR_OFFICE_WORLD_ID"] ?? "star-office",
    officeName: overrides?.officeName ?? process.env["STAR_OFFICE_NAME"] ?? "Star Office",
    port: overrides?.port ?? int(process.env["STAR_OFFICE_PORT"], 19000),
    publicPort: overrides?.publicPort ?? intOrUndef(process.env["STAR_OFFICE_PUBLIC_PORT"]),
    publicAddr: overrides?.publicAddr ?? process.env["STAR_OFFICE_PUBLIC_ADDR"] ?? null,
    gatewayUrls: overrides?.gatewayUrls ?? parseList(process.env["STAR_OFFICE_GATEWAY_URLS"]),
    password: overrides?.password ?? process.env["STAR_OFFICE_PASSWORD"] ?? "",
    adminPassword: overrides?.adminPassword ?? process.env["STAR_OFFICE_ADMIN_PASS"] ?? "1234",
    maxAgents: overrides?.maxAgents ?? int(process.env["STAR_OFFICE_MAX_AGENTS"], 20),
    broadcastIntervalMs: overrides?.broadcastIntervalMs ?? int(process.env["STAR_OFFICE_BROADCAST_MS"], 3000),
    dataDir: overrides?.dataDir ?? process.env["STAR_OFFICE_DATA_DIR"] ?? "./data",
    frontendDir: overrides?.frontendDir ?? process.env["STAR_OFFICE_FRONTEND_DIR"] ?? "./frontend",
    memoryDir: overrides?.memoryDir ?? process.env["STAR_OFFICE_MEMORY_DIR"] ?? "./data/memos",
    geminiApiKey: overrides?.geminiApiKey ?? process.env["GEMINI_API_KEY"],
    geminiModel: overrides?.geminiModel ?? process.env["GEMINI_MODEL"] ?? "nanobanana-pro",
    language: overrides?.language ?? (process.env["STAR_OFFICE_LANG"] as "cn" | "en" | "jp") ?? "cn",
    mainAgentId: overrides?.mainAgentId ?? process.env["STAR_OFFICE_MAIN_AGENT_ID"],
  };
}

function int(val: string | undefined, fallback: number): number {
  if (!val) return fallback;
  const n = parseInt(val, 10);
  return Number.isFinite(n) ? n : fallback;
}

function intOrUndef(val: string | undefined): number | undefined {
  if (!val) return undefined;
  const n = parseInt(val, 10);
  return Number.isFinite(n) ? n : undefined;
}

function parseList(val: string | undefined): string[] | undefined {
  if (!val) return undefined;
  return val.split(",").map((s) => s.trim()).filter(Boolean);
}

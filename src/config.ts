/**
 * Star Office World — Configuration loader
 *
 * Reads from environment variables with sensible defaults.
 * Call resolveConfig() for full config with auto-discovered public IP.
 */

import type { StarOfficeConfig } from "./types.js";
import { discoverPublicAddr } from "./discover.js";

export function loadConfig(overrides?: Partial<StarOfficeConfig>): StarOfficeConfig {
  return {
    worldId: overrides?.worldId ?? process.env["STAR_OFFICE_WORLD_ID"] ?? process.env["WORLD_ID"] ?? "star-office",
    officeName: overrides?.officeName ?? process.env["STAR_OFFICE_NAME"] ?? process.env["WORLD_NAME"] ?? "Star Office",
    port: overrides?.port ?? int(process.env["STAR_OFFICE_PORT"] ?? process.env["PEER_PORT"], 19000),
    publicPort: overrides?.publicPort ?? intOrUndef(process.env["STAR_OFFICE_PUBLIC_PORT"] ?? process.env["PUBLIC_PORT"]),
    publicAddr: overrides?.publicAddr ?? process.env["STAR_OFFICE_PUBLIC_ADDR"] ?? process.env["PUBLIC_ADDR"] ?? null,
    gatewayUrls: overrides?.gatewayUrls
      ?? parseList(process.env["STAR_OFFICE_GATEWAY_URLS"] ?? process.env["GATEWAY_URL"])
      ?? ["https://gateway.agentworlds.ai"],
    password: overrides?.password ?? process.env["STAR_OFFICE_PASSWORD"] ?? "",
    adminPassword: overrides?.adminPassword ?? process.env["STAR_OFFICE_ADMIN_PASS"] ?? "1234",
    maxAgents: overrides?.maxAgents ?? int(process.env["STAR_OFFICE_MAX_AGENTS"], 20),
    broadcastIntervalMs: overrides?.broadcastIntervalMs ?? int(process.env["STAR_OFFICE_BROADCAST_MS"], 3000),
    dataDir: overrides?.dataDir ?? process.env["STAR_OFFICE_DATA_DIR"] ?? process.env["DATA_DIR"] ?? "./data",
    frontendDir: overrides?.frontendDir ?? process.env["STAR_OFFICE_FRONTEND_DIR"] ?? "./frontend",
    memoryDir: overrides?.memoryDir ?? process.env["STAR_OFFICE_MEMORY_DIR"] ?? "./data/memos",
    geminiApiKey: overrides?.geminiApiKey ?? process.env["GEMINI_API_KEY"],
    geminiModel: overrides?.geminiModel ?? process.env["GEMINI_MODEL"] ?? "nanobanana-pro",
    language: overrides?.language ?? (process.env["STAR_OFFICE_LANG"] as "cn" | "en" | "jp") ?? "cn",
    mainAgentId: overrides?.mainAgentId ?? process.env["STAR_OFFICE_MAIN_AGENT_ID"],
  };
}

export async function resolveConfig(overrides?: Partial<StarOfficeConfig>): Promise<StarOfficeConfig> {
  const config = loadConfig(overrides);

  if (!config.publicAddr) {
    config.publicAddr = await discoverPublicAddr();
  }

  logConfigSummary(config);
  return config;
}

function logConfigSummary(config: StarOfficeConfig): void {
  console.log("[office] Configuration:");
  console.log(`  worldId:     ${config.worldId}`);
  console.log(`  name:        ${config.officeName}`);
  console.log(`  port:        ${config.port}`);
  console.log(`  publicAddr:  ${config.publicAddr ?? "(none)"}`);
  console.log(`  publicPort:  ${config.publicPort ?? "(same as port)"}`);
  console.log(`  gatewayUrls: ${config.gatewayUrls?.join(", ") ?? "(none)"}`);
  console.log(`  dataDir:     ${config.dataDir}`);

  if (!config.publicAddr) {
    console.warn("[office] WARNING: No PUBLIC_ADDR — world will register on gateway without reachable endpoints");
  }
  if (config.worldId === "star-office") {
    console.warn("[office] WARNING: Using default worldId 'star-office' — set WORLD_ID for unique identification");
  }
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

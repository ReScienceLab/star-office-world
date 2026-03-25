/**
 * Star Office World — Configuration loader
 *
 * Reads from environment variables with sensible defaults.
 * Call resolveConfig() for full config with auto-discovered public IP.
 */

import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import type { StarOfficeConfig } from "./types.js";
import { discoverPublicAddr } from "./discover.js";

export function loadConfig(overrides?: Partial<StarOfficeConfig>): StarOfficeConfig {
  return {
    worldId: overrides?.worldId ?? process.env["WORLD_ID"] ?? process.env["STAR_OFFICE_WORLD_ID"] ?? "star-office",
    officeName: overrides?.officeName ?? process.env["WORLD_NAME"] ?? process.env["STAR_OFFICE_NAME"] ?? "Star Office",
    port: overrides?.port ?? int(process.env["PEER_PORT"] ?? process.env["STAR_OFFICE_PORT"], 19000),
    publicPort: overrides?.publicPort ?? intOrUndef(process.env["PUBLIC_PORT"] ?? process.env["STAR_OFFICE_PUBLIC_PORT"]),
    publicAddr: overrides?.publicAddr ?? process.env["PUBLIC_ADDR"] ?? process.env["STAR_OFFICE_PUBLIC_ADDR"] ?? null,
    gatewayUrls: overrides?.gatewayUrls
      ?? parseList(process.env["GATEWAY_URL"] ?? process.env["STAR_OFFICE_GATEWAY_URLS"])
      ?? ["https://gateway.agentworlds.ai"],
    password: overrides?.password ?? process.env["WORLD_PASSWORD"] ?? process.env["STAR_OFFICE_PASSWORD"] ?? "",
    adminPassword: overrides?.adminPassword ?? process.env["STAR_OFFICE_ADMIN_PASS"] ?? "1234",
    maxAgents: overrides?.maxAgents ?? int(process.env["MAX_AGENTS"] ?? process.env["STAR_OFFICE_MAX_AGENTS"], 20),
    isPublic: overrides?.isPublic ?? bool(process.env["WORLD_PUBLIC"], true),
    broadcastIntervalMs: overrides?.broadcastIntervalMs ?? int(process.env["STAR_OFFICE_BROADCAST_MS"], 3000),
    dataDir: overrides?.dataDir ?? process.env["DATA_DIR"] ?? process.env["STAR_OFFICE_DATA_DIR"] ?? "./data",
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

  const explicitWorldId = overrides?.worldId
    ?? process.env["WORLD_ID"]
    ?? process.env["STAR_OFFICE_WORLD_ID"];
  if (!explicitWorldId) {
    config.worldId = deriveSlug(config.dataDir ?? "./data", config.officeName ?? "Star Office");
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
  console.log(`  isPublic:    ${config.isPublic ?? true}`);
  console.log(`  gatewayUrls: ${config.gatewayUrls?.join(", ") ?? "(none)"}`);
  console.log(`  dataDir:     ${config.dataDir}`);

  if (!config.publicAddr) {
    console.warn("[office] WARNING: No PUBLIC_ADDR — world will register on gateway without reachable endpoints");
  }
  if (!process.env["WORLD_ID"] && !process.env["STAR_OFFICE_WORLD_ID"]) {
    console.log("  (slug auto-derived from identity)");
  }
}

function deriveSlug(dataDir: string, name: string): string {
  const prefix = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "world";
  const idFile = path.join(dataDir, "world-identity.json");
  try {
    if (fs.existsSync(idFile)) {
      const saved = JSON.parse(fs.readFileSync(idFile, "utf8")) as { publicKey?: string; seed?: string };
      const key = saved.publicKey ?? saved.seed ?? "";
      if (key) {
        const hash = createHash("sha256").update(key).digest("hex").slice(0, 6);
        return `${prefix}-${hash}`;
      }
    }
  } catch {
    // identity not yet created — fall through
  }
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${rand}`;
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

function bool(val: string | undefined, fallback: boolean): boolean {
  if (!val) return fallback;
  const normalized = val.trim().toLowerCase();
  if (["1", "true", "yes", "on", "public"].includes(normalized)) return true;
  if (["0", "false", "no", "off", "private"].includes(normalized)) return false;
  return fallback;
}

function parseList(val: string | undefined): string[] | undefined {
  if (!val) return undefined;
  return val.split(",").map((s) => s.trim()).filter(Boolean);
}

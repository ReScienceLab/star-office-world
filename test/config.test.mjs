import { afterEach, test } from "node:test"
import assert from "node:assert/strict"

const ORIGINAL_ENV = { ...process.env }

function resetEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) delete process.env[key]
  }
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    process.env[key] = value
  }
}

afterEach(() => {
  resetEnv()
})

test("loadConfig prefers platform env vars over legacy STAR_OFFICE_* aliases", async () => {
  process.env.WORLD_ID = "platform-world"
  process.env.STAR_OFFICE_WORLD_ID = "legacy-world"
  process.env.WORLD_NAME = "Platform Name"
  process.env.STAR_OFFICE_NAME = "Legacy Name"
  process.env.PEER_PORT = "19001"
  process.env.STAR_OFFICE_PORT = "19000"
  process.env.PUBLIC_PORT = "9550"
  process.env.STAR_OFFICE_PUBLIC_PORT = "9549"
  process.env.PUBLIC_ADDR = "3.17.5.202"
  process.env.STAR_OFFICE_PUBLIC_ADDR = "127.0.0.1"
  process.env.GATEWAY_URL = "https://gateway.example.com"
  process.env.STAR_OFFICE_GATEWAY_URLS = "https://legacy-gateway.example.com"
  process.env.WORLD_PASSWORD = "platform-password"
  process.env.STAR_OFFICE_PASSWORD = "legacy-password"
  process.env.MAX_AGENTS = "42"
  process.env.STAR_OFFICE_MAX_AGENTS = "7"
  process.env.WORLD_PUBLIC = "false"
  process.env.DATA_DIR = "/platform-data"
  process.env.STAR_OFFICE_DATA_DIR = "/legacy-data"

  const { loadConfig } = await import("../dist/config.js")
  const config = loadConfig()

  assert.equal(config.worldId, "platform-world")
  assert.equal(config.officeName, "Platform Name")
  assert.equal(config.port, 19001)
  assert.equal(config.publicPort, 9550)
  assert.equal(config.publicAddr, "3.17.5.202")
  assert.deepEqual(config.gatewayUrls, ["https://gateway.example.com"])
  assert.equal(config.password, "platform-password")
  assert.equal(config.maxAgents, 42)
  assert.equal(config.isPublic, false)
  assert.equal(config.dataDir, "/platform-data")
})

test("loadConfig still supports legacy STAR_OFFICE_* env vars when platform vars are absent", async () => {
  process.env.STAR_OFFICE_WORLD_ID = "legacy-world"
  process.env.STAR_OFFICE_NAME = "Legacy Name"
  process.env.STAR_OFFICE_PASSWORD = "legacy-password"
  process.env.STAR_OFFICE_MAX_AGENTS = "7"

  const { loadConfig } = await import("../dist/config.js")
  const config = loadConfig()

  assert.equal(config.worldId, "legacy-world")
  assert.equal(config.officeName, "Legacy Name")
  assert.equal(config.password, "legacy-password")
  assert.equal(config.maxAgents, 7)
  assert.equal(config.isPublic, true)
})

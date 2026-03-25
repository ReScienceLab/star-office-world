# @resciencelab/star-office-world

## 0.2.2

### Patch Changes

- 230386e: Align env contract with platform: WORLD*ID, WORLD_NAME, WORLD_PASSWORD, MAX_AGENTS, WORLD_PUBLIC now take precedence over legacy STAR_OFFICE*\* aliases. Added isPublic config support so deployed worlds honor platform visibility settings.

## 0.2.1

### Patch Changes

- 2d67aaf: Auto-derive unique slug from identity keypair when WORLD_ID is not set, preventing duplicate 'star-office' slugs on the gateway

## 0.2.0

### Minor Changes

- aede54e: Auto-discover public IP via EC2 metadata / checkip when PUBLIC_ADDR is not set, ensuring worlds register on the gateway with reachable endpoints

## 0.1.4

### Patch Changes

- 3b5250f: Fix gateway registration: default to production gateway URL so deployed worlds auto-register without requiring GATEWAY_URL env var

## 0.1.3

### Patch Changes

- 801ad91: Declare the main agent env as an AgentWorlds-managed value so deploys can auto-inject the user's primary agent with an oldest-bound fallback.

## 0.1.2

### Patch Changes

- 275820d: Upgrade `@resciencelab/agent-world-sdk` from v1.3.1 to v1.5.0

  Notable upstream changes consumed:

  - v1.4.0: Rust `awn` CLI binary; peer→agent/world terminology rename; gateway endpoint redesign (`/peer/*` → `/agents`, `/messages`, `/ping`)
  - v1.5.0: World manifest endpoint for querying world info and actions without joining; fix `awn daemon stop` IPC shutdown

- 9c0ee6e: Upgrade `@resciencelab/agent-world-sdk` to v1.5.1 (patch fixes)

## 0.1.1

### Patch Changes

- Upgrade `@resciencelab/agent-world-sdk` to v1.3.1 (Swagger UI, endpoints in `/worlds` response)
- Fix: use relative URLs instead of root-relative for Tauri/Electron embeddability

## 0.1.0

### Minor Changes

- Initial release: pixel-art AI office dashboard built on Agent World Network protocol
- Add `world.yaml` manifest and Dockerfile for AgentWorlds platform compatibility
- Persist agent state across restarts; designate host agent
- Live today memo feed with real-time entries and periodic refresh

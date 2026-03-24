# @resciencelab/star-office-world

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

---
"@resciencelab/star-office-world": patch
---

Upgrade `@resciencelab/agent-world-sdk` from v1.3.1 to v1.5.0

Notable upstream changes consumed:
- v1.4.0: Rust `awn` CLI binary; peer→agent/world terminology rename; gateway endpoint redesign (`/peer/*` → `/agents`, `/messages`, `/ping`)
- v1.5.0: World manifest endpoint for querying world info and actions without joining; fix `awn daemon stop` IPC shutdown

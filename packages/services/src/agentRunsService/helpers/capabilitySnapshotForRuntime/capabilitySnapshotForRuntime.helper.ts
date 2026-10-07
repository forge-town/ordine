import { getRuntimeManifest } from "@repo/agent";

import type { AgentRuntime, RuntimeCapabilities } from "@repo/schemas";

export const capabilitySnapshotForRuntime = (runtime: AgentRuntime): RuntimeCapabilities =>
  getRuntimeManifest(runtime).capabilities;

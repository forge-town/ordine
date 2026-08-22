import {
  getLocalAgentRuntimeId,
  type AgentRuntime,
  type AgentRuntimeCatalogEntry,
  type RuntimeAuthenticationStatus,
  type RuntimeModel,
} from "@repo/schemas";
import { spawnCommand } from "../spawn/spawnCommand";
import { RUNTIME_MANIFESTS } from "../runtime/runtimeManifestRegistry";
import { getRuntimeBinaries, scanRuntimes } from "./scanRuntimes";

const AUTH_PROBES: Partial<Record<AgentRuntime, readonly string[]>> = {
  "claude-code": ["auth", "status"],
  codex: ["login", "status"],
};

const DEFAULT_MODEL: RuntimeModel = {
  id: "default",
  displayName: "Default",
  isDefault: true,
};

const CODEX_REASONING = ["none", "minimal", "low", "medium", "high", "xhigh"].map((value) => ({
  value,
  label: value === "xhigh" ? "XHigh" : value[0]?.toUpperCase() + value.slice(1),
}));

const FALLBACK_MODELS: Partial<Record<AgentRuntime, RuntimeModel[]>> = {
  codex: [
    { ...DEFAULT_MODEL, reasoningEfforts: CODEX_REASONING },
    { id: "gpt-5.5", displayName: "gpt-5.5", reasoningEfforts: CODEX_REASONING },
    { id: "gpt-5.4", displayName: "gpt-5.4", reasoningEfforts: CODEX_REASONING },
    { id: "gpt-5.4-mini", displayName: "gpt-5.4-mini", reasoningEfforts: CODEX_REASONING },
    { id: "gpt-5.3-codex", displayName: "gpt-5.3-codex", reasoningEfforts: CODEX_REASONING },
  ],
  "claude-code": [
    DEFAULT_MODEL,
    { id: "sonnet", displayName: "Sonnet (alias)" },
    { id: "opus", displayName: "Opus (alias)" },
    { id: "haiku", displayName: "Haiku (alias)" },
  ],
  opencode: [
    DEFAULT_MODEL,
    { id: "anthropic/claude-sonnet-4-5", displayName: "anthropic/claude-sonnet-4-5" },
    { id: "openai/gpt-5", displayName: "openai/gpt-5" },
    { id: "google/gemini-2.5-pro", displayName: "google/gemini-2.5-pro" },
  ],
};

const runProbe = (
  path: string,
  args: readonly string[],
): Promise<{ code: number | null; output: string }> =>
  new Promise((resolve) => {
    const child = spawnCommand(path, [...args], { stdio: ["ignore", "pipe", "pipe"] });
    const chunks: Buffer[] = [];
    const state = { settled: false };
    const finish = (code: number | null): void => {
      if (state.settled) return;
      state.settled = true;
      clearTimeout(timer);
      resolve({ code, output: Buffer.concat(chunks).toString("utf8").slice(0, 8192) });
    };
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      finish(null);
    }, 5000);
    child.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => chunks.push(chunk));
    child.once("error", () => finish(null));
    child.once("close", finish);
  });

const probeAuthentication = async (
  runtime: AgentRuntime,
  path: string,
): Promise<{ status: RuntimeAuthenticationStatus; message: string | null }> => {
  const args = AUTH_PROBES[runtime];
  if (!args) return { status: "unknown", message: null };
  const result = await runProbe(path, args);
  const output = result.output.toLowerCase();
  if (result.code === null) {
    return { status: "error", message: "Authentication probe did not complete" };
  }
  if (
    result.code !== 0 ||
    /not logged in|not authenticated|logged.?in["'\s:]+false|authenticated["'\s:]+false/.test(
      output,
    )
  ) {
    return { status: "unauthenticated", message: "CLI authentication is required" };
  }

  return { status: "authenticated", message: "CLI authentication probe succeeded" };
};

export const scanRuntimeCatalog = async (): Promise<AgentRuntimeCatalogEntry[]> => {
  const detected = await scanRuntimes();
  const detectedByRuntime = new Map(detected.map((runtime) => [runtime.type, runtime]));
  const configuredBinaries = getRuntimeBinaries();

  return Promise.all(
    RUNTIME_MANIFESTS.map(async (manifest): Promise<AgentRuntimeCatalogEntry> => {
      const runtime = detectedByRuntime.get(manifest.runtime);
      const authentication = runtime?.path
        ? await probeAuthentication(manifest.runtime, runtime.path)
        : { status: "unknown" as const, message: null };
      const liveModels = runtime?.models ?? [];
      const fallbackModels = FALLBACK_MODELS[manifest.runtime] ?? [];
      const models = liveModels.length > 0 ? liveModels : fallbackModels;
      const modelsSource =
        liveModels.length > 0 ? "live" : fallbackModels.length > 0 ? "fallback" : "none";
      const diagnostics: AgentRuntimeCatalogEntry["diagnostics"] = [];
      if (!runtime) {
        diagnostics.push({
          code: "RUNTIME_NOT_DETECTED",
          level: "info",
          message: `${manifest.displayName} was not found on this machine`,
        });
      } else if (!runtime.version) {
        diagnostics.push({
          code: "RUNTIME_VERSION_PROBE_FAILED",
          level: "warning",
          message: "The executable was detected, but its version command did not complete",
        });
      }
      if (modelsSource === "fallback") {
        diagnostics.push({
          code: "RUNTIME_MODELS_FALLBACK",
          level: "warning",
          message: "Live model discovery was unavailable; showing fallback model hints",
        });
      }
      if (authentication.status === "unauthenticated" || authentication.status === "error") {
        diagnostics.push({
          code: "RUNTIME_AUTHENTICATION_REQUIRED",
          level: authentication.status === "error" ? "warning" : "error",
          message: authentication.message ?? "CLI authentication could not be verified",
        });
      }
      if (manifest.diagnostic) {
        diagnostics.push({
          code: "RUNTIME_MANIFEST_DIAGNOSTIC",
          level: "info",
          message: manifest.diagnostic,
        });
      }

      return {
        runtime: manifest.runtime,
        displayName: manifest.displayName,
        runtimeConfigId: runtime ? getLocalAgentRuntimeId(manifest.runtime) : null,
        availability: runtime ? (runtime.version ? "launchable" : "detected") : "unavailable",
        binaryName:
          runtime?.binaryName ?? configuredBinaries[manifest.runtime] ?? manifest.binaries[0]!,
        path: runtime?.path ?? null,
        version: runtime?.version ?? null,
        authenticationStatus: authentication.status,
        authenticationMessage: authentication.message,
        diagnostics,
        models,
        modelsSource,
        supportsCustomModel: manifest.supportsCustomModel ?? false,
        compatibility: manifest,
      };
    }),
  );
};

import type { AgentRuntimeCatalogEntry, AgentRuntimeConfig } from "@repo/schemas";
import { RUNTIME_MANIFESTS } from "../runtime/runtimeManifestRegistry";

/**
 * Builds a non-blocking catalog seed from the last successfully persisted local
 * runtime scan. Authentication remains unknown until the background live probe
 * replaces this projection.
 */
export const projectRuntimeCatalogFromConfigs = (
  runtimes: readonly AgentRuntimeConfig[],
): AgentRuntimeCatalogEntry[] =>
  RUNTIME_MANIFESTS.map((manifest) => {
    const runtime = runtimes.find(
      (candidate) => candidate.type === manifest.runtime && candidate.connection.mode === "local",
    );
    const connection = runtime?.connection.mode === "local" ? runtime.connection : undefined;
    const models = connection?.models ?? [];
    const diagnostics: AgentRuntimeCatalogEntry["diagnostics"] = runtime
      ? [
          {
            code: "RUNTIME_CATALOG_CACHED",
            level: "info",
            message: "Showing the last saved runtime detection while live probes refresh",
          },
        ]
      : [
          {
            code: "RUNTIME_NOT_DETECTED",
            level: "info",
            message: `${manifest.displayName} was not found in the saved runtime catalog`,
          },
        ];
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
      runtimeConfigId: runtime?.id ?? null,
      availability: connection?.path
        ? connection.version
          ? "launchable"
          : "detected"
        : "unavailable",
      binaryName: connection?.binaryName ?? manifest.binaries[0]!,
      path: connection?.path ?? null,
      version: connection?.version ?? null,
      authenticationStatus: "unknown",
      authenticationMessage: null,
      diagnostics,
      models,
      modelsSource: connection?.modelsSource ?? (models.length > 0 ? "fallback" : "none"),
      supportsCustomModel: manifest.supportsCustomModel ?? false,
      compatibility: runtime?.compatibility ?? manifest,
    };
  });

import { createHash } from "node:crypto";

import { isAbsolute } from "node:path";

import { getRuntimeManifest } from "@repo/agent";

import { ResultAsync } from "neverthrow";

import type { ResolvedRuntime, RuntimeExecutableResolutionInput } from "../../contracts";

import { toError } from "../toError";

export const resolveRuntimeExecutable = async ({
  runtime,
  configuredPath,
  configuredVersion,
  detectedPath,
  detectedVersion,
  readExecutable,
  probeCapabilities,
}: RuntimeExecutableResolutionInput): Promise<ResolvedRuntime> => {
  const duplicateDetectedPath =
    Boolean(configuredPath && detectedPath) &&
    (process.platform === "win32"
      ? detectedPath?.toLowerCase() === configuredPath?.toLowerCase()
      : detectedPath === configuredPath);
  const candidates = [
    ...(configuredPath
      ? [
          {
            path: configuredPath,
            version:
              configuredVersion ?? (duplicateDetectedPath ? detectedVersion : undefined) ?? null,
            source: "configured" as const,
          },
        ]
      : []),
    ...(detectedPath && !duplicateDetectedPath
      ? [{ path: detectedPath, version: detectedVersion ?? null, source: "detected" as const }]
      : []),
  ];
  const failures: string[] = [];

  for (const candidate of candidates) {
    if (!isAbsolute(candidate.path)) {
      failures.push(`${candidate.source} path is not absolute: ${candidate.path}`);
      continue;
    }
    const bytesResult = await ResultAsync.fromPromise(readExecutable(candidate.path), toError);
    if (bytesResult.isErr()) {
      failures.push(
        `${candidate.source} path is not readable: ${candidate.path} (${bytesResult.error.message})`,
      );
      continue;
    }
    const capabilitiesResult = await ResultAsync.fromPromise(
      probeCapabilities({ runtime, path: candidate.path }),
      toError,
    );
    if (capabilitiesResult.isErr()) {
      failures.push(
        `${candidate.source} path capability probe failed: ${candidate.path} (${capabilitiesResult.error.message})`,
      );
      continue;
    }
    const capabilities = capabilitiesResult.value;
    const manifest = getRuntimeManifest(runtime);
    const missingCapabilities = [
      capabilities.structuredOutput ? null : "structured_output",
      capabilities.resume ? null : "native_resume",
      runtime !== "claude-code" || capabilities.sessionId ? null : "session_id",
    ].filter((value): value is string => value !== null);
    if (missingCapabilities.length > 0) {
      failures.push(
        `${candidate.source} path is missing ${missingCapabilities.join(", ")}: ${candidate.path}`,
      );
      continue;
    }

    return {
      path: candidate.path,
      version: candidate.version,
      fingerprint: createHash("sha256").update(bytesResult.value).digest("hex"),
      resolutionWarning:
        candidate.source === "detected" && configuredPath
          ? `Configured ${runtime} executable was unusable; ORDINE selected the freshly detected PATH executable ${candidate.path}.`
          : null,
      supportsPartialMessages: capabilities.partialMessages,
      supportsPermissionBypass: capabilities.skipPermissions,
      supportsReasoningEffort: capabilities.reasoningEffort,
      supportsVariant: capabilities.variant,
      supportsAutoPermissions: capabilities.autoPermissions,
      supportsResume: capabilities.resume,
      runtimeCapabilities: {
        ...manifest.capabilities,
        textStreaming: capabilities.partialMessages ? "delta" : manifest.capabilities.textStreaming,
        cancellation:
          manifest.capabilities.cancellation === "none"
            ? "none"
            : manifest.capabilities.cancellation,
        resume: capabilities.resume ? manifest.capabilities.resume : "none",
        pause: "none",
      },
    };
  }

  throw new Error(
    candidates.length === 0
      ? `Absolute executable path is unavailable for ${runtime}`
      : `No usable ${runtime} executable was found. ${failures.join("; ")}`,
  );
};

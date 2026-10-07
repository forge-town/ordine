import type { Connector, UpdateConnectorPatch } from "../persistIfConfigUnchanged";
import { denyManualConnected } from "../denyManualConnected";

/**
 * A config or method edit invalidates any previous handshake: status falls back
 * to needs_setup, client-supplied tools are stripped, and lastSyncAt is cleared.
 * Only a real handshake (connect()) may backfill tools and lastSyncAt.
 */
export const sanitizeUpdatePatch = (
  patch: UpdateConnectorPatch,
  current: Connector,
): UpdateConnectorPatch => {
  const sanitized = denyManualConnected(patch);
  const configChanged = sanitized.config !== undefined;
  const methodChanged = sanitized.method !== undefined && sanitized.method !== current.method;

  if (!configChanged && !methodChanged) return { ...sanitized, origin: "manual" };

  const config = configChanged
    ? { ...(sanitized.config as Record<string, unknown>) }
    : { ...(current.config as Record<string, unknown>) };
  delete config.tools;
  delete config.lastError;

  return {
    ...sanitized,
    config,
    status: "needs_setup",
    origin: "manual",
    signature: null,
    sources: [],
    encryptedCredentials: {},
    lastSyncAt: null,
  };
};

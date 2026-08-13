import type { CapabilitySource } from "@repo/schemas";
import { describe, expect, it } from "vitest";
import { createCredentialCipher } from "./credentialCipher";
import {
  hydrateConnectorCredentials,
  omitEncryptedConnectorCredentials,
} from "./hydrateConnectorCredentials";

const source = (
  sourceKey: string,
  runtime: "claude-code" | "codex",
  overrides: Partial<CapabilitySource> = {},
): CapabilitySource => ({
  sourceKey,
  source: runtime,
  scope: "global",
  path: `/home/test/.${runtime}/config`,
  nativeName: "github",
  enabled: true,
  lastSeenAt: "2026-08-13T00:00:00.000Z",
  ...overrides,
});

const encrypted = (sourceKey: string, value: string) => {
  const cipher = createCredentialCipher("unit-test-encryption-key");
  expect(cipher.isOk()).toBe(true);
  if (cipher.isErr()) throw cipher.error;
  const envelope = cipher.value.encrypt(sourceKey, {
    headers: { Authorization: value },
  });
  expect(envelope.isOk()).toBe(true);
  if (envelope.isErr()) throw envelope.error;

  return envelope.value;
};

describe("hydrateConnectorCredentials", () => {
  it("decrypts only the preferred runtime source into the ephemeral config", () => {
    const result = hydrateConnectorCredentials(
      {
        config: { transport: "http", url: "https://example.test/mcp" },
        sources: [source("claude-source", "claude-code"), source("codex-source", "codex")],
        encryptedCredentials: {
          "claude-source": encrypted("claude-source", "Bearer claude-value"),
          "codex-source": encrypted("codex-source", "Bearer codex-value"),
        },
      },
      {
        encryptionSecret: "unit-test-encryption-key",
        preferredSource: "codex",
      },
    );

    expect(result._unsafeUnwrap()).toEqual({
      transport: "http",
      url: "https://example.test/mcp",
      headers: { Authorization: "Bearer codex-value" },
    });
  });

  it("refreshes referenced environment values at execution time", () => {
    const result = hydrateConnectorCredentials(
      {
        config: { transport: "stdio", command: "mcp-server" },
        sources: [
          source("codex-source", "codex", {
            credentialReferences: { env: { ACCESS_TOKEN: "CURRENT_ACCESS_TOKEN" } },
          }),
        ],
        encryptedCredentials: {},
      },
      { env: { CURRENT_ACCESS_TOKEN: "runtime-value" } },
    );

    expect(result._unsafeUnwrap()).toMatchObject({
      env: { ACCESS_TOKEN: "runtime-value" },
    });
  });

  it("formats bearer token references as an authorization header", () => {
    const result = hydrateConnectorCredentials(
      {
        config: { transport: "http", url: "https://example.test/mcp" },
        sources: [
          source("codex-source", "codex", {
            credentialReferences: { bearerTokenEnv: "CURRENT_ACCESS_TOKEN" },
          }),
        ],
        encryptedCredentials: {},
      },
      { env: { CURRENT_ACCESS_TOKEN: "runtime-token" } },
    );

    expect(result._unsafeUnwrap()).toMatchObject({
      headers: { Authorization: "Bearer runtime-token" },
    });
  });

  it("fails closed when encrypted credentials cannot be decrypted", () => {
    const result = hydrateConnectorCredentials({
      config: { transport: "http", url: "https://example.test/mcp" },
      sources: [source("codex-source", "codex")],
      encryptedCredentials: {
        "codex-source": encrypted("codex-source", "Bearer protected"),
      },
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().message).toContain("decryption is unavailable");
  });

  it("does not execute a harvested connector whose only source is disabled", () => {
    const result = hydrateConnectorCredentials({
      origin: "harvested",
      config: { transport: "http", url: "https://example.test/mcp" },
      sources: [source("codex-source", "codex", { enabled: false })],
      encryptedCredentials: {},
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().message).toContain("No enabled capability source");
  });

  it("removes encrypted credential envelopes from public connector output", () => {
    const publicConnector = omitEncryptedConnectorCredentials({
      id: "connector-1",
      name: "github",
      encryptedCredentials: { source: { ciphertext: "opaque" } },
    });

    expect(publicConnector).toEqual({ id: "connector-1", name: "github" });
    expect(publicConnector).not.toHaveProperty("encryptedCredentials");
  });
});

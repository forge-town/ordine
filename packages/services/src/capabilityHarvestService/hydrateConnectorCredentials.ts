import type { CapabilityCredentials } from "@repo/agent";
import {
  isMcpConnectorConfig,
  type CapabilityCredentialReferences,
  type CapabilityOrigin,
  type CapabilitySource,
  type CapabilitySourceId,
  type ConnectorConfig,
  type EncryptedCredentialMap,
} from "@repo/schemas";
import { err, ok, type Result } from "neverthrow";
import { createCredentialCipher, CredentialCipherError } from "./credentialCipher";

type ConnectorWithCredentials = {
  config: ConnectorConfig;
  origin?: CapabilityOrigin;
  sources: CapabilitySource[];
  encryptedCredentials: EncryptedCredentialMap;
};

export interface ConnectorCredentialHydrationOptions {
  encryptionSecret?: string;
  env?: Readonly<Record<string, string | undefined>>;
  preferredSource?: CapabilitySourceId;
  sourceKey?: string;
}

const resolveReferences = (
  references: CapabilityCredentialReferences | undefined,
  env: Readonly<Record<string, string | undefined>>,
) => {
  const bearerToken = references?.bearerTokenEnv ? env[references.bearerTokenEnv] : undefined;

  return {
    env: Object.fromEntries(
      Object.entries(references?.env ?? {}).flatMap(([target, envName]) => {
        const value = env[envName];

        return value === undefined ? [] : [[target, value]];
      }),
    ),
    headers: {
      ...Object.fromEntries(
        Object.entries(references?.headers ?? {}).flatMap(([target, envName]) => {
          const value = env[envName];

          return value === undefined ? [] : [[target, value]];
        }),
      ),
      ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
    },
  };
};

const sourceScore = (
  source: CapabilitySource,
  connector: ConnectorWithCredentials,
  preferredSource: CapabilitySourceId | undefined,
): number =>
  (source.source === preferredSource ? 8 : 0) +
  (source.enabled ? 4 : 0) +
  (source.scope === "workspace" ? 2 : 0) +
  (connector.encryptedCredentials[source.sourceKey] ? 1 : 0);

const selectSource = (
  connector: ConnectorWithCredentials,
  options: ConnectorCredentialHydrationOptions,
): Result<CapabilitySource | undefined, CredentialCipherError> => {
  if (options.sourceKey) {
    const exact = connector.sources.find((source) => source.sourceKey === options.sourceKey);

    return exact?.enabled
      ? ok(exact)
      : err(new CredentialCipherError("Selected capability source is not enabled"));
  }

  return ok(
    connector.sources
      .filter((source) => source.enabled)
      .sort(
        (left, right) =>
          sourceScore(right, connector, options.preferredSource) -
            sourceScore(left, connector, options.preferredSource) ||
          left.sourceKey.localeCompare(right.sourceKey),
      )[0],
  );
};

/**
 * Adds one selected source's credentials to an MCP config in memory. The
 * returned config is for the current handshake/run only and must never be
 * persisted or returned from an API.
 */
export const hydrateConnectorCredentials = (
  connector: ConnectorWithCredentials,
  options: ConnectorCredentialHydrationOptions = {},
): Result<ConnectorConfig, CredentialCipherError> => {
  if (!isMcpConnectorConfig(connector.config)) return ok(connector.config);

  const selected = selectSource(connector, options);
  if (selected.isErr()) return err(selected.error);
  const source = selected.value;
  if (!source) {
    return connector.sources.length === 0 || connector.origin === "manual"
      ? ok(connector.config)
      : err(new CredentialCipherError("No enabled capability source is available"));
  }

  const envelope = connector.encryptedCredentials[source.sourceKey];
  if (envelope && options.encryptionSecret === undefined) {
    return err(new CredentialCipherError("Capability credential decryption is unavailable"));
  }

  const decrypted: Result<CapabilityCredentials, CredentialCipherError> = envelope
    ? createCredentialCipher(options.encryptionSecret ?? "").andThen((cipher) =>
        cipher.decrypt(source.sourceKey, envelope),
      )
    : ok({});
  if (decrypted.isErr()) return err(decrypted.error);

  const references = resolveReferences(source.credentialReferences, options.env ?? process.env);
  if (connector.config.transport === "stdio") {
    const environment = {
      ...decrypted.value.env,
      ...references.env,
      ...connector.config.env,
    };

    return ok({
      ...connector.config,
      ...(Object.keys(environment).length > 0 ? { env: environment } : {}),
    });
  }

  const headers = {
    ...decrypted.value.headers,
    ...references.headers,
    ...connector.config.headers,
  };

  return ok({
    ...connector.config,
    ...(Object.keys(headers).length > 0 ? { headers } : {}),
  });
};

export const omitEncryptedConnectorCredentials = <T extends { encryptedCredentials: unknown }>(
  connector: T,
): Omit<T, "encryptedCredentials"> => {
  const { encryptedCredentials, ...publicConnector } = connector;
  void encryptedCredentials;

  return publicConnector;
};

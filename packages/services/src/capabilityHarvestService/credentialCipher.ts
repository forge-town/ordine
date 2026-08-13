import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import {
  EncryptedCredentialEnvelopeSchema,
  EncryptedCredentialMapSchema,
  type EncryptedCredentialEnvelope,
  type EncryptedCredentialMap,
} from "@repo/schemas";
import { CapabilityCredentialsSchema, type CapabilityCredentials } from "@repo/agent";
import { err, ok, Result, type Result as NeverthrowResult } from "neverthrow";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const KEY_BYTES = 32;
const KEY_SALT = "ordine/capability-harvest/v1";
const KEY_INFO = "runtime-capability-credentials";

export class CredentialCipherError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "CredentialCipherError";
  }
}

const deriveKey = (secret: string): NeverthrowResult<Buffer, CredentialCipherError> =>
  secret.trim().length === 0
    ? err(new CredentialCipherError("Credential encryption secret is not configured"))
    : ok(
        Buffer.from(
          hkdfSync(
            "sha256",
            Buffer.from(secret, "utf8"),
            Buffer.from(KEY_SALT, "utf8"),
            Buffer.from(KEY_INFO, "utf8"),
            KEY_BYTES,
          ),
        ),
      );

export interface CredentialCipher {
  encrypt: (
    sourceKey: string,
    credentials: CapabilityCredentials,
  ) => NeverthrowResult<EncryptedCredentialEnvelope, CredentialCipherError>;
  decrypt: (
    sourceKey: string,
    envelope: EncryptedCredentialEnvelope,
  ) => NeverthrowResult<CapabilityCredentials, CredentialCipherError>;
  encryptMap: (
    credentials: Record<string, CapabilityCredentials>,
  ) => NeverthrowResult<EncryptedCredentialMap, CredentialCipherError>;
}

export const createCredentialCipher = (
  secret: string,
): NeverthrowResult<CredentialCipher, CredentialCipherError> =>
  deriveKey(secret).map((key) => {
    const encrypt = (
      sourceKey: string,
      credentials: CapabilityCredentials,
    ): NeverthrowResult<EncryptedCredentialEnvelope, CredentialCipherError> =>
      Result.fromThrowable(
        () => {
          const validated = CapabilityCredentialsSchema.parse(credentials);
          const iv = randomBytes(IV_BYTES);
          const cipher = createCipheriv(ALGORITHM, key, iv);
          cipher.setAAD(Buffer.from(sourceKey, "utf8"));
          const ciphertext = Buffer.concat([
            cipher.update(JSON.stringify(validated), "utf8"),
            cipher.final(),
          ]);

          return EncryptedCredentialEnvelopeSchema.parse({
            version: 1,
            algorithm: ALGORITHM,
            iv: iv.toString("base64"),
            ciphertext: ciphertext.toString("base64"),
            authTag: cipher.getAuthTag().toString("base64"),
          });
        },
        (cause) => new CredentialCipherError("Unable to encrypt capability credentials", cause),
      )();

    const decrypt = (
      sourceKey: string,
      envelope: EncryptedCredentialEnvelope,
    ): NeverthrowResult<CapabilityCredentials, CredentialCipherError> =>
      Result.fromThrowable(
        () => {
          const validated = EncryptedCredentialEnvelopeSchema.parse(envelope);
          const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(validated.iv, "base64"));
          decipher.setAAD(Buffer.from(sourceKey, "utf8"));
          decipher.setAuthTag(Buffer.from(validated.authTag, "base64"));
          const plaintext = Buffer.concat([
            decipher.update(Buffer.from(validated.ciphertext, "base64")),
            decipher.final(),
          ]).toString("utf8");

          return CapabilityCredentialsSchema.parse(JSON.parse(plaintext) as unknown);
        },
        (cause) => new CredentialCipherError("Unable to decrypt capability credentials", cause),
      )();

    const encryptMap = (
      credentials: Record<string, CapabilityCredentials>,
    ): NeverthrowResult<EncryptedCredentialMap, CredentialCipherError> => {
      const encrypted: EncryptedCredentialMap = {};
      for (const [sourceKey, value] of Object.entries(credentials)) {
        const result = encrypt(sourceKey, value);
        if (result.isErr()) return err(result.error);
        encrypted[sourceKey] = result.value;
      }

      return ok(EncryptedCredentialMapSchema.parse(encrypted));
    };

    return { encrypt, decrypt, encryptMap };
  });

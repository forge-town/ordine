import { describe, expect, it } from "vitest";
import { createCredentialCipher } from "./credentialCipher";

describe("credentialCipher", () => {
  it("round-trips credentials without exposing plaintext in the envelope", () => {
    const cipher = createCredentialCipher("test-only-secret-with-enough-entropy")._unsafeUnwrap();
    const credentials = {
      env: { PRIVATE_TOKEN: "plain-env-value" },
      headers: { Authorization: "Bearer plain-header-value" },
    };
    const encrypted = cipher.encrypt("source-key", credentials)._unsafeUnwrap();

    expect(JSON.stringify(encrypted)).not.toContain("plain-env-value");
    expect(JSON.stringify(encrypted)).not.toContain("plain-header-value");
    expect(cipher.decrypt("source-key", encrypted)._unsafeUnwrap()).toEqual(credentials);
  });

  it("uses a fresh IV for each encryption", () => {
    const cipher = createCredentialCipher("test-only-secret-with-enough-entropy")._unsafeUnwrap();
    const first = cipher.encrypt("source-key", { env: { TOKEN: "value" } })._unsafeUnwrap();
    const second = cipher.encrypt("source-key", { env: { TOKEN: "value" } })._unsafeUnwrap();

    expect(first.iv).not.toBe(second.iv);
    expect(first.ciphertext).not.toBe(second.ciphertext);
  });

  it("rejects the wrong source binding, wrong secret, and an empty secret", () => {
    const cipher = createCredentialCipher("correct-secret")._unsafeUnwrap();
    const encrypted = cipher.encrypt("source-a", { env: { TOKEN: "value" } })._unsafeUnwrap();
    const wrongCipher = createCredentialCipher("wrong-secret")._unsafeUnwrap();

    expect(cipher.decrypt("source-b", encrypted).isErr()).toBe(true);
    expect(wrongCipher.decrypt("source-a", encrypted).isErr()).toBe(true);
    expect(createCredentialCipher(" ").isErr()).toBe(true);
  });

  it("encrypts a source-keyed credential map", () => {
    const cipher = createCredentialCipher("test-only-secret-with-enough-entropy")._unsafeUnwrap();
    const encrypted = cipher
      .encryptMap({
        "source-one": { env: { TOKEN: "one" } },
        "source-two": { headers: { Authorization: "two" } },
      })
      ._unsafeUnwrap();

    expect(Object.keys(encrypted)).toEqual(["source-one", "source-two"]);
    expect(cipher.decrypt("source-one", encrypted["source-one"]!)._unsafeUnwrap()).toEqual({
      env: { TOKEN: "one" },
    });
  });
});

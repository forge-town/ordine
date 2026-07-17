import { describe, expect, it } from "vitest";
import { runMastra } from "./runMastra";

describe("runMastra with Kimi", () => {
  const apiKey = process.env.KIMI_API_KEY;

  it.skipIf(!apiKey)("returns text from Kimi model", async () => {
    const result = await runMastra({
      systemPrompt: "You are a helpful assistant.",
      userPrompt: "Say exactly the word 'pong' and nothing else.",
      cwd: process.cwd(),
      apiKey,
      model: "kimi-k2-0711-preview",
      timeoutMs: 60_000,
    });

    expect(result.text.length).toBeGreaterThan(0);
    expect(result.events).toEqual([]);
  });

  it.skipIf(!apiKey)("respects custom system prompt", async () => {
    const result = await runMastra({
      systemPrompt: "You only respond in lowercase.",
      userPrompt: "Say HELLO.",
      cwd: process.cwd(),
      apiKey,
      model: "kimi-k2-0711-preview",
      timeoutMs: 60_000,
    });

    expect(result.text.length).toBeGreaterThan(0);
  });

  // With no key configured, the default Kimi model must fail fast with a clear,
  // actionable message — assert the real message, not an environment-dependent
  // SDK string. If this machine happens to have KIMI_API_KEY set, the missing-key
  // path cannot trigger, so skip (mirrors the skipIf on the two tests above).
  it.skipIf(apiKey)("throws a clear error when KIMI_API_KEY is missing", async () => {
    await expect(
      runMastra({
        systemPrompt: "sys",
        userPrompt: "user",
        cwd: process.cwd(),
        timeoutMs: 1000,
      }),
    ).rejects.toThrow(/KIMI_API_KEY is not configured/);
  });
});

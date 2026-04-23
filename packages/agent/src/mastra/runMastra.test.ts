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

  it("falls back to string model when apiKey is missing", async () => {
    await expect(
      runMastra({
        systemPrompt: "sys",
        userPrompt: "user",
        cwd: process.cwd(),
        timeoutMs: 1_000,
      }),
    ).rejects.toThrow(/Failed to resolve model configuration/);
  });
});

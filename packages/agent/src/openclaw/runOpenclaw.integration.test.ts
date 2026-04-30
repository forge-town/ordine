/**
 * Integration test for the OpenClaw agent driver.
 *
 * Prerequisites:
 *   - `openclaw` CLI installed and on PATH
 *   - OpenClaw gateway running
 *
 * Usage:
 *   OPENCLAW_INTEGRATION=1 bunx vitest run packages/agent/src/openclaw/runOpenclaw.integration.test.ts
 *
 * This test is NOT included in the CI quality pipeline — it requires
 * a live OpenClaw instance. Run it manually to verify end-to-end.
 */
import { describe, expect, it } from "vitest";
import { runOpenclaw } from "./runOpenclaw";

const SKIP = !process.env["OPENCLAW_INTEGRATION"];

describe.skipIf(SKIP)("runOpenclaw integration", () => {
  it("runs a simple prompt and returns text", { timeout: 120_000 }, async () => {
    const progress: string[] = [];
    const result = await runOpenclaw({
      systemPrompt: "You are a concise assistant. Answer in one word only.",
      userPrompt: "What is 2 + 2?",
      cwd: process.cwd(),
      sessionId: `ordine-integration-${Date.now()}`,
      onProgress: (line) => {
        progress.push(line);
      },
    });

    console.log("runId:", result.runId);
    console.log("text:", result.text);
    console.log("meta.durationMs:", result.meta.durationMs);
    console.log("meta.stopReason:", result.meta.stopReason);

    expect(result.text).toBeTruthy();
    expect(result.text.length).toBeGreaterThan(0);
    expect(result.runId).toBeTruthy();
    expect(progress.length).toBeGreaterThan(0);
  });
});

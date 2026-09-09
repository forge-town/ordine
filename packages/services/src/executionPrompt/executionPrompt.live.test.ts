import { rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, dirname, basename } from "node:path";
import { it, expect } from "vitest";
import { ok } from "neverthrow";
import type { RuntimeEvent } from "@repo/schemas";
import { createExecutionPromptActor } from "./index";
import { promptFixture } from "./testSupport";

it.runIf(!!process.env.ORDINE_PROMPT_LIVE_CODEX)(
  "executes a frozen native Codex binary against the real model and persists bounded events",
  async () => {
    const fixture = await promptFixture(process.env.ORDINE_PROMPT_LIVE_CODEX!, "gpt-5.6-luna");
    const events: RuntimeEvent[] = [];
    const result = await createExecutionPromptActor({
      artifactStore: fixture.store,
      onRuntimeEvent: async (_context, event) => {
        events.push(event);

        return ok(undefined);
      },
    }).execute(fixture.context);
    if (process.env.ORDINE_PROMPT_LIVE_EVIDENCE)
      await writeFile(
        process.env.ORDINE_PROMPT_LIVE_EVIDENCE,
        JSON.stringify(
          {
            result: result.isOk()
              ? { ok: true, outputs: result.value }
              : { ok: false, error: result.error },
            events,
          },
          null,
          2,
        ),
        { encoding: "utf8" },
      );
    const path = resolve(fixture.directory);
    if (dirname(path) !== resolve(tmpdir()) || !basename(path).startsWith("ordine-prompt-test-"))
      throw new Error("Unsafe fixture cleanup path");
    await rm(path, { recursive: true, force: true });
    expect(result.isOk(), result.isErr() ? JSON.stringify(result.error) : "success").toBe(true);
    if (result.isOk())
      expect(result.value.out).toEqual([{ kind: "json", value: { proof: "v2-live-ok" } }]);
    expect(events.some((event) => event.type === "usage")).toBe(true);
    expect(events.some((event) => event.type === "session")).toBe(true);
    expect(events.at(-1)).toMatchObject({ type: "terminal", status: "completed" });
  },
  240_000,
);

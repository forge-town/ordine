import { expect, it } from "vitest";
import { ok } from "neverthrow";
import type { RuntimeEvent } from "@repo/schemas";
import { createCodexStream } from "./codexStream";
import { ExecutionPromptLimitsSchema } from "./types";

const transcript = () =>
  [
    { type: "thread.started", thread_id: "session" },
    { type: "turn.started" },
    { type: "item.completed", item: { id: "message", type: "agent_message", text: "完整中文" } },
    { type: "turn.completed", usage: { input_tokens: 1, output_tokens: 2 } },
  ]
    .map((event) => JSON.stringify(event))
    .join("\n") + "\n";

it("preserves UTF-8 text across byte-split JSONL chunks and sequences persisted events", async () => {
  const events: RuntimeEvent[] = [];
  const stream = createCodexStream({
    limits: ExecutionPromptLimitsSchema.parse({}),
    abort: () => {},
    onEvent: async (event) => {
      events.push(event);

      return ok(undefined);
    },
  });
  for (const byte of Buffer.from(transcript()))
    expect(stream.consume(Buffer.from([byte])).isOk()).toBe(true);
  expect(stream.completion().text).toBe("完整中文");
  const delivered = await stream.settle();
  expect(delivered.isOk()).toBe(true);
  expect(events.map((event) => event.sequence)).toEqual([0, 1, 2, 3]);
  expect(stream.hasFirstOutput()).toBe(true);
});

it("does not treat session initialization as first model output", () => {
  const stream = createCodexStream({
    limits: ExecutionPromptLimitsSchema.parse({}),
    abort: () => {},
  });
  expect(
    stream
      .consume(
        Buffer.from('{"type":"thread.started","thread_id":"session"}\n{"type":"turn.started"}\n'),
      )
      .isOk(),
  ).toBe(true);
  expect(stream.hasFirstOutput()).toBe(false);
});

it("fails on event size and count limits without accepting a partial result", () => {
  for (const limits of [{ maxEventBytes: 16 }, { maxEvents: 1 }]) {
    const stream = createCodexStream({
      limits: ExecutionPromptLimitsSchema.parse(limits),
      abort: () => {},
    });
    const result = stream.consume(Buffer.from(transcript()));
    expect(result.isErr() ? result.error.code : "success").toBe("PROMPT_EVENT_LIMIT");
  }
});

it("redacts selected-provider secrets from runtime error diagnostics", async () => {
  const events: RuntimeEvent[] = [];
  const stream = createCodexStream({
    limits: ExecutionPromptLimitsSchema.parse({}),
    abort: () => {},
    redact: (text) => text.replaceAll("fixture-secret", "[redacted]"),
    onEvent: async (event) => {
      events.push(event);

      return ok(undefined);
    },
  });
  const result = stream.consume(
    Buffer.from('{"type":"error","message":"Rejected fixture-secret"}\n'),
  );
  expect(result.isErr() ? result.error.message : "success").toBe("Rejected [redacted]");
  await stream.settle();
  expect(JSON.stringify(events)).not.toContain("fixture-secret");
});

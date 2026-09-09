import { describe, expect, it, vi } from "vitest";
import { readExecutionJson } from "../../src/execution/body";

const streamRequest = (body: ReadableStream<Uint8Array>, headers: Record<string, string> = {}) =>
  new Request("http://localhost/api/v2/run-requests", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body,
    duplex: "half",
  } as RequestInit);

describe("execution bounded request reader", () => {
  it("counts streamed bytes independently from an understated content length and cancels excess", async () => {
    const cancelled = vi.fn();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"value":"'));
        controller.enqueue(new Uint8Array(50));
      },
      cancel: cancelled,
    });
    const result = await readExecutionJson(streamRequest(stream, { "Content-Length": "1" }), 32);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.code).toBe("EXECUTION_BODY_TOO_LARGE");
    expect(cancelled).toHaveBeenCalledOnce();
  });
  it("returns a bounded safe error for a failing body stream", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.error(new Error("C:/private/secret"));
      },
    });
    const result = await readExecutionJson(streamRequest(stream));
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("EXECUTION_BODY_UNREADABLE");
      expect(result.error.message).not.toContain("private");
    }
  });
  it("decodes UTF-8 across chunk boundaries without corrupting Chinese input", async () => {
    const bytes = new TextEncoder().encode(JSON.stringify({ text: "执行输入" }));
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const byte of bytes) controller.enqueue(Uint8Array.of(byte));
        controller.close();
      },
    });
    const result = await readExecutionJson(streamRequest(stream));
    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value).toEqual({ text: "执行输入" });
  });
});

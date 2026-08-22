import { describe, expect, it } from "vitest";
import { createJsonLineDecoder } from "./createJsonLineDecoder";

describe("createJsonLineDecoder", () => {
  it("continues after a malformed frame and drains a final frame", () => {
    const messages: unknown[] = [];
    const malformed: string[] = [];
    const stream = createJsonLineDecoder({
      onMessage: (message) => messages.push(message),
      onMalformed: (diagnostic) => malformed.push(diagnostic.line),
    });

    stream.feed('{"type":"start"}\nnot-json\n{"type":');
    stream.feed('"done"}');
    stream.flush();

    expect(messages).toEqual([{ type: "start" }, { type: "done" }]);
    expect(malformed).toEqual(["not-json"]);
  });
});

import { describe, expect, it } from "vitest";
import { createLineDecoder } from "./createLineDecoder";

describe("createLineDecoder", () => {
  it("preserves UTF-8 code points split across chunks", () => {
    const lines: string[] = [];
    const stream = createLineDecoder((line) => lines.push(line));
    const encoded = new TextEncoder().encode("你好🙂\n完成");

    stream.feed(encoded.slice(0, 5));
    stream.feed(encoded.slice(5, 9));
    stream.feed(encoded.slice(9));
    stream.flush();

    expect(lines).toEqual(["你好🙂", "完成"]);
  });

  it("normalizes CRLF and emits a final unterminated line", () => {
    const lines: string[] = [];
    const stream = createLineDecoder((line) => lines.push(line));

    stream.feed("one\r\ntwo");
    stream.flush();

    expect(lines).toEqual(["one", "two"]);
  });
});

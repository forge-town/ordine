import { describe, expect, it } from "vitest";
import { createStructuredOutputTryParseJsonHelper } from "./structuredOutputTryParseJson.helper";
describe("structuredOutputTryParseJson", () => {
  it("retains the runner data and state boundary", () => {
    const parse = createStructuredOutputTryParseJsonHelper({});
    expect(parse({ text: "bad JSON" })).toBeUndefined();
    expect(parse({ text: "null" })).toBeNull();
    expect(parse({ text: '{"result":"done"}' })).toEqual({ result: "done" });
  });
});

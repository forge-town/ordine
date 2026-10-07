import { describe, expect, it } from "vitest";
import { serializeDates } from "./resourceControlSerializeDates.helper";

describe("resourceControlSerializeDates", () => {
  it("retains the Agent Control contract boundary", () => {
    expect(serializeDates({ nested: { at: new Date(0) } })).toEqual({
      nested: { at: new Date(0).toISOString() },
    });
  });
});

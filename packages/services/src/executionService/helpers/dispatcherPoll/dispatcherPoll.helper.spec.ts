import { describe, expect, it } from "vitest";
import { createDispatcherPollHelper } from "./dispatcherPoll.helper";

describe("dispatcherPoll", () => {
  it("keeps the extracted helper factory or function publicly callable", () => {
    expect(createDispatcherPollHelper).toBeTypeOf("function");
  });
});

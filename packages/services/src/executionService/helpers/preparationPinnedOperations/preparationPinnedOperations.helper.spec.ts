import { describe, expect, it } from "vitest";
import { createPreparationPinnedOperationsHelper } from "./preparationPinnedOperations.helper";

describe("preparationPinnedOperations", () => {
  it("keeps the extracted helper factory or function publicly callable", () => {
    expect(createPreparationPinnedOperationsHelper).toBeTypeOf("function");
  });
});

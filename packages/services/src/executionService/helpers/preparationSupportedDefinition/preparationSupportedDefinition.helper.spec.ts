import { describe, expect, it } from "vitest";
import { supportedDefinition } from "./preparationSupportedDefinition.helper";

describe("preparationSupportedDefinition", () => {
  it("keeps the extracted helper factory or function publicly callable", () => {
    expect(supportedDefinition).toBeTypeOf("function");
  });
});

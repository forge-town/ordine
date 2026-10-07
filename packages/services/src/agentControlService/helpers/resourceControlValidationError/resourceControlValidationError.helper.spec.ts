import { describe, expect, it } from "vitest";
import { validationError } from "./resourceControlValidationError.helper";

import { z } from "zod/v4";
describe("resourceControlValidationError", () => {
  it("retains the Agent Control contract boundary", () => {
    const parsed = z.object({ name: z.string().min(1) }).safeParse({ name: "" });
    if (parsed.success) throw new Error("Expected invalid input");
    expect(validationError(parsed.error)).toMatchObject({ retryable: true, field: "name" });
  });
});

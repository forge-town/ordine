import { describe, expect, it } from "vitest";
import { operationConfigValidationMessage } from "./operationConfigValidationMessage.helper";

describe("operationConfigValidationMessage", () => {
  it("preserves catalog validation and presentation boundaries", () => {
    expect(
      operationConfigValidationMessage([{ path: "config.executor", message: "Invalid executor" }]),
    ).toBe("Invalid operation config: config.executor: Invalid executor");
  });
});

import { describe, expect, it } from "vitest";
import { capabilityValidationMessage } from "./capabilityValidationMessage.helper";

describe("capabilityValidationMessage", () => {
  it("preserves catalog validation and presentation boundaries", () => {
    const result = capabilityValidationMessage(
      Array.from({ length: 4 }, (_, index) => ({
        path: `config.${index}`,
        reference: `missing-${index}`,
        expectedKinds: ["skill" as const],
      })),
    );
    expect(result).toContain("+1 more");
    expect(result).toContain("config.0: missing-0");
    expect(result).not.toContain("missing-3");
  });
});

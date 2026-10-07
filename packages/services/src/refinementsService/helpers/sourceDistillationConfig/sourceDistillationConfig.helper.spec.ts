import { describe, expect, it } from "vitest";
import { sourceDistillationConfig } from "./sourceDistillationConfig.helper";
describe("sourceDistillationConfig", () => {
  it("retains the refinement round as the source of the next optimization", () => {
    expect(sourceDistillationConfig().objective).toContain("refinement round");
    expect(sourceDistillationConfig().objective).toContain("next optimization");
  });
});

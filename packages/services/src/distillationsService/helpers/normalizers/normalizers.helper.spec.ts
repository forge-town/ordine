import { describe, expect, it } from "vitest";
import { normalizeDistillationRecord } from "./normalizers.helper";
describe("normalizeDistillationRecord", () => {
  it("normalizes malformed persisted config and result without changing other fields", () => {
    const record = {
      id: "distillation-1",
      config: { objective: 7 },
      result: { type: "unknown" },
      createdAt: new Date(0),
      updatedAt: new Date(0),
    };
    const normalized = normalizeDistillationRecord(record);
    expect(normalized.config.objective).toBe("");
    expect(normalized.result).toBeNull();
    expect(normalized.id).toBe("distillation-1");
    expect(record.config.objective).toBe(7);
  });
});

import { describe, expect, it } from "vitest";
import { isForeignKeyViolation } from "./isForeignKeyViolation.helper";
describe("isForeignKeyViolation", () => {
  it("recognizes only a direct string Postgres foreign-key SQLSTATE", () => {
    expect(isForeignKeyViolation({ code: "23503" })).toBe(true);
    expect(isForeignKeyViolation({ code: "23505" })).toBe(false);
    expect(isForeignKeyViolation({ code: 23_503 })).toBe(false);
    expect(isForeignKeyViolation({ cause: { code: "23503" } })).toBe(false);
    expect(isForeignKeyViolation(null)).toBe(false);
    expect(isForeignKeyViolation("23503")).toBe(false);
  });
});

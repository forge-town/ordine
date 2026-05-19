import { describe, expect, it } from "vitest";
import { classifySchemaCoverage, extractCreatedTableNames } from "../src/migrations";

describe("extractCreatedTableNames", () => {
  it("reads user table names from migration sql", () => {
    const sql = `
      CREATE TABLE "users" (
        "id" text PRIMARY KEY
      );
      --> statement-breakpoint
      CREATE TABLE "sessions" (
        "id" text PRIMARY KEY
      );
      --> statement-breakpoint
      CREATE INDEX "sessions_userId_idx" ON "sessions" USING btree ("user_id");
    `;

    expect(extractCreatedTableNames(sql)).toEqual(["users", "sessions"]);
  });
});

describe("classifySchemaCoverage", () => {
  it("treats a database with no user tables as empty", () => {
    expect(classifySchemaCoverage([], ["users", "sessions"])).toBe("empty");
  });

  it("treats a database with every expected table as complete", () => {
    expect(classifySchemaCoverage(["users", "sessions"], ["users", "sessions"])).toBe("complete");
  });

  it("treats a database with only some expected tables as partial", () => {
    expect(classifySchemaCoverage(["users"], ["users", "sessions"])).toBe("partial");
  });
});

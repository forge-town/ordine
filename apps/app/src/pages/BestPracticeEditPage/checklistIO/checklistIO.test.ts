import { describe, it, expect } from "vitest";
import { toJson, fromJson, toCsv, fromCsv, type ChecklistExportItem } from "./checklistIO";

const sampleItems: ChecklistExportItem[] = [
  {
    title: "Function naming",
    description: "Check camelCase convention",
    checkType: "llm",
    script: null,
    sortOrder: 0,
  },
  {
    title: "File extension",
    description: "All files must be .ts",
    checkType: "script",
    script: 'return files.every(f => f.endsWith(".ts"))',
    sortOrder: 1,
  },
];

describe("checklistIO", () => {
  describe("JSON", () => {
    it("round-trips items through JSON", () => {
      const json = toJson(sampleItems);
      const parsed = fromJson(json);
      expect(parsed).toEqual(sampleItems);
    });

    it("throws on non-array JSON", () => {
      expect(() => fromJson('{"not":"array"}')).toThrow("Expected an array");
    });

    it("defaults missing fields", () => {
      const json = JSON.stringify([{ title: "only title" }]);
      const result = fromJson(json);
      expect(result).toEqual([
        {
          title: "only title",
          description: "",
          checkType: "llm",
          script: null,
          sortOrder: 0,
        },
      ]);
    });
  });

  describe("CSV", () => {
    it("round-trips items through CSV", () => {
      const csv = toCsv(sampleItems);
      const parsed = fromCsv(csv);
      expect(parsed).toEqual([{ ...sampleItems[0], script: null }, { ...sampleItems[1] }]);
    });

    it("handles empty CSV", () => {
      expect(fromCsv("")).toEqual([]);
      expect(fromCsv("title,description,checkType,script,sortOrder")).toEqual([]);
    });

    it("escapes commas and quotes in CSV fields", () => {
      const items: ChecklistExportItem[] = [
        {
          title: 'Check "quotes"',
          description: "Has, commas",
          checkType: "llm",
          script: null,
          sortOrder: 0,
        },
      ];
      const csv = toCsv(items);
      expect(csv).toContain('"Check ""quotes"""');
      expect(csv).toContain('"Has, commas"');

      const parsed = fromCsv(csv);
      expect(parsed[0].title).toBe('Check "quotes"');
      expect(parsed[0].description).toBe("Has, commas");
    });

    it("handles multiline fields in CSV", () => {
      const items: ChecklistExportItem[] = [
        {
          title: "Multi",
          description: "Line 1\nLine 2",
          checkType: "script",
          script: "const x = 1;\nreturn x;",
          sortOrder: 0,
        },
      ];
      const csv = toCsv(items);
      const parsed = fromCsv(csv);
      expect(parsed[0].description).toBe("Line 1\nLine 2");
      expect(parsed[0].script).toBe("const x = 1;\nreturn x;");
    });

    it("defaults invalid checkType to llm", () => {
      const csv = "title,description,checkType,script,sortOrder\nTest,desc,invalid,,0";
      const parsed = fromCsv(csv);
      expect(parsed[0].checkType).toBe("llm");
    });
  });
});

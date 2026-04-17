import { describe, it, expect } from "vitest";
import { RuleCategorySchema, RuleSeveritySchema, RuleScriptLanguageSchema } from "@repo/schemas";
import {
  CATEGORY_CONFIG,
  SEVERITY_CONFIG,
  CATEGORIES,
  SEVERITIES,
  SCRIPT_LANGUAGES,
} from "./types";

describe("RulesPage config ↔ schema sync", () => {
  const allCategories = RuleCategorySchema.options;
  const allSeverities = RuleSeveritySchema.options;
  const allScriptLanguages = RuleScriptLanguageSchema.options;

  it("CATEGORY_CONFIG covers every RuleCategorySchema value", () => {
    for (const cat of allCategories) {
      expect(CATEGORY_CONFIG[cat], `Missing CATEGORY_CONFIG["${cat}"]`).toBeDefined();
      expect(CATEGORY_CONFIG[cat].cls).toBeTruthy();
      expect(CATEGORY_CONFIG[cat].label).toBeTruthy();
    }
  });

  it("CATEGORY_CONFIG has no extra keys beyond RuleCategorySchema", () => {
    const configKeys = Object.keys(CATEGORY_CONFIG);
    for (const key of configKeys) {
      expect(allCategories, `Extra key "${key}" in CATEGORY_CONFIG`).toContain(key);
    }
  });

  it("SEVERITY_CONFIG covers every RuleSeveritySchema value", () => {
    for (const sev of allSeverities) {
      expect(SEVERITY_CONFIG[sev], `Missing SEVERITY_CONFIG["${sev}"]`).toBeDefined();
      expect(SEVERITY_CONFIG[sev].cls).toBeTruthy();
      expect(SEVERITY_CONFIG[sev].label).toBeTruthy();
      expect(SEVERITY_CONFIG[sev].icon).toBeTruthy();
    }
  });

  it("SEVERITY_CONFIG has no extra keys beyond RuleSeveritySchema", () => {
    const configKeys = Object.keys(SEVERITY_CONFIG);
    for (const key of configKeys) {
      expect(allSeverities, `Extra key "${key}" in SEVERITY_CONFIG`).toContain(key);
    }
  });

  it("CATEGORIES array matches RuleCategorySchema values exactly", () => {
    expect([...CATEGORIES].sort()).toEqual([...allCategories].sort());
  });

  it("SEVERITIES array matches RuleSeveritySchema values exactly", () => {
    expect([...SEVERITIES].sort()).toEqual([...allSeverities].sort());
  });

  it("SCRIPT_LANGUAGES matches RuleScriptLanguageSchema values exactly", () => {
    expect([...SCRIPT_LANGUAGES].sort()).toEqual([...allScriptLanguages].sort());
  });
});

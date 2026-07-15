import { homedir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  ANALYZE_SYSTEM_PROMPT,
  buildGenerateSystemPrompt,
  buildOptimizeSystemPrompt,
} from "./prompts";
import { PROPOSE_SYSTEM_PROMPT } from "./proposeActions";

/**
 * Snapshot baselines for the three pipelinesService system prompts. The prompts
 * embed the host home directory, normalized to <HOME> so snapshots stay
 * deterministic across machines. Any wording change shows up in the snapshot diff.
 */
const normalize = (prompt: string): string => prompt.split(homedir()).join("<HOME>");

describe("pipelines prompt snapshots", () => {
  it("generate prompt — with skill references", () => {
    expect(normalize(buildGenerateSystemPrompt("SKILL_REF_DOC"))).toMatchSnapshot();
  });

  it("generate prompt — fallback (no skill references)", () => {
    expect(normalize(buildGenerateSystemPrompt(""))).toMatchSnapshot();
  });

  it("optimize prompt — with skill references", () => {
    expect(normalize(buildOptimizeSystemPrompt("SKILL_REF_DOC"))).toMatchSnapshot();
  });

  it("optimize prompt — fallback (no skill references)", () => {
    expect(normalize(buildOptimizeSystemPrompt(""))).toMatchSnapshot();
  });

  it("analyze prompt is stable", () => {
    expect(ANALYZE_SYSTEM_PROMPT).toMatchSnapshot();
  });

  it("propose prompt is stable", () => {
    expect(PROPOSE_SYSTEM_PROMPT).toMatchSnapshot();
  });

  // Direct assertions (independent of whether .snap files exist yet): key sections must be present.
  it("prompts carry their key section markers", () => {
    expect(buildGenerateSystemPrompt("x")).toContain("=== STRUCTURAL RULES ===");
    expect(buildGenerateSystemPrompt("x")).toContain("=== REFERENCE DOCUMENTATION ===");
    expect(buildGenerateSystemPrompt("")).toContain("=== NODE TYPES ===");
    expect(buildOptimizeSystemPrompt("x")).toContain("=== OPTIMIZATION PRINCIPLES ===");
    expect(ANALYZE_SYSTEM_PROMPT).toContain('"matchedOperations"');
    expect(PROPOSE_SYSTEM_PROMPT).toContain('"actions"');
  });
});

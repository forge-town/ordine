import { homedir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  ANALYZE_SYSTEM_PROMPT,
  buildGenerateSystemPrompt,
  buildOptimizeSystemPrompt,
} from "./prompts";

/**
 * Snapshot baselines for the pipelinesService system prompts. The prompts embed
 * host paths built with path.join, so both the home directory (→ <HOME>) and the
 * platform path separator (\ → /) are normalized to keep snapshots deterministic
 * across machines and platforms. Any wording change shows up in the snapshot diff.
 */
const normalize = (prompt: string): string =>
  prompt.split(homedir()).join("<HOME>").replaceAll("\\", "/");

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

  // The propose system prompt is snapshot-covered next to its builder in
  // proposeActions/buildProposePrompt.snapshot.unit.test.ts.

  // Direct assertions (independent of whether .snap files exist yet): key sections must be present.
  it("prompts carry their key section markers", () => {
    expect(buildGenerateSystemPrompt("x")).toContain("=== STRUCTURAL RULES ===");
    expect(buildGenerateSystemPrompt("x")).toContain("=== REFERENCE DOCUMENTATION ===");
    expect(buildGenerateSystemPrompt("")).toContain("=== NODE TYPES ===");
    expect(buildOptimizeSystemPrompt("x")).toContain("=== OPTIMIZATION PRINCIPLES ===");
    expect(ANALYZE_SYSTEM_PROMPT).toContain('"matchedOperations"');
  });
});

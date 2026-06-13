import { homedir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  ANALYZE_SYSTEM_PROMPT,
  buildGenerateSystemPrompt,
  buildOptimizeSystemPrompt,
} from "./prompts";

/**
 * H2-05：pipelinesService 三条流程系统提示词的快照基线。
 * 提示词内嵌 home 目录，按机器规范化为 <HOME> 以保证快照跨环境确定。
 * 任何 prompt 措辞改动都会在快照 diff 中显现（宿主机首跑生成 .snap）。
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

  // 即时断言（不依赖 .snap 是否已生成）：关键结构段必须在位。
  it("prompts carry their key section markers", () => {
    expect(buildGenerateSystemPrompt("x")).toContain("=== STRUCTURAL RULES ===");
    expect(buildGenerateSystemPrompt("x")).toContain("=== REFERENCE DOCUMENTATION ===");
    expect(buildGenerateSystemPrompt("")).toContain("=== NODE TYPES ===");
    expect(buildOptimizeSystemPrompt("x")).toContain("=== OPTIMIZATION PRINCIPLES ===");
    expect(ANALYZE_SYSTEM_PROMPT).toContain('"matchedOperations"');
  });
});

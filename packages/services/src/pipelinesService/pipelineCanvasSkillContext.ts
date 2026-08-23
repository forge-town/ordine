import "../text-imports.d.ts";

import pipelineSkill from "../../../../skills/ordine-create-pipeline/SKILL.md" with { type: "text" };
import checklistReference from "../../../../skills/ordine-create-pipeline/references/checklist.md" with { type: "text" };
import creationGuideReference from "../../../../skills/ordine-create-pipeline/references/creation-guide.md" with { type: "text" };
import nodeTypesReference from "../../../../skills/ordine-create-pipeline/references/node-types.md" with { type: "text" };
import pipelineAnatomyReference from "../../../../skills/ordine-create-pipeline/references/pipeline-anatomy.md" with { type: "text" };

const stripFrontmatter = (source: string): string =>
  source.replace(/^---\r?\n.*?\r?\n---\r?\n/s, "").trim();

const renderReference = (path: string, content: string): string =>
  [`### Bundled reference: ${path}`, "", content.trim()].join("\n");

/**
 * Canonical Canvas knowledge shared by every Agent path that plans, creates,
 * optimizes, or edits a Pipeline. This mirrors OpenDesign's active-skill prompt
 * composition while keeping the referenced files available to tool-less runs.
 */
export const PIPELINE_CANVAS_SKILL_CONTEXT = [
  "## Active skill — ordine-create-pipeline",
  "",
  "Follow this skill's workflow exactly. Its bundled references are included inline below; read them before planning nodes or edges.",
  "",
  stripFrontmatter(pipelineSkill),
  "",
  renderReference("references/pipeline-anatomy.md", pipelineAnatomyReference),
  "",
  renderReference("references/node-types.md", nodeTypesReference),
  "",
  renderReference("references/creation-guide.md", creationGuideReference),
  "",
  renderReference("references/checklist.md", checklistReference),
].join("\n");

export const withPipelineCanvasSkill = (systemPrompt: string): string =>
  [systemPrompt.trim(), "---", PIPELINE_CANVAS_SKILL_CONTEXT].join("\n\n");

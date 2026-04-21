/**
 * Seed: Spec-Kit Planning Operations
 *
 * Seeds the `operations` table with one operation per spec-kit command verb:
 *   constitution → specify → clarify → plan → analyze → checklist → tasks → implement
 *
 * Each operation's `config` field (JSON string) defines:
 *   - inputs:  what the operation needs to run
 *   - outputs: what the operation produces
 */

import { apiPut } from "../api";

interface OperationSeed {
  id: string;
  name: string;
  description: string;
  acceptedObjectTypes: string[];
  config: OperationConfig;
}

// ─── Config DSL ──────────────────────────────────────────────────────────────

type PortKind = "text" | "file" | "folder" | "project";

interface InputPort {
  name: string;
  kind: PortKind;
  required: boolean;
  description: string;
}

interface OutputPort {
  name: string;
  kind: PortKind;
  path: string;
  description: string;
}

interface ExecutorConfig {
  type: "agent" | "script" | "rule-check";
  agentMode?: "skill" | "prompt";
  skillId?: string;
  prompt?: string;
  command?: string;
  language?: "bash" | "python" | "javascript";
}

interface OperationConfig {
  executor?: ExecutorConfig;
  inputs: InputPort[];
  outputs: OutputPort[];
}

function cfg(config: OperationConfig): OperationConfig {
  return config;
}

// ─── Seed Data ───────────────────────────────────────────────────────────────

const OPERATIONS: OperationSeed[] = [
  // ── 1. constitution ─────────────────────────────────────────────────────
  {
    id: "op_constitution",
    name: "Constitution",
    description:
      "Establish the project's governing principles, architectural constraints, quality standards, and development guidelines that all subsequent work must follow.",
    acceptedObjectTypes: ["project"],
    config: cfg({
      inputs: [
        {
          name: "projectName",
          kind: "text",
          required: true,
          description: "Name of the project being governed.",
        },
        {
          name: "teamContext",
          kind: "text",
          required: false,
          description: "Optional: team size, experience level, and working conventions.",
        },
        {
          name: "techPreferences",
          kind: "text",
          required: false,
          description: "Preferred languages, frameworks, or cloud providers.",
        },
        {
          name: "qualityStandards",
          kind: "text",
          required: false,
          description:
            "Testing requirements, performance targets, accessibility requirements, etc.",
        },
      ],
      outputs: [
        {
          name: "constitutionDocument",
          kind: "file",
          path: ".specify/constitution.md",
          description:
            "Markdown document containing the project's governing principles and guidelines.",
        },
      ],
    }),
  },

  // ── 2. specify ──────────────────────────────────────────────────────────
  {
    id: "op_specify",
    name: "Specify",
    description:
      "Translate a raw feature idea into a structured specification document covering user stories, acceptance criteria, and scope boundaries.",
    acceptedObjectTypes: ["project", "folder"],
    config: cfg({
      inputs: [
        {
          name: "featureDescription",
          kind: "text",
          required: true,
          description: "Free-form description of the feature — what & why, not how.",
        },
        {
          name: "constitutionDocument",
          kind: "file",
          required: false,
          description: "Path to constitution.md so the spec stays within project guidelines.",
        },
      ],
      outputs: [
        {
          name: "specDocument",
          kind: "file",
          path: ".specify/{feature}/spec.md",
          description:
            "Structured specification with goals, user stories, and acceptance criteria.",
        },
      ],
    }),
  },

  // ── 3. clarify ──────────────────────────────────────────────────────────
  {
    id: "op_clarify",
    name: "Clarify",
    description:
      "Identify and resolve ambiguities or underspecified areas in a specification before planning begins.",
    acceptedObjectTypes: ["file"],
    config: cfg({
      inputs: [
        {
          name: "specDocument",
          kind: "file",
          required: true,
          description: "The spec.md to be clarified.",
        },
        {
          name: "clarificationQuestions",
          kind: "text",
          required: false,
          description: "Optional: specific questions or concerns to address during clarification.",
        },
      ],
      outputs: [
        {
          name: "clarifiedSpecDocument",
          kind: "file",
          path: ".specify/{feature}/spec.md",
          description: "Updated spec.md with ambiguities resolved and open questions answered.",
        },
        {
          name: "clarificationLog",
          kind: "file",
          path: ".specify/{feature}/clarifications.md",
          description: "Log of questions raised and decisions made during the clarification pass.",
        },
      ],
    }),
  },

  // ── 4. plan ─────────────────────────────────────────────────────────────
  {
    id: "op_plan",
    name: "Plan",
    description:
      "Produce a detailed technical implementation plan (architecture, data model, API surface, component breakdown) for a specification.",
    acceptedObjectTypes: ["file"],
    config: cfg({
      inputs: [
        {
          name: "specDocument",
          kind: "file",
          required: true,
          description: "The spec.md that defines what to build.",
        },
        {
          name: "techStack",
          kind: "text",
          required: false,
          description:
            "Technology stack and architectural decisions (e.g. 'Next.js 15, Drizzle, PostgreSQL').",
        },
        {
          name: "constitutionDocument",
          kind: "file",
          required: false,
          description: "constitution.md to align the plan with project constraints.",
        },
      ],
      outputs: [
        {
          name: "planDocument",
          kind: "file",
          path: ".specify/{feature}/plan.md",
          description:
            "Technical plan with architecture, data models, API design, and implementation strategy.",
        },
      ],
    }),
  },

  // ── 5. analyze ──────────────────────────────────────────────────────────
  {
    id: "op_analyze",
    name: "Analyze",
    description:
      "Run a cross-artifact consistency and coverage analysis to verify the plan fully satisfies the spec and surface any gaps before task breakdown.",
    acceptedObjectTypes: ["folder"],
    config: cfg({
      inputs: [
        {
          name: "featureFolder",
          kind: "folder",
          required: true,
          description: "The feature folder containing spec.md, plan.md, and any clarifications.",
        },
        {
          name: "constitutionDocument",
          kind: "file",
          required: false,
          description: "constitution.md for constraint alignment checks.",
        },
      ],
      outputs: [
        {
          name: "analysisReport",
          kind: "file",
          path: ".specify/{feature}/analysis.md",
          description: "Report listing coverage gaps, inconsistencies, and recommended fixes.",
        },
      ],
    }),
  },

  // ── 6. checklist ────────────────────────────────────────────────────────
  {
    id: "op_checklist",
    name: "Checklist",
    description:
      "Generate a custom quality checklist validating requirements completeness, clarity, and consistency — like running unit tests against the English spec.",
    acceptedObjectTypes: ["file", "folder"],
    config: cfg({
      inputs: [
        {
          name: "specDocument",
          kind: "file",
          required: true,
          description: "The spec.md to audit.",
        },
        {
          name: "planDocument",
          kind: "file",
          required: false,
          description: "Optional plan.md to include plan-level checks.",
        },
        {
          name: "checklistFocus",
          kind: "text",
          required: false,
          description: "Optional focus areas, e.g. 'security, accessibility, performance'.",
        },
      ],
      outputs: [
        {
          name: "checklistDocument",
          kind: "file",
          path: ".specify/{feature}/checklist.md",
          description: "Structured checklist with pass/fail criteria and human-review gates.",
        },
      ],
    }),
  },

  // ── 7. tasks ────────────────────────────────────────────────────────────
  {
    id: "op_tasks",
    name: "Tasks",
    description:
      "Decompose the technical plan into an ordered, actionable task list with clear acceptance criteria per task.",
    acceptedObjectTypes: ["file"],
    config: cfg({
      inputs: [
        {
          name: "planDocument",
          kind: "file",
          required: true,
          description: "plan.md to decompose into tasks.",
        },
        {
          name: "specDocument",
          kind: "file",
          required: false,
          description:
            "Optional spec.md to ensure task acceptance criteria trace back to requirements.",
        },
      ],
      outputs: [
        {
          name: "tasksDocument",
          kind: "file",
          path: ".specify/{feature}/tasks.md",
          description:
            "Ordered task list with checkboxes, sub-tasks, and acceptance criteria per item.",
        },
      ],
    }),
  },

  // ── 8. implement ────────────────────────────────────────────────────────
  {
    id: "op_implement",
    name: "Implement",
    description:
      "Execute the task list and build the feature according to the plan, updating tasks.md as each task completes.",
    acceptedObjectTypes: ["file", "folder"],
    config: cfg({
      inputs: [
        {
          name: "tasksDocument",
          kind: "file",
          required: true,
          description: "tasks.md listing the work to execute.",
        },
        {
          name: "planDocument",
          kind: "file",
          required: true,
          description: "plan.md providing the architectural context for each task.",
        },
        {
          name: "specDocument",
          kind: "file",
          required: false,
          description: "Optional spec.md to verify each task output against acceptance criteria.",
        },
        {
          name: "constitutionDocument",
          kind: "file",
          required: false,
          description:
            "Optional constitution.md to enforce project-wide coding standards during implementation.",
        },
      ],
      outputs: [
        {
          name: "implementation",
          kind: "folder",
          path: "src/",
          description: "The implemented source code satisfying all tasks.",
        },
        {
          name: "updatedTasksDocument",
          kind: "file",
          path: ".specify/{feature}/tasks.md",
          description: "tasks.md with completed items checked off and any blockers noted.",
        },
      ],
    }),
  },

  // ── 9. check ─────────────────────────────────────────────────────────────
  {
    id: "op_check",
    name: "Check",
    description:
      "Run quality checks on the codebase: linting, type checking, and tests. Reports issues found and suggests fixes.",
    acceptedObjectTypes: ["file", "folder", "project"],
    config: cfg({
      executor: {
        type: "agent",
        agentMode: "skill",
        skillId: "code-check",
      },
      inputs: [
        {
          name: "target",
          kind: "project",
          required: true,
          description: "The file, folder, or project to run checks on.",
        },
        {
          name: "checkTypes",
          kind: "text",
          required: false,
          description:
            "Comma-separated list of checks to run: lint, typecheck, test. Defaults to all.",
        },
      ],
      outputs: [
        {
          name: "checkReport",
          kind: "file",
          path: ".ordine/check-report.md",
          description:
            "Markdown report listing all issues found with severity and suggested fixes.",
        },
      ],
    }),
  },

  // ── 10. check-rules ─────────────────────────────────────────────────────
  {
    id: "op_check_rules",
    name: "Check Rules",
    description:
      "Scan files against all enabled rules with regex patterns. Returns structured findings with severity, line numbers, and code snippets.",
    acceptedObjectTypes: ["file", "folder", "project"],
    config: cfg({
      executor: {
        type: "rule-check",
      },
      inputs: [
        {
          name: "target",
          kind: "project",
          required: true,
          description: "The file, folder, or project to scan against rules.",
        },
      ],
      outputs: [
        {
          name: "ruleCheckReport",
          kind: "file",
          path: ".ordine/rule-check-report.json",
          description: "JSON report with all rule violations found (CheckOutput format).",
        },
      ],
    }),
  },
];

// ─── Runner ──────────────────────────────────────────────────────────────────

async function seed() {
  console.log("🌱  Seeding spec-kit operations via REST API...\n");

  let upserted = 0;

  for (const op of OPERATIONS) {
    await apiPut("/api/operations", op);
    console.log(`  ✅  ${op.name} (${op.id}) — upserted`);
    upserted++;
  }

  console.log(`\n✨  Done. Upserted: ${upserted}, Total: ${OPERATIONS.length}`);
}

seed().catch((error) => {
  console.error("❌  Seed failed:", error);
  process.exit(1);
});

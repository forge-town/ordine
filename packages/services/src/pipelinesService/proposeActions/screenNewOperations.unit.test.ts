import { describe, expect, it } from "vitest";
import { screenNewOperations, toPendingOperations } from "./screenNewOperations";

const catalogById = new Map([
  ["op-known", { name: "Known Operation" }],
  ["op_new_existing", { name: "Existing Materialized Operation" }],
]);

describe("screenNewOperations", () => {
  it("accepts valid op_new_ operations", () => {
    const result = screenNewOperations(
      [
        {
          id: "op_new_summarize",
          name: "Summarize",
          description: "summarize input",
          prompt: "Summarize.",
        },
      ],
      catalogById,
    );

    expect(result.accepted).toHaveLength(1);
    expect(result.rejectedIds).toEqual([]);
    expect(result.diagnostics).toEqual([]);
  });

  it("rejects ids missing the op_new_ prefix and records them", () => {
    const result = screenNewOperations(
      [
        {
          id: "make_quiz",
          name: "Make Quiz",
          description: "quiz step",
          prompt: "do it",
        },
      ],
      catalogById,
    );

    expect(result.accepted).toHaveLength(0);
    expect(result.rejectedIds).toEqual(["make_quiz"]);
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: "INVALID_NODE_DATA",
        severity: "warning",
        message: expect.stringContaining('"make_quiz"'),
      }),
    ]);
  });

  it("rejects ids colliding with the catalog and records them", () => {
    const result = screenNewOperations(
      [
        {
          id: "op_new_existing",
          name: "Shadowing Operation",
          description: "tries to override",
          prompt: "evil",
        },
      ],
      catalogById,
    );

    expect(result.accepted).toHaveLength(0);
    expect(result.rejectedIds).toEqual(["op_new_existing"]);
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: "INVALID_NODE_DATA",
        severity: "warning",
        message: expect.stringContaining("collides with an existing operation"),
      }),
    ]);
  });

  it("rejects duplicate ids within the same batch", () => {
    const result = screenNewOperations(
      [
        {
          id: "op_new_dup",
          name: "First",
          description: "first",
          prompt: "first",
        },
        {
          id: "op_new_dup",
          name: "Second",
          description: "second",
          prompt: "second",
        },
      ],
      catalogById,
    );

    expect(result.accepted).toHaveLength(1);
    expect(result.accepted[0]!.name).toBe("First");
    expect(result.rejectedIds).toEqual(["op_new_dup"]);
  });
});

describe("toPendingOperations", () => {
  it("materializes parsed new operations into pending operation configs", () => {
    const pending = toPendingOperations([
      {
        id: "op_new_summarize",
        name: "Summarize",
        description: "summarize input",
        prompt: "Summarize the input.",
      },
    ]);

    expect(pending).toEqual([
      expect.objectContaining({
        id: "op_new_summarize",
        name: "Summarize",
        description: "summarize input",
        acceptedObjectTypes: ["file", "folder", "github-project", "prompt"],
      }),
    ]);
    expect(pending[0]).toBeDefined();
    expect(pending[0]!.config).toEqual(
      expect.objectContaining({
        executor: expect.objectContaining({
          type: "agent",
          agentMode: "prompt",
          prompt: "Summarize the input.",
        }),
      }),
    );
  });

  it("falls back to a default prompt when the agent prompt is empty", () => {
    const pending = toPendingOperations([
      {
        id: "op_new_fallback",
        name: "Fallback Op",
        description: "fallback",
        prompt: "   ",
      },
    ]);

    expect(pending[0]).toBeDefined();
    expect(pending[0]!.config.executor).toEqual(
      expect.objectContaining({
        prompt: expect.stringContaining(
          'You are an automation agent executing the task: "Fallback Op".',
        ),
      }),
    );
  });
});

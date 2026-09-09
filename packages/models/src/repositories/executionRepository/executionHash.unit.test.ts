import { describe, expect, it } from "vitest";
import { executionFixture } from "./executionFixtures";
import {
  canonicalExecutionJson,
  hashExecutionJson,
  hashPreparedRun,
  verifyPreparedRun,
} from "./executionHash";

describe("execution content hashes", () => {
  it("sorts object keys recursively and preserves array order", () => {
    expect(canonicalExecutionJson({ z: 1, a: { "2": 2, "10": 10 } })).toBe(
      '{"a":{"10":10,"2":2},"z":1}',
    );
    expect(hashExecutionJson({ b: [1, { b: false, a: true }], a: "x" })).toBe(
      hashExecutionJson({ a: "x", b: [1, { a: true, b: false }] }),
    );
    expect(hashExecutionJson([1, 2])).not.toBe(hashExecutionJson([2, 1]));
  });

  it("excludes only snapshot identity, creation metadata, stored hash, and editor", () => {
    const { prepared } = executionFixture();
    const visualChange = {
      ...prepared,
      id: "another-id",
      createdAt: "2026-09-01T00:00:00Z",
      contentHash: "1".repeat(64),
      pipeline: {
        ...prepared.pipeline,
        editor: { ...prepared.pipeline.editor, viewport: { x: 40, y: 20, zoom: 2 } },
      },
    };
    expect(hashPreparedRun(visualChange)).toBe(prepared.contentHash);
    expect(hashPreparedRun({ ...prepared, subjectId: "different-subject" })).not.toBe(
      prepared.contentHash,
    );
    expect(
      hashPreparedRun({
        ...prepared,
        pipeline: { ...prepared.pipeline, sharedContext: "changed" },
      }),
    ).not.toBe(prepared.contentHash);
  });

  it("rejects altered prepared execution even if the supplied digest string is unchanged", () => {
    const { prepared } = executionFixture();
    expect(verifyPreparedRun(prepared)).toEqual(prepared);
    expect(() =>
      verifyPreparedRun({ ...prepared, inputs: { value: [{ kind: "text", value: "tampered" }] } }),
    ).toThrow("Prepared run content hash mismatch");
  });

  it("normalizes omitted schema defaults before hashing a prepared wire value", () => {
    const { prepared } = executionFixture();
    const { inputArtifacts: _inputArtifacts, ...wire } = prepared;
    expect(hashPreparedRun(wire as typeof prepared)).toBe(prepared.contentHash);
  });

  it("rejects non-JSON inputs rather than hashing lossy representations", () => {
    expect(() => canonicalExecutionJson(Number.NaN)).toThrow();
    expect(() => canonicalExecutionJson(new Date())).toThrow();
    expect(() => canonicalExecutionJson([undefined])).toThrow();
  });
});

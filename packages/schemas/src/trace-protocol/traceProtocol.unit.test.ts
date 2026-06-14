import { describe, expect, it } from "vitest";
import {
  encodeCheckpointResume,
  encodeCheckpointWait,
  encodeEdgeConditionSkip,
  encodeEdgeQualitySkip,
  encodeLlmContent,
  encodeNodeDone,
  encodeNodeFail,
  encodeNodeSkipped,
  encodeNodeStart,
  encodeRunPause,
  encodeRunResume,
  encodeSelfHeal,
  encodeSelfHealDone,
  TRACE_MARKER,
  UserActionPayloadSchema,
} from "./index";

describe("trace marker encoders (byte-level parity with历史字面量)", () => {
  it("encodes node lifecycle markers", () => {
    expect(encodeNodeStart("n1")).toBe("@@NODE_START::n1");
    expect(encodeNodeDone("n1")).toBe("@@NODE_DONE::n1");
    expect(encodeNodeFail("n1")).toBe("@@NODE_FAIL::n1");
    expect(encodeNodeSkipped("n1", "incoming edge condition")).toBe(
      "@@NODE_SKIPPED::n1::incoming edge condition",
    );
  });

  it("encodes llm content / self-heal / run-control markers", () => {
    expect(encodeLlmContent("n1", "hello")).toBe("@@LLM_CONTENT::n1::hello");
    expect(encodeSelfHeal("n1", 2, "Retrying after failure: boom")).toBe(
      "@@SELF_HEAL::n1::2::Retrying after failure: boom",
    );
    expect(encodeSelfHealDone("n1", 2)).toBe("@@SELF_HEAL_DONE::n1::2");
    expect(encodeRunPause("n1")).toBe("@@RUN_PAUSE::n1");
    expect(encodeRunResume("n1")).toBe("@@RUN_RESUME::n1");
    expect(encodeCheckpointWait("n1")).toBe("@@CHECKPOINT_WAIT::n1");
    expect(encodeCheckpointResume("n1")).toBe("@@CHECKPOINT_RESUME::n1");
  });

  it("encodes edge skip markers", () => {
    expect(encodeEdgeConditionSkip("e1", "x > 1")).toBe("@@EDGE_CONDITION_SKIP::e1::x > 1");
    expect(encodeEdgeQualitySkip("e1", "must pass")).toBe("@@EDGE_QUALITY_SKIP::e1::must pass");
  });

  it("self-heal prefix does not collide with self-heal-done", () => {
    expect(encodeSelfHealDone("n1", 1).startsWith(TRACE_MARKER.selfHeal)).toBe(false);
    expect(encodeSelfHeal("n1", 1, "x").startsWith(TRACE_MARKER.selfHeal)).toBe(true);
  });
});

describe("UserActionPayloadSchema", () => {
  it("accepts a valid payload", () => {
    const parsed = UserActionPayloadSchema.safeParse({
      field: "inputDir",
      kind: "configure-input",
      message: "Please configure the input folder",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects unknown kind and empty message", () => {
    expect(UserActionPayloadSchema.safeParse({ kind: "bogus", message: "x" }).success).toBe(false);
    expect(UserActionPayloadSchema.safeParse({ kind: "provide-info", message: "  " }).success).toBe(
      false,
    );
  });
});

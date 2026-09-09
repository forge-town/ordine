import { describe, expect, it } from "vitest";
import { parseMigrationJson, validateExecutionMigration } from "../validateExecutionMigration";
import { migrationFixture, replaceFixtureSource } from "./fixtures";

describe("explicit offline manual rebuild", () => {
  it("validates selected definitions and reports old done/compound as archive/rejection, never new Job/artifact", () => {
    const fixture = migrationFixture();
    const result = validateExecutionMigration(fixture.bundle, fixture.sourceBytes);
    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;
    expect(result.value.report.counts).toMatchObject({
      operations: 1,
      pipelines: 1,
      importedJobs: 0,
      importedArtifacts: 0,
    });
    expect(result.value.report.graphs[0]).toMatchObject({
      nodeCount: 1,
      edgeCount: 1,
      valid: true,
    });
    expect(result.value.report.sourceFreezeEvidence).toBe(
      "declared_only_not_independently_verified",
    );
    expect(result.value.report.objects.map((item) => item.decision)).toEqual([
      "rebuilt",
      "rebuilt",
      "archive_only",
      "rejected",
    ]);
  });

  it.each([
    [
      "unknown target field",
      (f: ReturnType<typeof migrationFixture>) =>
        Object.assign(f.bundle.operations[0]!, { legacyBody: "ignored?" }),
      "bundle_schema_invalid",
    ],
    [
      "missing field disposition",
      (f: ReturnType<typeof migrationFixture>) => f.bundle.objects[0]!.fieldDispositions.pop(),
      "field_disposition_incomplete",
    ],
    [
      "source hash changed",
      (f: ReturnType<typeof migrationFixture>) => {
        f.bundle.sourceSha256 = "0".repeat(64);
      },
      "source_hash_mismatch",
    ],
    [
      "object hash changed",
      (f: ReturnType<typeof migrationFixture>) => {
        f.bundle.objects[0]!.sourceObjectSha256 = "0".repeat(64);
      },
      "source_object_hash_mismatch",
    ],
    [
      "unmapped object",
      (f: ReturnType<typeof migrationFixture>) => {
        f.bundle.objects[0]!.mapping!.newId = "missing-target";
      },
      "mapping_invalid",
    ],
    [
      "compound not declared",
      (f: ReturnType<typeof migrationFixture>) => {
        f.bundle.objects[3]!.compoundResolution = "not_present";
      },
      "compound_resolution_required",
    ],
    [
      "wrong operation revision",
      (f: ReturnType<typeof migrationFixture>) => {
        f.bundle.pipelines[0]!.graph.nodes[0]!.operation.revision = 2;
      },
      "graph_invalid:OPERATION_PIN_MISSING",
    ],
    [
      "dangling port",
      (f: ReturnType<typeof migrationFixture>) => {
        f.bundle.pipelines[0]!.graph.edges[0]!.target.portId = "absent";
      },
      "graph_invalid:GRAPH_PORT_UNKNOWN",
    ],
    [
      "runtime reference",
      (f: ReturnType<typeof migrationFixture>) => {
        f.bundle.operations[0]!.executionDefaults.runtimeConfigId = "old-runtime";
      },
      "external_reference_requires_separate_rebuild",
    ],
    [
      "old workspace reused",
      (f: ReturnType<typeof migrationFixture>) => {
        f.bundle.targetWorkspaceId = f.source.sourceWorkspaceId;
      },
      "workspace_reused",
    ],
    [
      "selected pending review",
      (f: ReturnType<typeof migrationFixture>) => {
        f.bundle.selected.push({ kind: "operation", id: "old-compound" });
        f.bundle.objects[3]!.decision = "manual_required";
      },
      "selected_manual_work_pending",
    ],
  ])("rejects %s", (_label, mutate, expected) => {
    const fixture = migrationFixture();
    mutate(fixture);
    const result = validateExecutionMigration(fixture.bundle, fixture.sourceBytes);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.code).toBe(expected);
  });

  it("rejects active/unknown Jobs even with a source freeze declaration", () => {
    const fixture = migrationFixture();
    fixture.source.objects[2]!.data["status"] = "paused";
    replaceFixtureSource(fixture, fixture.source);
    const result = validateExecutionMigration(fixture.bundle, fixture.sourceBytes);
    expect(result.isErr() && result.error.code).toBe("active_or_unknown_execution_state");
  });
  it("rejects source and target plaintext credentials without echoing them", () => {
    const fixture = migrationFixture();
    fixture.source.objects[0]!.data["apiKey"] = "synthetic-sensitive-value";
    replaceFixtureSource(fixture, fixture.source);
    const result = validateExecutionMigration(fixture.bundle, fixture.sourceBytes);
    expect(result.isErr() && result.error.code).toBe("plaintext_credentials");
    expect(JSON.stringify(result)).not.toContain("synthetic-sensitive-value");
  });
  it("rejects forbidden target Job payloads instead of silently stripping done into succeeded", () => {
    const fixture = migrationFixture();
    const result = validateExecutionMigration(
      { ...fixture.bundle, jobs: [{ state: "succeeded" }] },
      fixture.sourceBytes,
    );
    expect(result.isErr() && result.error.code).toBe("bundle_schema_invalid");
  });
  it("rejects duplicate JSON keys including escaped aliases rather than dropping a source field", () => {
    const parsed = parseMigrationJson(new TextEncoder().encode('{"a":1,"\\u0061":2}'));
    expect(parsed.isErr() && parsed.error.code).toBe("duplicate_json_key");
    expect(
      parseMigrationJson(
        new TextEncoder().encode('{"a":{"x":1},"b":{"x":2},"c":["text", "a"]}'),
      ).isOk(),
    ).toBe(true);
  });
});

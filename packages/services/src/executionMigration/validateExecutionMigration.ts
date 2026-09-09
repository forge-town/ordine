import { createHash } from "node:crypto";
import { Result, err, ok } from "neverthrow";
import { canonicalExecutionJson, hashExecutionJson } from "@repo/models";
import { compileDefinitionGraph, validateOperationDefinition } from "@repo/pipeline-engine";
import { ExecutionMigrationBundleSchema, MigrationSourceSchema } from "./migrationSchemas";

export const migrationBytesSha256 = (bytes: Uint8Array): string =>
  createHash("sha256").update(bytes).digest("hex");
const pointerEscape = (value: string): string => value.replaceAll("~", "~0").replaceAll("/", "~1");
const key = (kind: string, id: string) => canonicalExecutionJson([kind, id]);
const boundedJson = (value: unknown): boolean => {
  const pending = [{ value, depth: 0 }];
  const seen = new Set<object>();
  const budget = { count: 0 };
  while (pending.length > 0) {
    const item = pending.pop()!;
    if (++budget.count > 200_000 || item.depth > 48) return false;
    if (item.value !== null && typeof item.value === "object") {
      if (seen.has(item.value)) return false;
      seen.add(item.value);
      for (const child of Object.values(item.value))
        pending.push({ value: child, depth: item.depth + 1 });
    }
  }

  return true;
};
/** Exact source inventory helper; callers must supply their own product dispositions. */
export const migrationLeafPaths = (value: unknown, path = ""): string[] => {
  if (value === null || typeof value !== "object") return [path];
  const entries = Object.entries(value);

  return entries.length === 0
    ? [path]
    : entries.flatMap(([key, child]) => migrationLeafPaths(child, `${path}/${pointerEscape(key)}`));
};

const hasPlaintextCredentials = (value: unknown): boolean => {
  if (typeof value === "string")
    return /-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----|\bBearer\s+[A-Za-z0-9._~+/-]{8,}|\bsk-[A-Za-z0-9_-]{16,}|\b(?:postgres(?:ql)?|https?|ssh):\/\/[^\s/:]+:[^\s/@]+@/i.test(
      value,
    );
  if (value === null || typeof value !== "object") return false;

  return Object.entries(value).some(([key, child]) => {
    const normalized = key.replaceAll(/[_-]/g, "").toLowerCase();
    const secretKey =
      /^(?:password|passwd|apikey|accesstoken|refreshtoken|token|secret|clientsecret|privatekey|authorization|credentials)$/.test(
        normalized,
      );

    return (
      (secretKey && child !== null && child !== "" && child !== false) ||
      hasPlaintextCredentials(child)
    );
  });
};
const hasCompound = (value: unknown): boolean => {
  if (value === null || typeof value !== "object") return false;

  return Object.entries(value).some(
    ([key, child]) =>
      /compound|children|subgraph/i.test(key) ||
      ((key === "type" || key === "kind") && child === "compound") ||
      hasCompound(child),
  );
};

export class ExecutionMigrationValidationError extends Error {
  constructor(
    readonly code: string,
    readonly objectIndex?: number,
  ) {
    super(`Offline bundle rejected: ${code}`);
    this.name = "ExecutionMigrationValidationError";
  }
}

/** JSON.parse accepts duplicate object keys; an export must not silently lose any field. */
export const parseMigrationJson = (bytes: Uint8Array) =>
  Result.fromThrowable(
    (): unknown => {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      const parsed: unknown = JSON.parse(text);
      const stack: { object: boolean; expectsKey: boolean; keys: Set<string> }[] = [];
      for (const match of text.matchAll(/"(?:\\[\s\S]|[^"\\])*"|[{}[\],:]/g)) {
        const token = match[0];
        const parent = stack.at(-1);
        if (token === "{" || token === "[")
          stack.push({ object: token === "{", expectsKey: token === "{", keys: new Set() });
        else if (token === "}" || token === "]") stack.pop();
        else if (parent?.object && token === ",") parent.expectsKey = true;
        else if (parent?.object && token === ":") parent.expectsKey = false;
        else if (parent?.object && parent.expectsKey && token.startsWith('"')) {
          const key: string = JSON.parse(token);
          if (parent.keys.has(key))
            throw new ExecutionMigrationValidationError("duplicate_json_key");
          parent.keys.add(key);
        }
      }

      return parsed;
    },
    (error) =>
      error instanceof ExecutionMigrationValidationError
        ? error
        : new ExecutionMigrationValidationError("json_invalid"),
  )();

/** No DB access, no legacy execution. A valid result proves structure and declarations, not semantic equivalence. */
export const validateExecutionMigration = (bundleInput: unknown, sourceBytes: Uint8Array) => {
  const reject = (code: string, index?: number) =>
    err(new ExecutionMigrationValidationError(code, index));
  if (sourceBytes.byteLength > 32 * 1024 * 1024) return reject("source_too_large");
  const decoded = parseMigrationJson(sourceBytes);
  if (decoded.isErr()) return err(decoded.error);
  if (!boundedJson(decoded.value) || !boundedJson(bundleInput))
    return reject("json_complexity_limit");
  if (hasPlaintextCredentials(decoded.value) || hasPlaintextCredentials(bundleInput))
    return reject("plaintext_credentials");
  const sourceResult = MigrationSourceSchema.safeParse(decoded.value);
  const bundleResult = ExecutionMigrationBundleSchema.safeParse(bundleInput);
  if (!sourceResult.success) return reject("source_schema_invalid");
  if (!bundleResult.success) return reject("bundle_schema_invalid");
  const source = sourceResult.data;
  const bundle = bundleResult.data;
  if (migrationBytesSha256(sourceBytes) !== bundle.sourceSha256)
    return reject("source_hash_mismatch");
  if (source.sourceWorkspaceId === bundle.targetWorkspaceId) return reject("workspace_reused");
  const sourceMap = new Map(source.objects.map((item) => [key(item.kind, item.id), item]));
  const entries = new Map(bundle.objects.map((item) => [key(item.kind, item.oldId), item]));
  const selected = new Set(bundle.selected.map((item) => key(item.kind, item.id)));
  if (
    sourceMap.size !== source.objects.length ||
    entries.size !== bundle.objects.length ||
    selected.size !== bundle.selected.length
  )
    return reject("duplicate_source_or_decision");
  if (
    entries.size !== sourceMap.size ||
    [...sourceMap.keys()].some((id) => !entries.has(id)) ||
    [...selected].some((id) => !sourceMap.has(id))
  )
    return reject("source_inventory_mismatch");
  const targets = new Map([
    ...bundle.operations.map((item) => [key("operation", item.id), item.revision] as const),
    ...bundle.pipelines.map((item) => [key("pipeline", item.id), item.revision] as const),
  ]);
  if (targets.size !== bundle.operations.length + bundle.pipelines.length || targets.size === 0)
    return reject("target_inventory_invalid");
  const mapped = new Set<string>();
  for (const [index, entry] of bundle.objects.entries()) {
    const identity = key(entry.kind, entry.oldId);
    const original = sourceMap.get(identity)!;
    if (original.data["id"] !== undefined && original.data["id"] !== original.id)
      return reject("source_identity_mismatch", index);
    if (hashExecutionJson(original) !== entry.sourceObjectSha256)
      return reject("source_object_hash_mismatch", index);
    const expected = migrationLeafPaths(original.data).sort();
    const actual = entry.fieldDispositions.map((field) => field.path).sort();
    if (JSON.stringify(expected) !== JSON.stringify(actual))
      return reject("field_disposition_incomplete", index);
    if (entry.kind === "job" || entry.kind === "approval") {
      const terminal =
        entry.kind === "job"
          ? ["done", "succeeded", "failed", "cancelled", "canceled", "timed_out", "interrupted"]
          : ["approved", "rejected", "expired", "cancelled", "invalidated"];
      const statuses = [original.data["state"], original.data["status"]].filter(
        (status) => status !== undefined,
      );
      if (
        statuses.length === 0 ||
        statuses.some((status) => typeof status !== "string" || !terminal.includes(status))
      )
        return reject("active_or_unknown_execution_state", index);
    }
    const compound = hasCompound(original.data);
    if (
      (compound && entry.compoundResolution === "not_present") ||
      (!compound && entry.compoundResolution !== "not_present") ||
      (compound &&
        entry.decision === "rebuilt" &&
        entry.compoundResolution !== "explicitly_rebuilt") ||
      (compound &&
        entry.decision !== "rebuilt" &&
        entry.compoundResolution !== "archived_without_execution")
    )
      return reject("compound_resolution_required", index);
    if (entry.decision === "rebuilt") {
      if (
        !selected.has(identity) ||
        !["operation", "pipeline"].includes(entry.kind) ||
        !entry.mapping
      )
        return reject("unselected_or_forbidden_rebuild", index);
      const targetKey = key(entry.kind, entry.mapping.newId);
      const target = targets.get(targetKey);
      if (target !== 1 || sourceMap.has(targetKey) || mapped.has(targetKey))
        return reject("mapping_invalid", index);
      mapped.add(targetKey);
      if (!entry.fieldDispositions.some((field) => field.action === "rebuilt"))
        return reject("rebuild_disposition_required", index);
    } else {
      if (entry.mapping || entry.fieldDispositions.some((field) => field.action === "rebuilt"))
        return reject("non_rebuild_mapping", index);
      if (selected.has(identity) && entry.decision === "manual_required")
        return reject("selected_manual_work_pending", index);
    }
  }
  if (mapped.size !== targets.size) return reject("unmapped_target");
  for (const [index, operation] of bundle.operations.entries()) {
    if (
      operation.executionDefaults.runtimeConfigId ||
      (operation.executor.kind === "builtin" && operation.executor.name === "materialize_file") ||
      (operation.executor.kind === "agent" && operation.executor.skillId) ||
      operation.capabilityRefs.length > 0 ||
      (operation.executor.kind === "agent" && operation.executor.allowedTools.length > 0)
    )
      return reject("external_reference_requires_separate_rebuild", index);
    const valid = validateOperationDefinition(operation);
    if (valid.isErr()) return reject(`operation_invalid:${valid.error.code}`, index);
  }
  const graphs = [];
  for (const [index, pipeline] of bundle.pipelines.entries()) {
    if (pipeline.graph.nodes.some((node) => node.executionOverrides.runtimeConfigId))
      return reject("external_reference_requires_separate_rebuild", index);
    const references = new Set(
      pipeline.graph.nodes.map((node) =>
        key(node.operation.operationId, String(node.operation.revision)),
      ),
    );
    const pins = bundle.operations.filter((operation) =>
      references.has(key(operation.id, String(operation.revision))),
    );
    const compiled = compileDefinitionGraph(pipeline.graph, pins);
    if (compiled.isErr()) return reject(`graph_invalid:${compiled.error.code}`, index);
    graphs.push({
      pipelineId: pipeline.id,
      revision: pipeline.revision,
      nodeCount: pipeline.graph.nodes.length,
      edgeCount: pipeline.graph.edges.length,
      references: pins.map((operation) => ({
        operationId: operation.id,
        revision: operation.revision,
      })),
      valid: true,
    });
  }

  return ok({
    bundle,
    report: {
      format: "ordine-execution-offline-report/1",
      strategy: bundle.strategy,
      sourceSha256: bundle.sourceSha256,
      bundleSha256: hashExecutionJson(bundle),
      targetWorkspaceId: bundle.targetWorkspaceId,
      sourceFreezeEvidence: "declared_only_not_independently_verified",
      credentialsEvidence: "declaration_and_known_pattern_scan_only",
      semanticEquivalence: "not_claimed_manual_rebuild",
      counts: {
        sourceObjects: source.objects.length,
        selectedObjects: selected.size,
        operations: bundle.operations.length,
        pipelines: bundle.pipelines.length,
        importedJobs: 0,
        importedArtifacts: 0,
        importedRuntimeConfigs: 0,
      },
      objects: bundle.objects.map((entry) => ({
        kind: entry.kind,
        oldId: entry.oldId,
        sourceObjectSha256: entry.sourceObjectSha256,
        decision: entry.decision,
        mapping: entry.mapping ?? null,
        reviewedFieldCount: entry.fieldDispositions.length,
        warningCount: entry.warnings.length,
        compoundResolution: entry.compoundResolution,
      })),
      graphs,
      warnings: [
        "manual_rebuild_requires_product_review",
        "old_history_and_artifacts_remain_in_readonly_archive",
        "runtime_credentials_require_separate_reauthorization",
        "source_freeze_requires_external_cutover_evidence",
      ],
    },
  });
};

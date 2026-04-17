import type { z } from "zod/v4";

/**
 * Minimal context passed to a custom object-type node handler at pipeline execution time.
 * Mirrors the shape of `NodeContext` in `@repo/pipeline-engine` without creating a
 * hard dependency on that package — the engine supplies the concrete value.
 */
export interface PluginNodeContext {
  nodeId: string;
  jobId: string;
  data: Record<string, unknown>;
  input: { inputPath: string; content: string };
  setOutput: (output: { inputPath: string; content: string }) => void;
  trace: (message: string) => Promise<void>;
}

export type PluginNodeHandler = (
  ctx: PluginNodeContext,
) => Promise<{ ok: true } | { ok: false; error?: Error }>;

/**
 * Defines a custom object type that a plugin contributes to the system.
 *
 * - `id`          — unique identifier used as the pipeline node type (e.g. "s3-bucket")
 * - `label`       — human-readable name shown in the UI
 * - `icon`        — optional icon identifier for the frontend
 * - `dataSchema`  — Zod schema that validates the node-data blob for this object type
 * - `nodeHandler` — async function that executes this node type during a pipeline run
 */
export interface ObjectTypeDefinition {
  id: string;
  label: string;
  icon?: string;
  dataSchema: z.ZodType;
  nodeHandler: PluginNodeHandler;
}

/**
 * The top-level interface every Ordine plugin must implement.
 */
export interface OrdinePlugin {
  /** Unique plugin identifier (e.g. "ordine-plugin-s3") */
  id: string;
  /** Human-readable name */
  name: string;
  /** Semantic version */
  version: string;

  /** Custom object types contributed by this plugin */
  objectTypes?: ObjectTypeDefinition[];
}

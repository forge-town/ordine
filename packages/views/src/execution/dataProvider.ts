import { Result, ResultAsync } from "neverthrow";
import { z } from "zod";
import type { DataProvider, BaseRecord } from "@refinedev/core";
import {
  ExecutionErrorSchema,
  ExecutionReadinessSchema,
  OperationRevisionSchema,
  PipelineDefinitionSchema,
  RunRequestReceiptSchema,
  ExecutionJobSchema,
  ExecutionJobSummarySchema,
  ExecutionEventSchema,
  ExecutionJobResultSchema,
  ExecutionArtifactSchema,
  ExecutionInputAssetSchema,
  ExecutionApprovalSchema,
  ExecutionRuntimeConfigRecordSchema,
  ExecutionWorkspaceSettingsRecordSchema,
  SavePipelineDefinitionSchema,
  SaveOperationRevisionSchema,
  RunRequestInputSchema,
  ImportExecutionInputSchema,
  ExecutionIdentifierSchema,
  ExecutionRequestIdSchema,
  ExecutionJobControlSchema,
  SaveExecutionRuntimeConfigSchema,
  SaveExecutionWorkspaceSettingsSchema,
} from "@repo/schemas";

export class ExecutionHttpError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly code: string,
  ) {
    super(message);
    this.name = "ExecutionHttpError";
  }
}
export type ExecutionDataProviderOptions = {
  baseUrl: string;
  getHeaders: () => HeadersInit | Promise<HeadersInit>;
  fetcher?: typeof fetch;
  timeoutMs?: number;
};
const schemaFor = (resource: string) => {
  const schemas: Record<string, z.ZodType> = {
    "operation-revisions": OperationRevisionSchema,
    pipelines: PipelineDefinitionSchema,
    operations: OperationRevisionSchema,
    "run-requests": RunRequestReceiptSchema,
    jobs: ExecutionJobSchema,
    "job-summaries": ExecutionJobSummarySchema,
    "job-events": ExecutionEventSchema,
    "job-results": ExecutionJobResultSchema,
    "job-artifacts": ExecutionArtifactSchema,
    artifacts: z.union([ExecutionArtifactSchema, ExecutionInputAssetSchema]),
    approvals: ExecutionApprovalSchema,
    readiness: ExecutionReadinessSchema,
    "runtime-configs": ExecutionRuntimeConfigRecordSchema,
    "workspace-settings": ExecutionWorkspaceSettingsRecordSchema,
    "input-assets": ExecutionInputAssetSchema,
  };
  const schema = schemas[resource];
  if (!schema) throw new ExecutionHttpError("未知执行资源", 400, "RESOURCE_UNSUPPORTED");

  return schema;
};
const identifier = (value: unknown) => encodeURIComponent(ExecutionIdentifierSchema.parse(value));
const pathFor = (resource: string, id?: unknown, meta?: Record<string, unknown>) => {
  if (["job-events", "job-results", "job-artifacts"].includes(resource)) {
    const suffix =
      resource === "job-events" ? "events" : resource === "job-results" ? "result" : "artifacts";
    const path = `/jobs/${identifier(id ?? meta?.jobId)}/${suffix}`;
    if (resource !== "job-events") return path;
    const cursor = z
      .number()
      .int()
      .nonnegative()
      .parse(meta?.afterSequence ?? 0);

    return `${path}?afterSequence=${cursor}&limit=1000`;
  }
  schemaFor(resource);
  if (resource === "readiness" || resource === "workspace-settings") return `/${resource}`;
  if (resource === "run-requests" && id !== undefined)
    return `/run-requests/${encodeURIComponent(ExecutionRequestIdSchema.parse(id))}`;

  return `/${resource}${id === undefined ? "" : `/${identifier(id)}`}`;
};

export const createExecutionDataProvider = (
  options: ExecutionDataProviderOptions,
): DataProvider => {
  const parsedUrl = Result.fromThrowable(
    () => new URL(options.baseUrl),
    () => undefined,
  )();
  if (
    parsedUrl.isErr() ||
    parsedUrl.value.username ||
    parsedUrl.value.password ||
    parsedUrl.value.search ||
    parsedUrl.value.hash ||
    !["https:", "http:"].includes(parsedUrl.value.protocol) ||
    (parsedUrl.value.protocol === "http:" &&
      !["localhost", "127.0.0.1", "[::1]"].includes(parsedUrl.value.hostname))
  )
    throw new Error("执行服务地址必须是可信 HTTPS 或本地地址");
  const baseUrl = options.baseUrl.replace(/\/$/u, "");
  const request = async (
    path: string,
    method = "GET",
    body?: unknown,
    bytes = false,
  ): Promise<unknown> => {
    const sent = await ResultAsync.fromPromise(
      Promise.resolve().then(async () => {
        const headers = new Headers(await options.getHeaders());
        headers.set("X-Ordine-Api-Version", "2");
        if (body !== undefined) headers.set("Content-Type", "application/json");

        return (options.fetcher ?? fetch)(`${baseUrl}/api/v2${path}`, {
          method,
          headers,
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: AbortSignal.timeout(options.timeoutMs ?? 15_000),
          redirect: "error",
        });
      }),
      () =>
        new ExecutionHttpError(
          "网络不可用或请求超时；提交结果未知时请查询原 requestId。",
          0,
          "NETWORK_UNCERTAIN",
        ),
    );
    if (sent.isErr()) throw sent.error;
    const response = sent.value;
    const read = await ResultAsync.fromPromise(
      bytes && response.ok ? response.arrayBuffer() : response.json(),
      () => new ExecutionHttpError("服务响应无法读取", response.status, "RESPONSE_INVALID"),
    );
    if (read.isErr()) throw read.error;
    if (!response.ok) {
      const parsed = z.object({ error: ExecutionErrorSchema }).safeParse(read.value);
      throw new ExecutionHttpError(
        parsed.success ? parsed.data.error.message : "执行服务暂时不可用",
        response.status,
        parsed.success ? parsed.data.error.code : "HTTP_ERROR",
      );
    }

    return read.value;
  };
  const download = async (id: string) => {
    const metadata = z
      .union([ExecutionArtifactSchema, ExecutionInputAssetSchema])
      .parse(await request(`/artifacts/${identifier(id)}`));
    const bytes = new Uint8Array(metadata.sizeBytes);
    for (const offset of Array.from(
      { length: Math.ceil(metadata.sizeBytes / 1_048_576) },
      (_, index) => index * 1_048_576,
    )) {
      const length = Math.min(1_048_576, metadata.sizeBytes - offset);
      const part = new Uint8Array(
        (await request(
          `/artifacts/${identifier(id)}/content?offset=${offset}&length=${length}`,
          "GET",
          undefined,
          true,
        )) as ArrayBuffer,
      );
      if (part.byteLength !== length)
        throw new ExecutionHttpError("文件分段不完整，请重新下载", 500, "ARTIFACT_INCOMPLETE");
      bytes.set(part, offset);
    }
    const hash = await ResultAsync.fromPromise(
      crypto.subtle.digest("SHA-256", bytes),
      () => new ExecutionHttpError("无法校验文件摘要", 0, "HASH_UNAVAILABLE"),
    );
    if (hash.isErr()) throw hash.error;
    const sha256 = [...new Uint8Array(hash.value)]
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("");
    if (sha256 !== metadata.sha256)
      throw new ExecutionHttpError(
        "文件 SHA-256 不匹配，已阻止下载",
        500,
        "ARTIFACT_HASH_MISMATCH",
      );

    return { id, ...metadata, blob: new Blob([bytes], { type: metadata.mimeType }) };
  };

  return {
    getApiUrl: () => `${baseUrl}/api/v2`,
    getList: async ({ resource, meta }) => {
      if (resource === "operation-revisions") {
        const refs = z
          .array(
            z.object({
              operationId: ExecutionIdentifierSchema,
              revision: z.number().int().positive(),
            }),
          )
          .parse(meta?.references ?? []);
        const data = await Promise.all(
          refs.map(async (ref) =>
            OperationRevisionSchema.parse(
              await request(`/operations/${identifier(ref.operationId)}/revisions/${ref.revision}`),
            ),
          ),
        );

        return { data: data as never[], total: data.length };
      }
      const data = z
        .array(schemaFor(resource))
        .parse(await request(pathFor(resource, undefined, meta)));

      return { data: data as BaseRecord[] as never[], total: data.length };
    },
    getOne: async ({ resource, id, meta }) => ({
      data: schemaFor(resource).parse(await request(pathFor(resource, id, meta))) as never,
    }),
    create: async ({ resource, variables }) => {
      if (resource === "artifact-download")
        return {
          data: (await download(
            z.object({ id: ExecutionIdentifierSchema }).parse(variables).id,
          )) as never,
        };
      if (resource === "run-requests")
        return {
          data: RunRequestReceiptSchema.parse(
            await request("/run-requests", "POST", RunRequestInputSchema.parse(variables)),
          ) as never,
        };
      if (resource === "input-assets")
        return {
          data: ExecutionInputAssetSchema.parse(
            await request("/input-assets", "POST", ImportExecutionInputSchema.parse(variables)),
          ) as never,
        };
      const control = z
        .object({
          jobId: ExecutionIdentifierSchema,
          action: ExecutionJobControlSchema.shape.action,
        })
        .safeParse(variables);
      if (resource === "job-control" && control.success)
        return {
          data: ExecutionJobSchema.parse(
            await request(`/jobs/${identifier(control.data.jobId)}/control`, "POST", {
              action: control.data.action,
            }),
          ) as never,
        };
      if (resource === "checkpoint-ack") {
        const input = z
          .object({ jobId: ExecutionIdentifierSchema, nodeId: ExecutionIdentifierSchema })
          .parse(variables);

        return {
          data: ExecutionJobSchema.parse(
            await request(
              `/jobs/${identifier(input.jobId)}/checkpoints/${identifier(input.nodeId)}/ack`,
              "POST",
              {},
            ),
          ) as never,
        };
      }
      if (resource === "approval-actions") {
        const input = z
          .object({ approvalId: ExecutionIdentifierSchema, action: z.enum(["approve", "reject"]) })
          .parse(variables);

        return {
          data: RunRequestReceiptSchema.parse(
            await request(`/approvals/${identifier(input.approvalId)}/${input.action}`, "POST", {}),
          ) as never,
        };
      }
      throw new ExecutionHttpError("不支持的执行动作", 400, "ACTION_UNSUPPORTED");
    },
    update: async ({ resource, id, variables }) => {
      const body =
        resource === "pipelines"
          ? SavePipelineDefinitionSchema.parse(variables)
          : resource === "operations"
            ? SaveOperationRevisionSchema.parse(variables)
            : resource === "runtime-configs"
              ? SaveExecutionRuntimeConfigSchema.parse(variables)
              : resource === "workspace-settings"
                ? SaveExecutionWorkspaceSettingsSchema.parse(variables)
                : undefined;
      if (!body) throw new ExecutionHttpError("此资源不可修改", 400, "ACTION_UNSUPPORTED");

      return {
        data: schemaFor(resource).parse(await request(pathFor(resource, id), "PUT", body)) as never,
      };
    },
    deleteOne: async () => {
      throw new ExecutionHttpError("不可删除不可变执行记录", 400, "ACTION_UNSUPPORTED");
    },
  };
};

import { readFileSync, statSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { Result } from "neverthrow";
import type { Command } from "commander";
import { z } from "zod";
import { api } from "./api";
import { findExecutionAction, MAX_INPUT_ASSET_BYTES } from "./execution";

export const callExecution = async (name: string, input: unknown = {}): Promise<void> => {
  const action = findExecutionAction(name);
  if (!action) throw new Error(`Unknown execution v2 action: ${name}`);
  console.log(JSON.stringify(await action.call(input, api)));
};
export const readExecutionJson = (path: string): unknown => {
  const result = Result.fromThrowable(
    () => {
      if (statSync(path).size > 12 * 1024 * 1024) throw new Error("JSON input exceeds 12 MiB");

      return JSON.parse(readFileSync(path, "utf8")) as unknown;
    },
    () =>
      new Error("Cannot read execution JSON file (invalid JSON, inaccessible, or over 12 MiB)."),
  )();
  if (result.isErr()) throw result.error;

  return result.value;
};
export const importInputFile = async (path: string, importRequestId: string, mimeType: string) => {
  const result = Result.fromThrowable(
    () => {
      if (!statSync(path).isFile() || statSync(path).size > MAX_INPUT_ASSET_BYTES)
        throw new Error("Invalid input file");

      return readFileSync(path).toString("base64");
    },
    () => new Error("Input must be an accessible explicit file path of at most 8 MiB."),
  )();
  if (result.isErr()) throw result.error;
  await callExecution("input_assets.import", {
    importRequestId,
    name: basename(path),
    mimeType,
    contentBase64: result.value,
  });
};
export const downloadArtifactRange = async (
  id: string,
  outFile: string,
  offset: number,
  length: number,
) => {
  const action = findExecutionAction("artifacts.content")!;
  const result = z
    .object({ contentBase64: z.string(), sizeBytes: z.number() })
    .parse(await action.call({ id, offset, length }, api));
  const saved = Result.fromThrowable(
    () => writeFileSync(outFile, Buffer.from(result.contentBase64, "base64")),
    () => new Error("Cannot write artifact destination file."),
  )();
  if (saved.isErr()) throw saved.error;
  console.log(JSON.stringify({ artifactId: id, offset, sizeBytes: result.sizeBytes, outFile }));
};

export const registerExecutionCommands = (program: Command): void => {
  const execution = program
    .command("execution")
    .description("Execution API v2 (JSON output; no legacy execution aliases)");
  execution.command("readiness").action(() => callExecution("readiness"));
  const operations = execution.command("operations");
  operations.command("list").action(() => callExecution("operations.list"));
  operations
    .command("save <jsonFile>")
    .action((file: string) => callExecution("operations.save", readExecutionJson(file)));
  const pipelines = execution.command("pipelines");
  pipelines.command("list").action(() => callExecution("pipelines.list"));
  pipelines.command("get <id>").action((id: string) => callExecution("pipelines.get", { id }));
  pipelines
    .command("save <jsonFile>")
    .action((file: string) => callExecution("pipelines.save", readExecutionJson(file)));
  const requests = execution.command("run-requests");
  requests
    .command("submit <jsonFile>")
    .description(
      "Submit RunRequestInput with explicit persistent requestId; returns immediately for App approval",
    )
    .action((file: string) => callExecution("run_requests.submit", readExecutionJson(file)));
  requests
    .command("get <requestId>")
    .action((requestId: string) => callExecution("run_requests.get", { requestId }));
  const jobs = execution.command("jobs");
  jobs.command("list").action(() => callExecution("jobs.list"));
  for (const name of ["get", "result", "artifacts"])
    jobs
      .command(`${name} <jobId>`)
      .action((jobId: string) => callExecution(`jobs.${name}`, { jobId }));
  jobs
    .command("events <jobId>")
    .option("--after-sequence <number>", "Sequence cursor", "0")
    .option("--limit <number>", "Page size", "100")
    .action((jobId: string, options: { afterSequence: string; limit: string }) =>
      callExecution("jobs.events", {
        jobId,
        afterSequence: Number(options.afterSequence),
        limit: Number(options.limit),
      }),
    );
  jobs
    .command("control <jobId> <action>")
    .description("pause, resume or cancel")
    .action((jobId: string, action: string) => callExecution("jobs.control", { jobId, action }));
  jobs
    .command("checkpoint-ack <jobId> <nodeId>")
    .action((jobId: string, nodeId: string) =>
      callExecution("jobs.checkpoint_ack", { jobId, nodeId }),
    );
  const artifacts = execution.command("artifacts");
  artifacts.command("get <id>").action((id: string) => callExecution("artifacts.get", { id }));
  artifacts
    .command("content <id> <outFile>")
    .option("--offset <number>", "Byte offset", "0")
    .option("--length <number>", "Maximum bytes (up to 1 MiB)", "65536")
    .action((id: string, outFile: string, options: { offset: string; length: string }) =>
      downloadArtifactRange(id, outFile, Number(options.offset), Number(options.length)),
    );
  execution
    .command("input-assets")
    .command("import <path>")
    .requiredOption("--import-request-id <uuid>", "Persistent import UUID")
    .requiredOption("--mime-type <type>", "File MIME type")
    .action((path: string, options: { importRequestId: string; mimeType: string }) =>
      importInputFile(path, options.importRequestId, options.mimeType),
    );
};

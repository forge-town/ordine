import { api } from "./api";

interface Pipeline {
  id: string;
  name: string;
  description: string;
  tags: string[];
  nodeCount: number;
  createdAt: number;
  updatedAt: number;
}

interface Job {
  id: string;
  title: string;
  status: "queued" | "running" | "done" | "failed" | "cancelled";
  logs: string[];
  result: { summary?: string; output?: string } | null;
  error: string | null;
  startedAt: number | null;
  finishedAt: number | null;
}

interface RunResponse {
  jobId: string;
}

class CliError extends Error {
  constructor(
    message: string,
    public readonly exitCode: number = 1,
  ) {
    super(message);
    this.name = "CliError";
  }
}

const POLL_INTERVAL_MS = 3000;

const formatDuration = (ms: number): string => {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return minutes > 0 ? `${minutes}m ${remainingSeconds}s` : `${remainingSeconds}s`;
};

export const listPipelines = async (): Promise<void> => {
  const result = await api.get<Pipeline[]>("/api/pipelines");

  if (!result.ok) {
    throw new CliError(`Failed to list pipelines: ${result.message}`);
  }

  const pipelines = result.data;
  if (pipelines.length === 0) {
    console.log("No pipelines found.");

    return;
  }

  console.log(`\n  Pipelines (${pipelines.length}):\n`);
  for (const p of pipelines) {
    const tags = p.tags.length > 0 ? ` [${p.tags.join(", ")}]` : "";
    console.log(`  ${p.id}  ${p.name}${tags}`);
    if (p.description) console.log(`    ${p.description}`);
  }
  console.log();
};

export const runPipeline = async (
  pipelineId: string,
  options: { inputPath?: string; follow?: boolean },
): Promise<void> => {
  console.log(`Triggering pipeline ${pipelineId}...`);

  const result = await api.post<RunResponse>(`/api/pipelines/${pipelineId}/run`, {
    inputPath: options.inputPath,
  });

  if (!result.ok) {
    throw new CliError(`Failed to run pipeline: ${result.message}`);
  }

  const { jobId } = result.data;
  console.log(`Job created: ${jobId}`);

  if (options.follow === false) return;

  await pollJob(jobId);
};

const pollJob = async (jobId: string): Promise<void> => {
  const startTime = Date.now();
  const seenLogCount = { value: 0 };

  const poll = async (): Promise<void> => {
    const result = await api.get<Job>(`/api/jobs/${jobId}`);

    if (!result.ok) {
      throw new CliError(`Failed to fetch job: ${result.message}`);
    }

    const job = result.data;

    // Print new log lines
    const newLogs = job.logs.slice(seenLogCount.value);
    for (const line of newLogs) {
      console.log(line);
    }
    seenLogCount.value = job.logs.length;

    if (job.status === "done" || job.status === "failed" || job.status === "cancelled") {
      const elapsed = formatDuration(Date.now() - startTime);
      console.log();

      if (job.status === "done") {
        console.log(`Pipeline completed in ${elapsed}`);
        if (job.result?.summary) {
          console.log(`  Summary: ${job.result.summary}`);
        }
      } else if (job.status === "failed") {
        console.error(`Pipeline failed after ${elapsed}`);
        if (job.error) console.error(`  Error: ${job.error}`);
        throw new CliError("Pipeline failed");
      } else {
        console.log(`Pipeline cancelled after ${elapsed}`);
      }

      return;
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

    return poll();
  };

  await poll();
};

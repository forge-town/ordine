import { cp, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { ResultAsync } from "neverthrow";
import { GitPublishError, type PublishArtifactOptions } from "@repo/pipeline-engine";

const expandTilde = (p: string): string =>
  p === "~" ? homedir() : p.startsWith("~/") ? join(homedir(), p.slice(2)) : p;

const runLocalPublish = async (opts: PublishArtifactOptions): Promise<string> => {
  const base = expandTilde(opts.repo);
  const target = opts.subPath ? join(base, opts.subPath) : base;
  await mkdir(target, { recursive: true });
  await cp(opts.sourceDir, target, { recursive: true });

  return `Copied artifact to ${target}`;
};

export const localDirPublish = (
  opts: PublishArtifactOptions,
): ResultAsync<string, GitPublishError> =>
  ResultAsync.fromPromise(
    runLocalPublish(opts),
    (error) => new GitPublishError(`local publish failed: ${(error as Error).message}`, error),
  );

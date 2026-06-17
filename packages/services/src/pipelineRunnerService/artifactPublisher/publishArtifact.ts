import type { ResultAsync } from "neverthrow";
import type { PublishArtifactOptions } from "@repo/pipeline-engine";
import { gitPublish } from "./gitPublisher";
import { localDirPublish } from "./localDirPublisher";

/** 按 target 分发：git 仓库（PR 优先）/ 本地目录复制。 */
export const publishArtifact = (opts: PublishArtifactOptions): ResultAsync<string, Error> =>
  opts.target === "localDir" ? localDirPublish(opts) : gitPublish(opts);

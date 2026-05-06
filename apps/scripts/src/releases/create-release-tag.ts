import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";
import { promisify } from "node:util";
import { err, ok, Result, ResultAsync } from "neverthrow";

type ReleaseTagError = {
  message: string;
  cause?: unknown;
};

type PackageJson = {
  name?: string;
  version?: string;
  private?: boolean;
};

const execFileAsync = promisify(execFile);
const tagPattern = /^v(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*))?$/;

const toError = (message: string) => (cause: unknown): ReleaseTagError => ({
  message,
  cause,
});

const parseJson = Result.fromThrowable(
  (content: string): unknown => JSON.parse(content),
  toError("failed to parse package.json"),
);

const runGit = (args: string[]): ResultAsync<string, ReleaseTagError> =>
  ResultAsync.fromPromise(
    execFileAsync("git", args, { encoding: "utf8" }),
    toError(`git ${args.join(" ")} failed`),
  ).map(({ stdout }: { stdout: string | Buffer }) => String(stdout).trim());

const readPackageJson = (path: string): ResultAsync<PackageJson, ReleaseTagError> =>
  ResultAsync.fromPromise(readFile(path, "utf8"), toError(`failed to read ${path}`))
    .andThen((content) => parseJson(content))
    .andThen((json) => {
      if (typeof json !== "object" || json === null || Array.isArray(json)) {
        return err({ message: `${path} is not a package.json object` });
      }

      return ok(json as PackageJson);
    });

const prompt = (question: string): ResultAsync<string, ReleaseTagError> => {
  const readline = createInterface({ input, output });

  return ResultAsync.fromPromise(
    readline.question(question),
    toError("failed to read input"),
  ).map((answer: string) => {
    readline.close();
    return answer.trim();
  });
};

const validateTag = (tag: string): Result<string, ReleaseTagError> => {
  if (!tagPattern.test(tag)) {
    return err({
      message: `invalid tag "${tag}". Expected v1.2.3 or v1.2.3-preview.4`,
    });
  }

  return ok(tag);
};

const getRootVersion = async (): Promise<Result<string, ReleaseTagError>> => {
  const packageJsonResult = await readPackageJson("package.json");

  if (packageJsonResult.isErr()) {
    return err(packageJsonResult.error);
  }

  if (!packageJsonResult.value.version) {
    return err({ message: "root package.json must define version" });
  }

  return ok(packageJsonResult.value.version);
};

const getWorkspacePackageJsonPaths = async (): Promise<
  Result<string[], ReleaseTagError>
> => {
  const pathsResult = await runGit([
    "ls-files",
    "apps/*/package.json",
    "packages/*/package.json",
  ]);

  if (pathsResult.isErr()) {
    return err(pathsResult.error);
  }

  return ok(pathsResult.value.length > 0 ? pathsResult.value.split("\n") : []);
};

const validateWorkspaceVersions = async (
  rootVersion: string,
): Promise<Result<void, ReleaseTagError>> => {
  const pathsResult = await getWorkspacePackageJsonPaths();

  if (pathsResult.isErr()) {
    return err(pathsResult.error);
  }

  const mismatches: string[] = [];

  for (const path of pathsResult.value) {
    const packageJsonResult = await readPackageJson(path);

    if (packageJsonResult.isErr()) {
      return err(packageJsonResult.error);
    }

    const packageJson = packageJsonResult.value;

    if (packageJson.version !== rootVersion) {
      mismatches.push(
        `${path}: ${packageJson.name ?? "unknown"} is ${
          packageJson.version ?? "missing"
        }, expected ${rootVersion}`,
      );
    }
  }

  if (mismatches.length > 0) {
    return err({
      message: `workspace versions must match root package.json version:\n${mismatches.join(
        "\n",
      )}`,
    });
  }

  return ok(undefined);
};

const printCurrentTags = (tags: string[]): void => {
  if (tags.length === 0) {
    console.log("No v* tags found.");
    return;
  }

  console.log("Current v* tags:");
  tags.slice(0, 20).forEach((tag) => console.log(`  ${tag}`));
};

const createReleaseTag = async (): Promise<Result<void, ReleaseTagError>> => {
  const statusResult = await runGit(["status", "--short"]);

  if (statusResult.isErr()) {
    return err(statusResult.error);
  }

  if (statusResult.value.length > 0) {
    return err({
      message: "working tree is not clean. Commit or stash changes before tagging.",
    });
  }

  const rootVersionResult = await getRootVersion();

  if (rootVersionResult.isErr()) {
    return err(rootVersionResult.error);
  }

  const versionValidationResult = await validateWorkspaceVersions(
    rootVersionResult.value,
  );

  if (versionValidationResult.isErr()) {
    return err(versionValidationResult.error);
  }

  const fetchResult = await runGit(["fetch", "--tags", "--prune-tags", "origin"]);

  if (fetchResult.isErr()) {
    return err(fetchResult.error);
  }

  const tagsResult = await runGit(["tag", "--list", "v*", "--sort=-v:refname"]);

  if (tagsResult.isErr()) {
    return err(tagsResult.error);
  }

  const tags = tagsResult.value.length > 0 ? tagsResult.value.split("\n") : [];
  const defaultTag = `v${rootVersionResult.value}`;

  printCurrentTags(tags);

  const answerResult = await prompt(`Release tag [${defaultTag}]: `);

  if (answerResult.isErr()) {
    return err(answerResult.error);
  }

  const selectedTag = answerResult.value.length > 0 ? answerResult.value : defaultTag;
  const validTagResult = validateTag(selectedTag);

  if (validTagResult.isErr()) {
    return err(validTagResult.error);
  }

  if (validTagResult.value !== defaultTag) {
    return err({
      message: `release tag must match root package.json version. Expected ${defaultTag}`,
    });
  }

  if (tags.includes(validTagResult.value)) {
    return err({ message: `tag ${validTagResult.value} already exists.` });
  }

  const createTagResult = await runGit([
    "tag",
    "-a",
    validTagResult.value,
    "-m",
    `release: ${validTagResult.value}`,
  ]);

  if (createTagResult.isErr()) {
    return err(createTagResult.error);
  }

  const pushAnswerResult = await prompt(`Push ${validTagResult.value} to origin? [Y/n]: `);

  if (pushAnswerResult.isErr()) {
    return err(pushAnswerResult.error);
  }

  const shouldPush = !["n", "no"].includes(pushAnswerResult.value.toLowerCase());

  if (!shouldPush) {
    console.log(`Created local tag ${validTagResult.value}.`);
    console.log(`Push later with: git push origin ${validTagResult.value}`);
    return ok(undefined);
  }

  const pushResult = await runGit(["push", "origin", validTagResult.value]);

  if (pushResult.isErr()) {
    return err(pushResult.error);
  }

  console.log(`Pushed ${validTagResult.value} to origin.`);
  return ok(undefined);
};

const result = await createReleaseTag();

if (result.isErr()) {
  console.error(result.error.message);

  if (result.error.cause !== undefined) {
    console.error(String(result.error.cause));
  }

  process.exitCode = 1;
}

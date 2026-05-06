import { execFile } from "node:child_process";
import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";
import { promisify } from "node:util";
import { err, ok, ResultAsync, type Result } from "neverthrow";

type ReleaseTagError = {
  message: string;
  cause?: unknown;
};

type ParsedTag = {
  raw: string;
  major: number;
  minor: number;
  patch: number;
  prerelease: string | null;
};

const execFileAsync = promisify(execFile);
const tagPattern = /^v(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*))?$/;

const toError = (message: string) => (cause: unknown): ReleaseTagError => ({
  message,
  cause,
});

const runGit = (args: string[]): ResultAsync<string, ReleaseTagError> =>
  ResultAsync.fromPromise(
    execFileAsync("git", args, { encoding: "utf8" }),
    toError(`git ${args.join(" ")} failed`),
  ).map(({ stdout }: { stdout: string | Buffer }) => String(stdout).trim());

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

const parseTag = (tag: string): ParsedTag | null => {
  const match = tag.match(tagPattern);

  if (!match) {
    return null;
  }

  return {
    raw: tag,
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ?? null,
  };
};

const compareIdentifiers = (left: string, right: string): number => {
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  const leftIsNumber = String(leftNumber) === left;
  const rightIsNumber = String(rightNumber) === right;

  if (leftIsNumber && rightIsNumber) {
    return leftNumber - rightNumber;
  }

  return left.localeCompare(right);
};

const comparePrereleases = (left: string | null, right: string | null): number => {
  if (left === right) {
    return 0;
  }

  if (left === null) {
    return 1;
  }

  if (right === null) {
    return -1;
  }

  const leftParts = left.split(/[.-]/);
  const rightParts = right.split(/[.-]/);
  const maxLength = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < maxLength; index += 1) {
    const leftPart = leftParts[index];
    const rightPart = rightParts[index];

    if (leftPart === undefined) {
      return -1;
    }

    if (rightPart === undefined) {
      return 1;
    }

    const compared = compareIdentifiers(leftPart, rightPart);

    if (compared !== 0) {
      return compared;
    }
  }

  return 0;
};

const compareTags = (left: ParsedTag, right: ParsedTag): number => {
  const versionParts = ["major", "minor", "patch"] as const;

  for (const part of versionParts) {
    const compared = left[part] - right[part];

    if (compared !== 0) {
      return compared;
    }
  }

  return comparePrereleases(left.prerelease, right.prerelease);
};

const incrementPrerelease = (prerelease: string): string => {
  const parts = prerelease.split(".");
  const lastPart = parts.at(-1);
  const lastNumber = Number(lastPart);

  if (lastPart !== undefined && String(lastNumber) === lastPart) {
    return [...parts.slice(0, -1), String(lastNumber + 1)].join(".");
  }

  return `${prerelease}.1`;
};

const getDefaultTag = (tags: string[]): string => {
  const latestTag = tags
    .map(parseTag)
    .filter((tag): tag is ParsedTag => tag !== null)
    .sort(compareTags)
    .at(-1);

  if (!latestTag) {
    return "v0.0.1";
  }

  if (latestTag.prerelease) {
    return `v${latestTag.major}.${latestTag.minor}.${latestTag.patch}-${incrementPrerelease(
      latestTag.prerelease,
    )}`;
  }

  return `v${latestTag.major}.${latestTag.minor}.${latestTag.patch + 1}`;
};

const validateTag = (tag: string): Result<string, ReleaseTagError> => {
  if (!tagPattern.test(tag)) {
    return err({
      message: `invalid tag "${tag}". Expected v1.2.3 or v1.2.3-preview.4`,
    });
  }

  return ok(tag);
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

  const fetchResult = await runGit(["fetch", "--tags", "--prune-tags", "origin"]);

  if (fetchResult.isErr()) {
    return err(fetchResult.error);
  }

  const tagsResult = await runGit(["tag", "--list", "v*", "--sort=-v:refname"]);

  if (tagsResult.isErr()) {
    return err(tagsResult.error);
  }

  const tags = tagsResult.value.length > 0 ? tagsResult.value.split("\n") : [];
  const defaultTag = getDefaultTag(tags);

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

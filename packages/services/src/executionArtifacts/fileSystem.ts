import { constants, type BigIntStats } from "node:fs";
import { lstat, mkdir, open, realpath, rename, type FileHandle } from "node:fs/promises";
import { join, posix, resolve, win32 } from "node:path";
import { ResultAsync } from "neverthrow";
import { z } from "zod/v4";
import { ExecutionArtifactNameSchema } from "@repo/schemas";
import { ArtifactStoreError, assertArtifactNotAborted, toArtifactStoreError } from "./errors";
import { artifactHash } from "./content";

const sameFile = (left: BigIntStats, right: BigIntStats): boolean =>
  left.dev === right.dev && left.ino === right.ino;
const sameContentStat = (left: BigIntStats, right: BigIntStats): boolean =>
  sameFile(left, right) &&
  left.size === right.size &&
  left.mtimeNs === right.mtimeNs &&
  left.ctimeNs === right.ctimeNs;
const uuid = (value: string) => z.uuid().safeParse(value).success;
const nativeCode = (error: unknown) =>
  error && typeof error === "object" && "code" in error ? error.code : undefined;

export const validateArtifactStorageKey = (key: string): void => {
  const parts = key.split("/");
  if (
    !(
      (parts[0] === "inputs" && parts.length === 2) ||
      (parts[0] === "jobs" && parts.length === 4)
    ) ||
    !parts.slice(1).every(uuid)
  )
    throw new ArtifactStoreError("ARTIFACT_PATH_INVALID", "Stored artifact location is invalid.");
};
export const validateAttemptRelativePath = (value: string): string => {
  if (!value || value.length > 1024 || win32.isAbsolute(value) || posix.isAbsolute(value))
    throw new ArtifactStoreError(
      "ARTIFACT_PATH_INVALID",
      "Artifact source must be a relative path within its attempt.",
    );
  const parts = value.split(/[\\/]/u);
  if (
    parts.length > 32 ||
    parts.some(
      (part) =>
        !ExecutionArtifactNameSchema.safeParse(part).success || part === "." || part === "..",
    )
  )
    throw new ArtifactStoreError(
      "ARTIFACT_PATH_INVALID",
      "Artifact source path contains unsafe segments.",
    );

  return parts.join("/");
};

const withHandle = async <T>(
  path: string,
  flags: string | number,
  operation: (handle: FileHandle) => Promise<T>,
): Promise<T> => {
  const handle = await open(path, flags, 0o600);
  const result = await ResultAsync.fromPromise(
    Promise.resolve().then(() => operation(handle)),
    toArtifactStoreError,
  );
  const closed = await ResultAsync.fromPromise(handle.close(), toArtifactStoreError);
  if (result.isErr()) throw result.error;
  if (closed.isErr()) throw closed.error;

  return result.value;
};

const safeSegments = (relative: string): string[] => {
  const segments = relative.split("/");
  if (
    segments.some(
      (part) =>
        !ExecutionArtifactNameSchema.safeParse(part).success || part === "." || part === "..",
    )
  )
    throw new ArtifactStoreError("ARTIFACT_PATH_INVALID", "Artifact storage path is invalid.");

  return segments;
};
export const initializeArtifactFileSystem = async (rootDirectory: string, maxFileBytes: number) => {
  if (!rootDirectory || (!win32.isAbsolute(rootDirectory) && !posix.isAbsolute(rootDirectory)))
    throw new ArtifactStoreError(
      "ARTIFACT_ROOT_INVALID",
      "Artifact root must be an absolute directory.",
    );
  await mkdir(rootDirectory, { recursive: true, mode: 0o700 });
  const original = await lstat(rootDirectory, { bigint: true });
  if (original.isSymbolicLink() || !original.isDirectory())
    throw new ArtifactStoreError("ARTIFACT_LINK_REJECTED", "Artifact root cannot be a link.");
  const canonicalRoot = await realpath(resolve(rootDirectory));
  const rootIdentity = await lstat(canonicalRoot, { bigint: true });

  const checkRoot = async () => {
    const current = await lstat(canonicalRoot, { bigint: true });
    if (
      current.isSymbolicLink() ||
      !current.isDirectory() ||
      !sameFile(rootIdentity, current) ||
      (await realpath(canonicalRoot)) !== canonicalRoot
    )
      throw new ArtifactStoreError("ARTIFACT_ROOT_CHANGED", "Artifact root identity changed.");
  };
  const ensureDirectory = async (relative: string): Promise<string> => {
    await checkRoot();
    const state = { path: canonicalRoot };
    for (const segment of safeSegments(relative)) {
      state.path = join(state.path, segment);
      const created = await ResultAsync.fromPromise(
        mkdir(state.path, { mode: 0o700 }),
        (error) => error,
      );
      if (created.isErr() && nativeCode(created.error) !== "EEXIST") throw created.error;
      const stat = await lstat(state.path, { bigint: true });
      if (stat.isSymbolicLink() || !stat.isDirectory())
        throw new ArtifactStoreError(
          "ARTIFACT_LINK_REJECTED",
          "Artifact directory cannot be a link or file.",
        );
    }

    return state.path;
  };
  const inspectPath = async (relative: string) => {
    await checkRoot();
    const state = { path: canonicalRoot };
    const snapshots: Array<{ path: string; stat: BigIntStats }> = [
      { path: canonicalRoot, stat: rootIdentity },
    ];
    const parts = safeSegments(relative);
    for (const [index, segment] of parts.entries()) {
      state.path = join(state.path, segment);
      const stat = await lstat(state.path, { bigint: true });
      if (
        stat.isSymbolicLink() ||
        (index < parts.length - 1 ? !stat.isDirectory() : !stat.isFile())
      )
        throw new ArtifactStoreError(
          "ARTIFACT_LINK_REJECTED",
          "Artifact path must contain ordinary directories and a regular file.",
        );
      snapshots.push({ path: state.path, stat });
    }

    return snapshots;
  };
  const readVerifiedFile = async (relative: string, signal?: AbortSignal): Promise<Uint8Array> => {
    assertArtifactNotAborted(signal);
    const snapshots = await inspectPath(relative);
    const entry = snapshots.at(-1)!;

    return withHandle(
      entry.path,
      constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0),
      async (handle) => {
        const before = await handle.stat({ bigint: true });
        if (!before.isFile() || before.nlink !== 1n || !sameContentStat(entry.stat, before))
          throw new ArtifactStoreError(
            "ARTIFACT_FILE_CHANGED",
            "Artifact file identity changed before reading.",
          );
        if (before.size > BigInt(maxFileBytes))
          throw new ArtifactStoreError(
            "ARTIFACT_SIZE_LIMIT",
            "Artifact exceeds the configured file limit.",
          );
        const buffer = Buffer.alloc(Number(before.size) + 1);
        const state = { offset: 0 };
        while (state.offset < buffer.length) {
          assertArtifactNotAborted(signal);
          const result = await handle.read(
            buffer,
            state.offset,
            buffer.length - state.offset,
            state.offset,
          );
          if (result.bytesRead === 0) break;
          state.offset += result.bytesRead;
        }
        const after = await handle.stat({ bigint: true });
        if (state.offset !== Number(before.size) || !sameContentStat(before, after))
          throw new ArtifactStoreError("ARTIFACT_FILE_CHANGED", "Artifact changed while reading.");
        for (const [index, snapshot] of snapshots.entries()) {
          const current = await lstat(snapshot.path, { bigint: true });
          if (
            current.isSymbolicLink() ||
            !sameFile(snapshot.stat, current) ||
            (index === snapshots.length - 1 && !sameContentStat(after, current))
          )
            throw new ArtifactStoreError(
              "ARTIFACT_FILE_CHANGED",
              "Artifact path identity changed while reading.",
            );
        }
        assertArtifactNotAborted(signal);

        return new Uint8Array(buffer.subarray(0, state.offset));
      },
    );
  };
  const writeExclusive = async (relative: string, bytes: Uint8Array, signal?: AbortSignal) => {
    const parts = safeSegments(relative);
    const directory = await ensureDirectory(parts.slice(0, -1).join("/"));
    assertArtifactNotAborted(signal);
    await withHandle(join(directory, parts.at(-1)!), "wx", async (handle) => {
      await handle.writeFile(bytes, { signal });
      await handle.sync();
    });
  };
  const stage = async (
    storageKey: string,
    artifactId: string,
    bytes: Uint8Array,
    signal?: AbortSignal,
  ) => {
    validateArtifactStorageKey(storageKey);
    if (!uuid(artifactId))
      throw new ArtifactStoreError(
        "ARTIFACT_PATH_INVALID",
        "Artifact storage identifier is invalid.",
      );
    // This exclusive, durable intent also reserves the UUID across cooperating store instances.
    await writeExclusive(
      `staging/${artifactId}`,
      new TextEncoder().encode(JSON.stringify({ artifactId, storageKey, phase: "staged" })),
      signal,
    );
    const parts = storageKey.split("/");
    const parent = parts.slice(0, -1).join("/");
    const directory = await ensureDirectory(parent);
    const temporary = `${parent}/.tmp-${artifactId}`;
    await writeExclusive(temporary, bytes, signal);
    const verified = await readVerifiedFile(temporary, signal);
    if (verified.byteLength !== bytes.byteLength || artifactHash(verified) !== artifactHash(bytes))
      throw new ArtifactStoreError(
        "ARTIFACT_INTEGRITY_FAILED",
        "Written artifact failed integrity verification.",
        artifactId,
      );
    const target = join(directory, parts.at(-1)!);
    const existing = await ResultAsync.fromPromise(lstat(target), (error) => error);
    if (existing.isOk() || nativeCode(existing.error) !== "ENOENT")
      throw new ArtifactStoreError(
        "ARTIFACT_STORAGE_COLLISION",
        "Artifact destination already exists or is unavailable.",
        artifactId,
      );
    assertArtifactNotAborted(signal);
    await checkRoot();
    await rename(join(directory, `.tmp-${artifactId}`), target);
  };
  const markOutcome = async (artifactId: string, outcome: "registered" | "orphaned") => {
    await writeExclusive(
      `staging/${artifactId}.${outcome}`,
      new TextEncoder().encode(JSON.stringify({ artifactId, outcome })),
    );
  };
  await ensureDirectory("inputs");
  await ensureDirectory("jobs");
  await ensureDirectory("workspaces");
  await ensureDirectory("staging");

  return { readVerifiedFile, stage, markOutcome, ensureDirectory };
};

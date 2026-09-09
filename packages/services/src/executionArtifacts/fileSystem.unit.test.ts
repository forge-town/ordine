import { randomUUID } from "node:crypto";
import { mkdtemp, open, type FileHandle } from "node:fs/promises";
import type * as FsPromises from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initializeArtifactFileSystem } from "./fileSystem";

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof FsPromises>();

  return { ...actual, open: vi.fn(actual.open) };
});
const actual = await vi.importActual<typeof FsPromises>("node:fs/promises");
beforeEach(() => {
  vi.mocked(open).mockImplementation(actual.open);
});
afterEach(() => {
  vi.restoreAllMocks();
});

const fixture = async () => {
  const root = await mkdtemp(join(tmpdir(), "ordine-r8-handles-"));
  const fileSystem = await initializeArtifactFileSystem(root, 100);
  const id = randomUUID();
  const content = new TextEncoder().encode("verified bytes");
  await fileSystem.stage(`inputs/${id}`, id, content);

  return { root, fileSystem, id, content };
};

describe("artifact handle and path failure boundaries", () => {
  it("never replaces an existing destination file", async () => {
    const test = await fixture();
    const id = randomUUID();
    const destination = join(test.root, "inputs", id);
    await actual.writeFile(destination, "retained content", "utf8");
    await expect(test.fileSystem.stage(`inputs/${id}`, id, test.content)).rejects.toMatchObject({
      code: "ARTIFACT_STORAGE_COLLISION",
    });
    expect(await actual.readFile(destination, "utf8")).toBe("retained content");
  });
  it("closes the opened file when a real read fails", async () => {
    const test = await fixture();
    const handles: FileHandle[] = [];
    vi.mocked(open).mockImplementation(async (path, flags, mode) => {
      const handle = await actual.open(path, flags, mode);
      handles.push(handle);
      vi.spyOn(handle, "read").mockRejectedValueOnce(new Error("read failed"));

      return handle;
    });
    await expect(test.fileSystem.readVerifiedFile(`inputs/${test.id}`)).rejects.toMatchObject({
      code: "ARTIFACT_IO_FAILED",
    });
    expect(handles).toHaveLength(1);
    expect(handles.every((handle) => handle.fd === -1)).toBe(true);
  });

  it.each(["ENOSPC", "EACCES", "EBUSY"])(
    "closes temporary output handles after %s",
    async (code) => {
      const test = await fixture();
      const handles: FileHandle[] = [];
      vi.mocked(open).mockImplementation(async (path, flags, mode) => {
        const handle = await actual.open(path, flags, mode);
        handles.push(handle);
        if (String(path).includes(".tmp-"))
          vi.spyOn(handle, "writeFile").mockRejectedValueOnce(
            Object.assign(new Error(code), { code }),
          );

        return handle;
      });
      const id = randomUUID();
      await expect(test.fileSystem.stage(`inputs/${id}`, id, test.content)).rejects.toMatchObject({
        code: "ARTIFACT_IO_FAILED",
      });
      expect(handles.length).toBeGreaterThan(0);
      expect(handles.every((handle) => handle.fd === -1)).toBe(true);
    },
  );

  it("preserves native write cancellation and closes the handle", async () => {
    const test = await fixture();
    const handles: FileHandle[] = [];
    vi.mocked(open).mockImplementation(async (path, flags, mode) => {
      const handle = await actual.open(path, flags, mode);
      handles.push(handle);
      vi.spyOn(handle, "writeFile").mockRejectedValueOnce(
        Object.assign(new Error("aborted"), { name: "AbortError" }),
      );

      return handle;
    });
    const id = randomUUID();
    await expect(test.fileSystem.stage(`inputs/${id}`, id, test.content)).rejects.toMatchObject({
      code: "ARTIFACT_ABORTED",
    });
    expect(handles.every((handle) => handle.fd === -1)).toBe(true);
  });

  it("closes handles when cancellation arrives after open", async () => {
    const test = await fixture();
    const controller = new AbortController();
    const handles: FileHandle[] = [];
    vi.mocked(open).mockImplementation(async (path, flags, mode) => {
      const handle = await actual.open(path, flags, mode);
      handles.push(handle);
      controller.abort();

      return handle;
    });
    await expect(
      test.fileSystem.readVerifiedFile(`inputs/${test.id}`, controller.signal),
    ).rejects.toMatchObject({ code: "ARTIFACT_ABORTED" });
    expect(handles.every((handle) => handle.fd === -1)).toBe(true);
  });

  it("rejects replacement between the path check and open even with identical content", async () => {
    const test = await fixture();
    const handles: FileHandle[] = [];
    vi.mocked(open).mockImplementation(async (path, flags, mode) => {
      await actual.rename(path, `${String(path)}.retained`);
      await actual.writeFile(path, test.content);
      const handle = await actual.open(path, flags, mode);
      handles.push(handle);

      return handle;
    });
    await expect(test.fileSystem.readVerifiedFile(`inputs/${test.id}`)).rejects.toMatchObject({
      code: "ARTIFACT_FILE_CHANGED",
    });
    expect(handles.every((handle) => handle.fd === -1)).toBe(true);
  });

  it("rejects a replaced canonical root instead of entering a new directory", async () => {
    const test = await fixture();
    await actual.rename(test.root, `${test.root}-retained`);
    await actual.mkdir(test.root);
    await expect(test.fileSystem.readVerifiedFile(`inputs/${test.id}`)).rejects.toMatchObject({
      code: "ARTIFACT_ROOT_CHANGED",
    });
  });
});

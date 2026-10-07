import { tmpdir } from "node:os";
import { extname, resolve, sep } from "node:path";

export const toSafeStoragePath = (sessionId: string, attachmentId: string, filename: string) => {
  const storageDir = resolve(
    tmpdir(),
    "ordine",
    "pipeline-agent-sessions",
    sessionId.replaceAll(/[^a-zA-Z0-9_-]/g, "_"),
  );
  const extension = extname(filename)
    .replaceAll(/[^a-zA-Z0-9.]/g, "")
    .slice(0, 16);
  const storageKey = resolve(storageDir, `${attachmentId}${extension}`);

  if (!storageKey.startsWith(`${storageDir}${sep}`) && storageKey !== storageDir) {
    throw new Error("Attachment storage path escaped the session directory");
  }

  return { storageDir, storageKey };
};

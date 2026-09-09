import { ResultAsync } from "neverthrow";
import { EXECUTION_MAX_INPUT_ASSET_BYTES } from "@repo/schemas";

export const encodeExecutionFile = async (file: File) => {
  if (file.size > EXECUTION_MAX_INPUT_ASSET_BYTES) throw new Error("输入文件最大 8 MiB");
  const result = await ResultAsync.fromPromise(
    file.arrayBuffer(),
    () => new Error("无法读取选定文件"),
  );
  if (result.isErr()) throw result.error;
  const bytes = new Uint8Array(result.value);
  const chunks = Array.from({ length: Math.ceil(bytes.length / 8192) }, (_, index) =>
    String.fromCodePoint(...bytes.subarray(index * 8192, (index + 1) * 8192)),
  );

  return {
    importRequestId: crypto.randomUUID(),
    name: file.name,
    mimeType: file.type || "application/octet-stream",
    contentBase64: btoa(chunks.join("")),
  };
};

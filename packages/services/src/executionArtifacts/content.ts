import { createHash } from "node:crypto";
import { Result } from "neverthrow";
import { ExecutionArtifactNameSchema, ExecutionArtifactSchema } from "@repo/schemas";
import { ArtifactStoreError } from "./errors";

export const artifactHash = (bytes: Uint8Array): string =>
  createHash("sha256").update(bytes).digest("hex");

export const normalizeArtifactDescription = (name: string, mimeType: string) => {
  const parsedName = ExecutionArtifactNameSchema.safeParse(name);
  const parsedMime = ExecutionArtifactSchema.shape.mimeType.safeParse(mimeType);
  if (!parsedName.success || !parsedMime.success || /\p{Cc}/u.test(mimeType))
    throw new ArtifactStoreError(
      "ARTIFACT_DESCRIPTION_INVALID",
      "Artifact name or MIME type is invalid.",
    );
  const parts = mimeType.split(";").map((part) => part.trim());
  const mime = parts[0]!.toLowerCase();
  if (!/^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/u.test(mime))
    throw new ArtifactStoreError("ARTIFACT_DESCRIPTION_INVALID", "Artifact MIME type is invalid.");
  const text = mime.startsWith("text/") || mime === "application/json" || mime.endsWith("+json");
  if (
    parts.slice(1).some((part) => !/^charset=(?:utf-8|"utf-8")$/iu.test(part)) ||
    (!text && parts.length > 1)
  )
    throw new ArtifactStoreError(
      "ARTIFACT_DESCRIPTION_INVALID",
      "Artifact MIME parameters are not supported.",
    );

  return { name: parsedName.data, mimeType: mime };
};

export const validateArtifactContent = (bytes: Uint8Array, mimeType: string): void => {
  if (
    !mimeType.startsWith("text/") &&
    mimeType !== "application/json" &&
    !mimeType.endsWith("+json")
  )
    return;
  const decoded = Result.fromThrowable(
    () => new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    () => new ArtifactStoreError("ARTIFACT_ENCODING_INVALID", "Text artifact is not valid UTF-8."),
  )();
  if (decoded.isErr()) throw decoded.error;
  if (mimeType === "application/json" || mimeType.endsWith("+json")) {
    const parsed = Result.fromThrowable(
      () => JSON.parse(decoded.value),
      () =>
        new ArtifactStoreError(
          "ARTIFACT_JSON_INVALID",
          "JSON artifact does not contain valid JSON.",
        ),
    )();
    if (parsed.isErr()) throw parsed.error;
  }
};

import {
  ExecutionArtifactSchema,
  ExecutionPortDefinitionsSchema,
  ExecutionPortValuesSchema,
  type ExecutionArtifact,
  type ExecutionError,
  type ExecutionPortDefinition,
  type ExecutionPortValues,
  type ExecutionValue,
} from "@repo/schemas";
import { err, ok, ResultAsync, type Result } from "neverthrow";
import { compilePortJsonSchema } from "./jsonSchema";
import { executionError } from "./errors";

export type ArtifactMetadata = Pick<
  ExecutionArtifact,
  "artifactId" | "mimeType" | "sizeBytes" | "sha256"
>;
export type ArtifactMetadataLookup = (
  artifactId: string,
) => Promise<Result<ArtifactMetadata, ExecutionError>>;
const ArtifactMetadataSchema = ExecutionArtifactSchema.pick({
  artifactId: true,
  mimeType: true,
  sizeBytes: true,
  sha256: true,
});
const mimeToken = "[A-Za-z0-9][A-Za-z0-9!#$&^_.+-]*";
const exactMime = new RegExp(`^${mimeToken}/${mimeToken}$`, "u");
const acceptedMime = new RegExp(`^(?:${mimeToken}/(?:${mimeToken}|\\*)|\\*/\\*)$`, "u");

export const validatePortDefinition = (
  port: ExecutionPortDefinition,
): Result<void, ExecutionError> => {
  if (port.mimeTypes?.some((mime) => !acceptedMime.test(mime)))
    return err(
      executionError("MIME_PATTERN_INVALID", "MIME filters must be exact types, type/*, or */*", {
        portId: port.id,
      }),
    );
  if (port.jsonSchema !== undefined) {
    const compiled = compilePortJsonSchema(port.jsonSchema);
    if (compiled.isErr()) return err({ ...compiled.error, portId: port.id });
  }

  return ok(undefined);
};

export const isEmptyInlineValue = (value: ExecutionValue): boolean => {
  if (value.kind === "artifact") return false;
  if (value.kind === "text") return value.value.length === 0;
  const json = value.value;

  return (
    json === null ||
    json === "" ||
    (Array.isArray(json)
      ? json.length === 0
      : typeof json === "object" && Object.keys(json).length === 0)
  );
};

export const lookupArtifact = (
  artifactId: string,
  getArtifact: ArtifactMetadataLookup,
): ResultAsync<ArtifactMetadata, ExecutionError> =>
  ResultAsync.fromPromise(
    Promise.resolve().then(() => getArtifact(artifactId)),
    () =>
      executionError("ARTIFACT_LOOKUP_FAILED", "Artifact registry lookup failed", {
        stage: "artifact",
      }),
  )
    .andThen((result) => result)
    .andThen((metadata) => {
      const parsed = ArtifactMetadataSchema.safeParse(metadata);
      if (
        !parsed.success ||
        metadata.artifactId !== artifactId ||
        !exactMime.test(metadata.mimeType)
      )
        return err(
          executionError(
            "ARTIFACT_METADATA_INVALID",
            "Artifact registry returned invalid or mismatched metadata",
            { stage: "artifact" },
          ),
        );

      return ok(metadata);
    });

/** Validation preserves original JSON keys and object identity; it never strips values. */
export const validatePortValues = (
  ports: ExecutionPortDefinition[],
  values: ExecutionPortValues,
  getArtifact: ArtifactMetadataLookup,
): ResultAsync<ExecutionPortValues, ExecutionError> =>
  ResultAsync.fromPromise(
    (async (): Promise<Result<ExecutionPortValues, ExecutionError>> => {
      if (
        !ExecutionPortDefinitionsSchema.safeParse(ports).success ||
        !ExecutionPortValuesSchema.safeParse(values).success
      )
        return err(
          executionError(
            "PORT_VALUES_INVALID",
            "Port definitions or values violate the execution contract",
          ),
        );
      const declared = new Set(ports.map((port) => port.id));
      for (const id of Object.keys(values))
        if (!declared.has(id))
          return err(
            executionError("PORT_UNKNOWN", "Values reference an undeclared port", { portId: id }),
          );
      for (const port of ports) {
        const definition = validatePortDefinition(port);
        if (definition.isErr()) return err(definition.error);
        const list = values[port.id];
        if (list === undefined) {
          if (port.required)
            return err(
              executionError("PORT_REQUIRED", "A required port is absent", { portId: port.id }),
            );
          continue;
        }
        if (
          (port.cardinality === "one" && list.length !== 1) ||
          (list.length === 0 && !port.allowEmpty)
        )
          return err(
            executionError("PORT_CARDINALITY", "Port value cardinality or emptiness is invalid", {
              portId: port.id,
            }),
          );
        const jsonValidator =
          port.jsonSchema === undefined ? undefined : compilePortJsonSchema(port.jsonSchema);
        if (jsonValidator?.isErr()) return err(jsonValidator.error);
        for (const value of list) {
          if (value.kind !== port.valueType)
            return err(
              executionError("PORT_TYPE_MISMATCH", "Port value type differs from its declaration", {
                portId: port.id,
              }),
            );
          if (!port.allowEmpty && isEmptyInlineValue(value))
            return err(
              executionError("PORT_EMPTY", "Port does not permit empty values", {
                portId: port.id,
              }),
            );
          if (
            value.kind === "json" &&
            jsonValidator?.isOk() &&
            !jsonValidator.value.safeParse(value.value).success
          )
            return err(
              executionError("JSON_VALUE_INVALID", "JSON value does not satisfy the port schema", {
                portId: port.id,
              }),
            );
          if (value.kind === "artifact") {
            const lookup = await lookupArtifact(value.artifactId, getArtifact);
            if (lookup.isErr()) return err({ ...lookup.error, portId: port.id });
            const metadata = lookup.value;
            if (!port.allowEmpty && metadata.sizeBytes === 0)
              return err(
                executionError("PORT_EMPTY", "Port does not permit zero-byte artifacts", {
                  portId: port.id,
                }),
              );
            if (
              port.mimeTypes !== undefined &&
              !port.mimeTypes.some(
                (pattern) =>
                  pattern === "*/*" ||
                  pattern.toLowerCase() === metadata.mimeType.toLowerCase() ||
                  (pattern.endsWith("/*") &&
                    metadata.mimeType.toLowerCase().startsWith(pattern.slice(0, -1).toLowerCase())),
              )
            )
              return err(
                executionError(
                  "MIME_TYPE_MISMATCH",
                  "Artifact MIME type does not satisfy the port declaration",
                  { portId: port.id },
                ),
              );
          }
        }
      }

      return ok(values);
    })(),
    () => executionError("PORT_VALIDATION_FAILED", "Port validation failed unexpectedly"),
  ).andThen((result) => result);

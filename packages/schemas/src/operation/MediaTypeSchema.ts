import { z } from "zod/v4";

/** A MIME type accepted by an input port. Either half may be a wildcard. */
export const MediaTypePatternSchema = z
  .string()
  .regex(/^(\*|[!#$&^_.+\-a-z0-9]+)\/(\*|[!#$&^_.+\-a-z0-9]+)$/i);
export type MediaTypePattern = z.infer<typeof MediaTypePatternSchema>;

/** A concrete MIME type emitted by an operation or stored in a handoff. */
export const ConcreteMediaTypeSchema = MediaTypePatternSchema.refine(
  (value) => !value.includes("*"),
  "Artifacts must have a concrete media type",
);
export type ConcreteMediaType = z.infer<typeof ConcreteMediaTypeSchema>;

export const mediaTypeMatches = (pattern: string, actual: string): boolean => {
  const [expectedType, expectedSubtype] = pattern.toLowerCase().split("/");
  const [actualType, actualSubtype] = actual.toLowerCase().split("/");

  return (
    (expectedType === "*" || expectedType === actualType) &&
    (expectedSubtype === "*" || expectedSubtype === actualSubtype)
  );
};

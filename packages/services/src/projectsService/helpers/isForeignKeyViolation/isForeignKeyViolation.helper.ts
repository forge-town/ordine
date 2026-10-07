/**
 * Postgres foreign-key violations (SQLSTATE 23503) on delete mean the project
 * is still referenced (e.g. a pipeline was attached between our check and the
 * delete); they keep 409 semantics instead of degrading to a 500.
 */
export const isForeignKeyViolation = (error: unknown): boolean =>
  typeof error === "object" && error !== null && (error as { code?: unknown }).code === "23503";

export class ServiceError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

export class NotFoundError extends Error {
  constructor(
    readonly resource: string,
    readonly id: string,
  ) {
    super(`${resource}:${id} not found`);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

export const toServiceError = (error: unknown, action: string) => {
  if (
    error instanceof ServiceError ||
    error instanceof NotFoundError ||
    error instanceof ConflictError
  ) {
    return error;
  }

  return new ServiceError(`${action} failed`, error);
};

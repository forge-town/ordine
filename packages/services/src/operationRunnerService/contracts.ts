export class OperationNotFoundError extends Error {
  constructor(operationId: string) {
    super(`Operation ${operationId} not found`);
    this.name = "OperationNotFoundError";
  }
}

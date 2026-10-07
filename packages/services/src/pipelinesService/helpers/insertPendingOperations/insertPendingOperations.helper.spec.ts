import { describe, expect, it } from "vitest";
import { createInsertPendingOperationsHelper } from "./insertPendingOperations.helper";
import { errAsync } from "neverthrow";
describe("insertPendingOperations", () => {
  it("retains the Pipeline content and error boundary", async () => {
    const cause = new Error("Capability catalog unavailable");
    const insert = createInsertPendingOperationsHelper({
      getCapabilityCatalog: () => ({ validateOperationInputs: () => errAsync(cause) }),
    } as never);
    await expect(
      insert({} as never, [
        {
          id: "op-1",
          name: "Review",
          description: "Review input",
          config: {},
          acceptedObjectTypes: ["file"],
        },
      ]),
    ).rejects.toBe(cause);
  });
});

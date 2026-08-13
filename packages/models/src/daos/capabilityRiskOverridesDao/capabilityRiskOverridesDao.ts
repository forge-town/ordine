import { desc, eq } from "drizzle-orm";
import { capabilityRiskOverridesTable } from "@repo/db-schema";
import type { CapabilityRiskTier } from "@repo/schemas";
import type { DbExecutor } from "../../types";

export class CapabilityRiskOverridesDao {
  constructor(readonly executor: DbExecutor) {}

  async findMany() {
    return this.executor
      .select()
      .from(capabilityRiskOverridesTable)
      .orderBy(desc(capabilityRiskOverridesTable.updatedAt));
  }

  async upsert(capabilityId: string, riskTier: CapabilityRiskTier) {
    const now = new Date();
    const [record] = await this.executor
      .insert(capabilityRiskOverridesTable)
      .values({ capabilityId, riskTier, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({
        target: capabilityRiskOverridesTable.capabilityId,
        set: { riskTier, updatedAt: now },
      })
      .returning();

    return record!;
  }

  async delete(capabilityId: string) {
    await this.executor
      .delete(capabilityRiskOverridesTable)
      .where(eq(capabilityRiskOverridesTable.capabilityId, capabilityId));
  }
}

export const createCapabilityRiskOverridesDao = (executor: DbExecutor) =>
  new CapabilityRiskOverridesDao(executor);

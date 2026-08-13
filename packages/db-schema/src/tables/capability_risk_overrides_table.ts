import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import type { CapabilityRiskTier } from "@repo/schemas";

export const capabilityRiskOverridesTable = pgTable("capability_risk_overrides", {
  capabilityId: text("capability_id").primaryKey(),
  riskTier: text("risk_tier").$type<CapabilityRiskTier>().notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type CapabilityRiskOverrideRecord = typeof capabilityRiskOverridesTable.$inferSelect;

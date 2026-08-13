import {
  GetCapabilityCatalogInputSchema,
  SetCapabilityRiskTierOverrideInputSchema,
} from "@repo/schemas";
import { authedProcedure, publicProcedure, router } from "../init";
import { capabilityCatalogService } from "../services";
import { unwrapResult } from "./result";

export const capabilityCatalogRouter = router({
  getMany: publicProcedure
    .input(GetCapabilityCatalogInputSchema.optional())
    .query(async ({ input }) => unwrapResult(await capabilityCatalogService.getMany(input ?? {}))),

  setRiskTierOverride: authedProcedure
    .input(SetCapabilityRiskTierOverrideInputSchema)
    .mutation(async ({ input }) =>
      unwrapResult(await capabilityCatalogService.setRiskTierOverride(input)),
    ),
});

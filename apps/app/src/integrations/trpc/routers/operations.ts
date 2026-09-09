import { legacyExecutionDisabled } from "./legacyExecutionDisabled";
import { z } from "zod/v4";
import { authedProcedure, publicProcedure, router } from "../init";
import { operationsService, operationExecutionPublisher } from "../services";
import { TRPCError } from "@trpc/server";
import { getServerEnv } from "@/integrations/server-env";
import { ObjectNodeTypeSchema, StrictOperationConfigSchema } from "@repo/schemas";
import { unwrapResult } from "./result";

export const operationsRouter = router({
  publishExecution: authedProcedure
    .input(z.strictObject({ operationId: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const owner = getServerEnv().ORDINE_EXECUTION_OWNER_USER_ID;
      const session = z.object({ user: z.object({ id: z.string() }) }).safeParse(ctx.session);
      if (!owner || !session.success || session.data.user.id !== owner)
        throw new TRPCError({ code: "FORBIDDEN", message: "此会话未绑定当前执行工作区。" });

      return unwrapResult(await operationExecutionPublisher.publish(input));
    }),
  getMany: publicProcedure.query(() => operationsService.getAll()),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => operationsService.getById(input.id)),

  create: publicProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string(),
        description: z.string().nullable().default(null),
        config: StrictOperationConfigSchema.optional(),
        acceptedObjectTypes: z
          .array(ObjectNodeTypeSchema)
          .default(["file", "folder", "github-project"]),
        sourceSkillId: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => unwrapResult(await operationsService.create(input))),

  update: publicProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        description: z.string().nullable().optional(),
        config: StrictOperationConfigSchema.optional(),
        acceptedObjectTypes: z.array(ObjectNodeTypeSchema).optional(),
        sourceSkillId: z.string().nullable().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { id, ...rest } = input;

      return unwrapResult(await operationsService.update(id, rest));
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => unwrapResult(await operationsService.delete(input.id))),

  run: publicProcedure.input(z.unknown().optional()).mutation(legacyExecutionDisabled),
});

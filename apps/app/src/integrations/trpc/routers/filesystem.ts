import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { publicProcedure, router } from "../init";
import { listDirectory } from "@repo/services";

export const filesystemRouter = router({
  browse: publicProcedure
    .input(z.object({ path: z.string().optional() }))
    .query(async ({ input }) => {
      const result = await listDirectory(input.path);
      if (result.isErr()) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: result.error.message,
        });
      }

      return result.value;
    }),
});

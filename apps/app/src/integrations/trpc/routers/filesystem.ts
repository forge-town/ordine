import { z } from "zod/v4";
import { publicProcedure, router } from "../init";
import { listDirectory } from "@/services/filesystemService";

export const filesystemRouter = router({
  browse: publicProcedure
    .input(z.object({ path: z.string().optional() }))
    .query(async ({ input }) => {
      const result = await listDirectory(input.path);
      if (result.isErr()) {
        throw new Error(result.error.message);
      }
      return result.value;
    }),
});

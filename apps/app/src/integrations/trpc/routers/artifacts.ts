import { z } from "zod/v4";
import { publicProcedure, router } from "../init";
import { artifactsService, settingsService } from "../services";

/** 预览只允许读取「默认输出路径」子树。未配置则返回空白名单（即只读能力关闭，inline 预览不受影响）。 */
const resolveAllowedRoots = async (): Promise<string[]> => {
  const settings = await settingsService.get();
  const root = settings?.defaultOutputPath?.trim();

  return root ? [root] : [];
};

export const artifactsRouter = router({
  listDir: publicProcedure.input(z.object({ dirPath: z.string() })).query(async ({ input }) =>
    artifactsService.listDir({
      allowedRoots: await resolveAllowedRoots(),
      dirPath: input.dirPath,
    }),
  ),

  readFile: publicProcedure.input(z.object({ filePath: z.string() })).query(async ({ input }) =>
    artifactsService.readFile({
      allowedRoots: await resolveAllowedRoots(),
      filePath: input.filePath,
    }),
  ),
});

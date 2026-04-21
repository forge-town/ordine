import { z } from "zod/v4";
import { definePlugin } from "@repo/plugin";

const DisclosureModeSchema = z.enum(["tree", "full", "files-only"]);

const GitHubProjectDataSchema = z.object({
  label: z.string(),
  sourceType: z.enum(["github", "local"]).optional(),
  owner: z.string(),
  repo: z.string(),
  branch: z.string().optional(),
  description: z.string().optional(),
  isPrivate: z.boolean().optional(),
  githubProjectId: z.string().optional(),
  localPath: z.string().optional(),
  disclosureMode: DisclosureModeSchema.optional(),
  excludedPaths: z.array(z.string()).optional(),
});

export const githubProjectsPlugin = definePlugin({
  id: "builtin:github-projects",
  name: "GitHub Projects",
  version: "1.0.0",
  objectTypes: [
    {
      id: "github-project",
      label: "GitHub Projects",
      icon: "github",
      dataSchema: GitHubProjectDataSchema,
      nodeHandler: async (ctx) => {
        const data = ctx.data as z.infer<typeof GitHubProjectDataSchema>;

        if (data.sourceType === "local") {
          const localPath = data.localPath ?? "";
          if (!localPath) {
            await ctx.trace("WARNING: GitHub project node (local) missing localPath, skipping");
            ctx.setOutput({ inputPath: "", content: "" });

            return { ok: true };
          }
          await ctx.trace(`Using local folder: ${localPath}`);
          ctx.setOutput({ inputPath: localPath, content: `Local Folder: ${localPath}` });

          return { ok: true };
        }

        const owner = data.owner;
        const repo = data.repo;
        const branch = data.branch ?? "main";

        if (!owner || !repo) {
          await ctx.trace("WARNING: GitHub project node missing owner/repo, skipping");
          ctx.setOutput({ inputPath: "", content: "" });

          return { ok: true };
        }

        await ctx.trace(`GitHub project: ${owner}/${repo}@${branch}`);
        ctx.setOutput({
          inputPath: ctx.input.inputPath,
          content: `Repository: ${owner}/${repo} (branch: ${branch})`,
        });

        return { ok: true };
      },
    },
  ],
});

import { z } from "zod/v4";
import { definePlugin } from "@repo/plugin";

export const apiEndpointPlugin = definePlugin({
  id: "builtin:api-endpoint",
  name: "API Endpoint",
  version: "1.0.0",
  objectTypes: [
    {
      id: "api-endpoint",
      label: "API Endpoints",
      icon: "globe",
      dataSchema: z.object({
        url: z.string().url(),
        method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
        headers: z.record(z.string(), z.string()).optional(),
      }),
      nodeHandler: async (ctx) => {
        await ctx.trace(`Calling API endpoint: ${(ctx.data as { url?: string }).url}`);
        ctx.setOutput({ inputPath: ctx.input.inputPath, content: ctx.input.content });

        return { ok: true };
      },
    },
  ],
});

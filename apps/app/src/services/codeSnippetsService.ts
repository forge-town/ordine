import { createServerFn } from "@tanstack/react-start";
import { z } from "zod/v4";
import { codeSnippetsDao } from "@repo/models";
import { CodeSnippetSchema } from "@repo/schemas";
import { createCodeSnippetsService } from "@repo/services";

const service = createCodeSnippetsService(codeSnippetsDao);

export const getCodeSnippetsByBestPracticeId = createServerFn({
  method: "GET",
})
  .inputValidator(z.object({ bestPracticeId: z.string() }))
  .handler(({ data }) => service.getByBestPracticeId(data.bestPracticeId));

export const getCodeSnippetById = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(({ data }) => service.getById(data.id));

export const createCodeSnippet = createServerFn({ method: "POST" })
  .inputValidator(CodeSnippetSchema)
  .handler(({ data }) => service.create(data));

export const updateCodeSnippet = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string(), patch: CodeSnippetSchema.partial() }))
  .handler(({ data }) => service.update(data.id, data.patch));

export const deleteCodeSnippet = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(({ data }) => service.delete(data.id));

export const deleteCodeSnippetsByBestPracticeId = createServerFn({ method: "POST" })
  .inputValidator(z.object({ bestPracticeId: z.string() }))
  .handler(({ data }) => service.deleteByBestPracticeId(data.bestPracticeId));

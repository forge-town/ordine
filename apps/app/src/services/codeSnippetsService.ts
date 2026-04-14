import { createServerFn } from "@tanstack/react-start";
import { z } from "zod/v4";
import { codeSnippetsDao } from "@repo/models";
import { CodeSnippetSchema } from "@/schemas";

export const getCodeSnippetsByBestPracticeId = createServerFn({
  method: "GET",
})
  .inputValidator(z.object({ bestPracticeId: z.string() }))
  .handler(({ data }) => codeSnippetsDao.findByBestPracticeId(data.bestPracticeId));

export const getCodeSnippetById = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(({ data }) => codeSnippetsDao.findById(data.id));

export const createCodeSnippet = createServerFn({ method: "POST" })
  .inputValidator(CodeSnippetSchema)
  .handler(({ data }) => codeSnippetsDao.create(data));

export const updateCodeSnippet = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string(), patch: CodeSnippetSchema.partial() }))
  .handler(({ data }) => codeSnippetsDao.update(data.id, data.patch));

export const deleteCodeSnippet = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(({ data }) => codeSnippetsDao.delete(data.id));

export const deleteCodeSnippetsByBestPracticeId = createServerFn({ method: "POST" })
  .inputValidator(z.object({ bestPracticeId: z.string() }))
  .handler(({ data }) => codeSnippetsDao.deleteByBestPracticeId(data.bestPracticeId));

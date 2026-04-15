import type { CodeSnippetEntity } from "@repo/models";

type CodeSnippetsDao = {
  findByBestPracticeId: (bestPracticeId: string) => Promise<CodeSnippetEntity[]>;
  findById: (id: string) => Promise<CodeSnippetEntity | null>;
  create: (data: Omit<CodeSnippetEntity, "createdAt" | "updatedAt">) => Promise<CodeSnippetEntity>;
  update: (
    id: string,
    patch: Partial<Omit<CodeSnippetEntity, "id" | "bestPracticeId" | "createdAt" | "updatedAt">>,
  ) => Promise<CodeSnippetEntity | null>;
  delete: (id: string) => Promise<void>;
  deleteByBestPracticeId: (bestPracticeId: string) => Promise<void>;
};

export const createCodeSnippetsService = (dao: CodeSnippetsDao) => ({
  getByBestPracticeId: (bestPracticeId: string) => dao.findByBestPracticeId(bestPracticeId),
  getById: (id: string) => dao.findById(id),
  create: (data: Omit<CodeSnippetEntity, "createdAt" | "updatedAt">) => dao.create(data),
  update: (
    id: string,
    patch: Partial<Omit<CodeSnippetEntity, "id" | "bestPracticeId" | "createdAt" | "updatedAt">>,
  ) => dao.update(id, patch),
  delete: (id: string) => dao.delete(id),
  deleteByBestPracticeId: (bestPracticeId: string) => dao.deleteByBestPracticeId(bestPracticeId),
});

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { githubProjectsDao } from "@/models/daos/githubProjectsDao";

export const getGithubProjects = createServerFn({ method: "GET" }).handler(
  async () => githubProjectsDao.findMany(),
);

export const getGithubProjectById = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => githubProjectsDao.findById(data.id));

const GithubProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().default(""),
  owner: z.string(),
  repo: z.string(),
  branch: z.string().default("main"),
  githubUrl: z.string(),
  isPrivate: z.boolean().default(false),
});

export const createGithubProject = createServerFn({ method: "POST" })
  .inputValidator(GithubProjectSchema)
  .handler(async ({ data }) => githubProjectsDao.create(data));

export const updateGithubProject = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({ id: z.string(), patch: GithubProjectSchema.partial() }),
  )
  .handler(async ({ data }) => githubProjectsDao.update(data.id, data.patch));

export const deleteGithubProject = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => githubProjectsDao.delete(data.id));

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod/v4";
import { githubProjectsDao } from "@repo/models";
import { GithubProjectSchema } from "@repo/schemas";
import { createGithubProjectsService } from "@repo/services";

const service = createGithubProjectsService(githubProjectsDao);

export const getGithubProjects = createServerFn({ method: "GET" }).handler(() => service.getAll());

export const getGithubProjectById = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(({ data }) => service.getById(data.id));

export const createGithubProject = createServerFn({ method: "POST" })
  .inputValidator(GithubProjectSchema)
  .handler(({ data }) => service.create(data));

export const updateGithubProject = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string(), patch: GithubProjectSchema.partial() }))
  .handler(({ data }) => service.update(data.id, data.patch));

export const deleteGithubProject = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(({ data }) => service.delete(data.id));

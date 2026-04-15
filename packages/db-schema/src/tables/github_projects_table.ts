import { text, boolean, timestamp, pgTable, unique } from "drizzle-orm/pg-core";

export const githubProjectsTable = pgTable(
  "github_projects",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    owner: text("owner").notNull(),
    repo: text("repo").notNull(),
    branch: text("branch").notNull().default("main"),
    githubUrl: text("github_url").notNull(),
    isPrivate: boolean("is_private").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    unq: unique("github_projects_owner_repo_branch_unique").on(
      table.owner,
      table.repo,
      table.branch,
    ),
  }),
);

export type GithubProjectRecord = typeof githubProjectsTable.$inferSelect;
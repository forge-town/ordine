import { describe, expect, it } from "vitest";
import { getTableConfig } from "drizzle-orm/pg-core";
import * as dbSchema from "../index";
import { jobsTable } from "./jobs_table";
import { pipelinesTable } from "./pipelines_table";

const exportsByName = dbSchema as Record<string, unknown>;

const tableConfig = (exportName: string) => {
  const table = exportsByName[exportName];
  expect(table, `${exportName} must be exported`).toBeDefined();

  return getTableConfig(table as Parameters<typeof getTableConfig>[0]);
};

const columnNames = (table: Parameters<typeof getTableConfig>[0]) =>
  getTableConfig(table).columns.map((column) => column.name);

describe("COD-115 database schema", () => {
  it("exports exactly the five new domain tables", () => {
    expect(
      [
        "projectsTable",
        "conversationMessagesTable",
        "routinesTable",
        "connectorsTable",
        "pipelineAssetsTable",
      ].map((name) => tableConfig(name).name),
    ).toEqual(["projects", "conversation_messages", "routines", "connectors", "pipeline_assets"]);
    expect(exportsByName.annotationsTable).toBeUndefined();
  });

  it("adds lookup indexes and cascading pipeline references", () => {
    const conversations = tableConfig("conversationMessagesTable");
    const routines = tableConfig("routinesTable");
    const assets = tableConfig("pipelineAssetsTable");

    expect(conversations.indexes.map((index) => index.config.name)).toEqual([
      "conversation_messages_pipeline_id_idx",
      "conversation_messages_created_at_idx",
    ]);
    expect(routines.indexes.map((index) => index.config.name)).toEqual([
      "routines_pipeline_id_idx",
      "routines_enabled_idx",
    ]);
    expect(assets.indexes.map((index) => index.config.name)).toEqual([
      "pipeline_assets_pipeline_id_idx",
    ]);

    for (const config of [conversations, routines, assets]) {
      expect(config.foreignKeys).toHaveLength(1);
      expect(config.foreignKeys[0]?.onDelete).toBe("cascade");
    }
  });

  it("extends pipelines and jobs with the reviewed persistent fields", () => {
    expect(columnNames(pipelinesTable)).toEqual(
      expect.arrayContaining(["project_id", "status", "version"]),
    );
    expect(columnNames(jobsTable)).toEqual(
      expect.arrayContaining([
        "pipeline_id",
        "project_id",
        "total_tokens",
        "triggered_by",
        "node_statuses",
      ]),
    );
    expect(columnNames(jobsTable)).not.toContain("total_cost");
  });
});

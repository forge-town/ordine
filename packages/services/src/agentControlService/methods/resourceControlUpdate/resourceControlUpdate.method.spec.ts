import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { describe, expect, it } from "vitest";

import * as schema from "@repo/db-schema";

import { createResourceControl } from "../../helpers/resourceControl";

const databaseUrl = process.env.ORDINE_PRODUCT_TEST_DATABASE_URL;

describe.skipIf(!databaseUrl)("Agent prepared submission", () => {
  it("updates only supplied Operation fields through the real authoring service", async ({
    onTestFinished,
  }) => {
    const url = new URL(databaseUrl!);
    expect(url.hostname).toBe("127.0.0.1");
    expect(url.port).toBe("36435");
    expect(url.pathname).toMatch(/^\/ordine_product_ui_[a-z0-9_]+$/u);
    const sql = postgres(databaseUrl!, { max: 1 });
    const id = `patch-check-${randomUUID()}`;
    onTestFinished(async () => {
      await sql`DELETE FROM operations WHERE id = ${id}`;
      await sql.end();
    });
    const resources = createResourceControl(drizzle(sql, { schema }));
    const config = {
      inputs: [],
      outputs: [],
      executor: {
        type: "script",
        language: "javascript",
        command: "console.log('original')",
        outputMode: "text",
      },
    };
    const created = await resources.create("operation", {
      id,
      name: "Partial update verification",
      description: "Keep this description",
      acceptedObjectTypes: ["prompt"],
      config,
    });
    expect(created.isOk(), JSON.stringify(created)).toBe(true);
    const updated = await resources.update("operation", id, {
      config: { ...config, executor: { ...config.executor, command: "console.log('updated')" } },
    });
    expect(updated.isOk(), JSON.stringify(updated)).toBe(true);
    const [record] =
      await sql`SELECT description, accepted_object_types, config FROM operations WHERE id = ${id}`;
    expect(record!.description).toBe("Keep this description");
    expect(record!.accepted_object_types).toEqual(["prompt"]);
    expect(record!.config.executor.command).toBe("console.log('updated')");
    const cleared = await resources.update("operation", id, {
      description: "",
      acceptedObjectTypes: [],
    });
    expect(cleared.isOk()).toBe(true);
    const [explicit] =
      await sql`SELECT description, accepted_object_types, config FROM operations WHERE id = ${id}`;
    expect(explicit!.description).toBe("");
    expect(explicit!.accepted_object_types).toEqual([]);
    expect(explicit!.config.executor.command).toBe("console.log('updated')");
  });
});

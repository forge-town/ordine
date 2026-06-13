import postgres from "postgres";
import { drizzle as drizzlePg, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { PGlite } from "@electric-sql/pglite";
import * as schema from "@repo/db-schema";

import { getEnv } from "./integrations/env";

const { DATABASE_URL, PGLITE_DATA_DIR, PGLITE_MIGRATIONS_DIR } = getEnv();

const runPgliteMigrations = async (client: PGlite, migrationsDir: string): Promise<void> => {
  await client.exec(`
    CREATE TABLE IF NOT EXISTS _ordine_migrations (
      id serial PRIMARY KEY,
      name text NOT NULL UNIQUE,
      applied_at timestamp DEFAULT now() NOT NULL
    )
  `);

  const appliedResult = await client.query<{ name: string }>(`SELECT name FROM _ordine_migrations`);
  const appliedSet = new Set(appliedResult.rows.map((r) => r.name));

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const pending = files.filter((f) => !appliedSet.has(f));

  for (const file of pending) {
    const content = readFileSync(join(migrationsDir, file), "utf8");
    const statements = content
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const statement of statements) {
      await client.exec(statement);
    }

    await client.exec(
      `INSERT INTO _ordine_migrations (name) VALUES ('${file.replaceAll("'", "''")}')`,
    );
  }

  if (pending.length > 0) {
    console.log(`[PGlite] Applied ${pending.length} migration(s)`);
  }
};

const createDb = async (): Promise<PostgresJsDatabase<Record<string, unknown>>> => {
  if (PGLITE_DATA_DIR) {
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle: drizzlePglite } = await import("drizzle-orm/pglite");
    const client = new PGlite(PGLITE_DATA_DIR);

    if (PGLITE_MIGRATIONS_DIR) {
      await runPgliteMigrations(client, PGLITE_MIGRATIONS_DIR);
    }

    return drizzlePglite(client, { schema: { ...schema } }) as unknown as PostgresJsDatabase<
      Record<string, unknown>
    >;
  }

  const client = postgres(DATABASE_URL!);

  return drizzlePg(client, { schema: { ...schema } });
};

/**
 * PGlite 对同一数据目录是独占的（持有文件锁）。vite/SSR 热重载会重新求值本
 * 模块，若每次都 `new PGlite(PGLITE_DATA_DIR)` 就会与存活的旧实例抢锁，导致整
 * 个 SSR 模块失效、全路由 500（实测改 packages/services 必崩的根因）。
 * 把首个连接 promise 缓存到 globalThis，HMR 重新求值时复用同一实例。
 */
const globalForDb = globalThis as unknown as {
  __ordineDbPromise?: Promise<PostgresJsDatabase<Record<string, unknown>>>;
};

const dbPromise = globalForDb.__ordineDbPromise ?? createDb();
globalForDb.__ordineDbPromise = dbPromise;

export const db = await dbPromise;

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "@repo/db-schema";

import { getEnv } from "./integrations/env";

const { DATABASE_URL, ORDINE_AUTHORING_SCHEMA } = getEnv();
const client = postgres(
  DATABASE_URL,
  ORDINE_AUTHORING_SCHEMA ? { connection: { search_path: ORDINE_AUTHORING_SCHEMA } } : {},
);

export const db = drizzle(client, { schema: { ...schema } });
export const closeAuthoringConnection = () => client.end({ timeout: 5 });

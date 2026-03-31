import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "@/models/tables/pipelines_table";

const client = postgres(process.env["DATABASE_URL"]!);

export const db = drizzle(client, { schema });

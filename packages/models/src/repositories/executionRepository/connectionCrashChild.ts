// Isolated fault-injection entry point; never imported by the application or library barrel.
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { ExecutionPrincipalSchema, PreparedRunSchema, RunRequestInputSchema } from "@repo/schemas";
import type { DbConnection } from "../../types";
import { createExecutionRepository } from "./executionRepository";
import { hashExecutionJson } from "./executionHash";

const [namespace, fixtureJson] = process.argv.slice(2);
const url = process.env.ORDINE_EXECUTION_TEST_DATABASE_URL;
if (
  !namespace ||
  !/^execution_r5_[a-f0-9]{32}$/u.test(namespace) ||
  !fixtureJson ||
  url !== "postgres://postgres@127.0.0.1:36435/ordine_pipeline_v2_r5"
)
  throw new Error("Only the explicit isolated crash-test database is allowed");
const fixture = JSON.parse(fixtureJson);
const principal = ExecutionPrincipalSchema.parse(fixture.principal);
const input = RunRequestInputSchema.parse(fixture.input);
const prepared = PreparedRunSchema.parse(fixture.prepared);
const sql = postgres(url, { max: 1, connection: { search_path: namespace }, onnotice: () => {} });
const repository = createExecutionRepository(drizzle(sql) as DbConnection);
await repository.submitRun(principal, input, hashExecutionJson(input), prepared, 60_000).then(
  () => {
    console.error("UNEXPECTED_ACCEPTANCE");
    process.exitCode = 2;
  },
  (error) => {
    const code = String(error?.cause?.code ?? error?.code);
    if (/57P01|CONNECTION_CLOSED|CONNECTION_DESTROYED/u.test(code))
      console.log("EXPECTED_CONNECTION_FAILURE");
    else {
      console.error("UNEXPECTED_FAILURE");
      process.exitCode = 2;
    }
  },
);
await sql.end({ timeout: 1 });

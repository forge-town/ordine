import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/models/tables/*.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env["DATABASE_URL"] ??
      "postgresql://postgres:mysecretpassword@localhost:5432/ordine",
  },
});

import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { skillsRoutes } from "./routes/skills.js";

export const app = new Hono();

app.use("*", logger());
app.use("*", cors());

app.route("/api/skills", skillsRoutes);

app.get("/health", (c) => c.json({ status: "ok" }));

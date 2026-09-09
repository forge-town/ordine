import { serve } from "@hono/node-server";
import { app } from "./app";
import { getEnv } from "./integrations/env";

// The original Agent transport uses Node connection bindings for internal MCP.
// Execution is delegated to the configured v2 service; this process owns drafts.
const env = getEnv();
if (
  !env.ORDINE_AGENT_API_TOKEN ||
  !env.ORDINE_EXECUTION_API_TARGET ||
  !env.ORDINE_EXECUTION_AGENT_TOKEN_FILE
) {
  console.error(
    "Configure the authoring API token, execution target and Agent credential file before starting the product API.",
  );
  process.exit(1);
}
serve({ hostname: "127.0.0.1", port: env.PORT ?? 9433, fetch: app.fetch }, () => {
  console.log(`ORDINE authoring API listening on 127.0.0.1:${env.PORT ?? 9433}`);
});

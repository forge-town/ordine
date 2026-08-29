import { router } from "./init";
import { agentsRouter } from "./routers/agents";

export const serverTrpcRouter = router({
  agents: agentsRouter,
});

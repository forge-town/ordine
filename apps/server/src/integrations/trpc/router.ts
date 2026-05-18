import { router } from "./init";
import { agentsRouter } from "./routers/agents";

export const serverTrpcRouter = router({
  agents: agentsRouter,
});

export type ServerTrpcRouter = typeof serverTrpcRouter;

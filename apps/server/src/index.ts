import { Result } from "neverthrow";
import { executionServerConfig, startExecutionServer } from "./executionServer";

const config = Result.fromThrowable(
  () => executionServerConfig(false),
  () =>
    "Set ORDINE_EXECUTION_DATABASE_URL and separate v2 application credentials before starting the server.",
)();
if (config.isErr()) {
  console.error(config.error);
  process.exit(1);
}
const started = await startExecutionServer(config.value);
if (started.isErr()) {
  console.error(started.error);
  process.exit(1);
}

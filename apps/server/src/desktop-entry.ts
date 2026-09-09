import { Result } from "neverthrow";
import { executionServerConfig, startExecutionServer } from "./executionServer";
import { createDesktopProduct } from "./createDesktopProduct";

const config = Result.fromThrowable(
  () => executionServerConfig(true),
  () => "Desktop requires explicit v2 database and credential configuration.",
)();
if (config.isErr()) {
  console.error(config.error);
  process.exit(1);
}
const started = await startExecutionServer(config.value, createDesktopProduct);
if (started.isErr()) {
  console.error(started.error);
  process.exit(1);
}

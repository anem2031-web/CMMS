import { startVitest } from "vitest/node";
import config from "./execution-vitest.config.mjs";
const runner = await startVitest(
  "test",
  [
    "tools/maintenance-team-tickets/execution-ui.test.tsx",
    "tools/maintenance-team-tickets/warehouse-ui.test.tsx",
  ],
  { config: false, watch: false },
  config
);
if (!runner) process.exitCode = 1;
else {
  if (
    runner.state.getFiles().some(file => file.result?.state === "fail") ||
    runner.state.getUnhandledErrors().length
  )
    process.exitCode = 1;
  await runner.close();
}

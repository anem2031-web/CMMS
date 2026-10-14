import { startVitest } from "vitest/node";
import baseConfig from "./execution-vitest.config.mjs";

const files = ["tools/maintenance-team-tickets/my-tasks-tabs.test.tsx"];
const runner = await startVitest(
  "test",
  files,
  { config: false, watch: false },
  {
    ...baseConfig,
    test: { ...baseConfig.test, include: files },
  }
);
if (!runner) process.exitCode = 1;
else {
  if (
    runner.state.getFiles().length !== 1 ||
    runner.state.getFiles().some(file => file.result?.state === "fail") ||
    runner.state.getUnhandledErrors().length
  )
    process.exitCode = 1;
  await runner.close();
}

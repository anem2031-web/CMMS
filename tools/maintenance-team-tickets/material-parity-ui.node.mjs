import { startVitest } from "vitest/node";
import baseConfig from "./execution-vitest.config.mjs";
const files = ["tools/maintenance-team-tickets/material-parity-ui.test.tsx"];
const runner = await startVitest(
  "test",
  files,
  { config: false, watch: false },
  { ...baseConfig, test: { ...baseConfig.test, include: files } }
);
if (!runner) process.exitCode = 1;
else {
  if (
    runner.state.getFiles().length !== 1 ||
    runner.state.getFiles().some(f => f.result?.state === "fail") ||
    runner.state.getUnhandledErrors().length
  )
    process.exitCode = 1;
  await runner.close();
}

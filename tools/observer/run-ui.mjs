import { startVitest } from "vitest/node";
import config from "../maintenance-team-tickets/execution-vitest.config.mjs";
const files = ["tools/observer/native-ui.test.tsx", "server/tests/authz.test.ts"];
const runner = await startVitest(
  "test",
  files,
  { config: false, watch: false },
  { ...config, test: { ...config.test, include: files } }
);
if (!runner) process.exitCode = 1;
else {
  if (
    runner.state.getFiles().length !== 2 ||
    runner.state.getFiles().some(f => f.result?.state === "fail") ||
    runner.state.getUnhandledErrors().length
  )
    process.exitCode = 1;
  await runner.close();
}

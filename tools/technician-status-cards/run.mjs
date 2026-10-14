import { startVitest } from "vitest/node";
import base from "../ticket-material-identity/vitest.config.mjs";
const config = { ...base, test: { ...base.test, include: [...base.test.include, "tools/technician-workspace/workspace-ui.test.tsx", "tools/technician-status-cards/buckets.test.tsx"] } };
const runner = await startVitest("test", config.test.include, { config: false, watch: false }, config);
if (!runner) process.exitCode = 1;
else { if (runner.state.getFiles().length !== config.test.include.length || runner.state.getFiles().some(file => file.result?.state === "fail") || runner.state.getUnhandledErrors().length) process.exitCode = 1; await runner.close(); }

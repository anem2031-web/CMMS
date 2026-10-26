import { startVitest } from "vitest/node";
import base from "../maintenance-team-tickets/execution-vitest.config.mjs";
const files = [
  "tools/maintenance-team-tickets/material-parity-ui.test.tsx",
  "tools/maintenance-team-tickets/execution-ui.test.tsx",
  "tools/maintenance-team-tickets/warehouse-ui.test.tsx",
  "tools/maintenance-team-tickets/warehouse-extra-ui.test.tsx",
  "tools/ticket-execution-parity/ui.test.tsx",
  "tools/ticket-material-identity/identity-ui.test.tsx",
];
const runner = await startVitest("test", files, { config: false, watch: false }, { ...base, test: { ...base.test, include: files } });
process.exitCode = !runner || runner.state.getFiles().length !== files.length || runner.state.getFiles().some(f => f.result?.state === "fail") || runner.state.getUnhandledErrors().length ? 1 : 0;
await runner?.close();

import { defineConfig } from "vitest/config";
import base from "../maintenance-team-tickets/execution-vitest.config.mjs";

export default defineConfig({
  ...base,
  test: {
    ...base.test,
    include: [
      "server/tests/operationalIssues.test.ts",
      "server/tests/operationalIssuesUi.test.tsx",
    ],
  },
});

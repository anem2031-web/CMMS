import base from "../maintenance-team-tickets/execution-vitest.config.mjs";
export default { ...base, test: { ...base.test, include: [
  "server/tests/purchaseItemNeedDate.test.ts",
  "server/tests/purchaseLeadDaysUi.test.tsx",
  "server/tests/purchaseNeedTimingSubmission.test.ts",
  "server/tests/technicianGuard.test.ts",
  "server/tests/technicianReferences.test.ts",
  "server/tests/authz.test.ts",
  "server/tests/dashboardAccess.test.ts",
  "tools/technician-workspace/workspace-ui.test.tsx",
  "tools/maintenance-team-tickets/execution-ui.test.tsx",
  "tools/maintenance-team-tickets/my-tasks-tabs.test.tsx",
  "tools/observer/native-ui.test.tsx",
] } };

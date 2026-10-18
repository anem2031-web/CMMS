import base from "../maintenance-team-tickets/execution-vitest.config.mjs";
export default { ...base, test: { ...base.test, include: [
  "server/tests/businessRolesGuard.test.ts", "server/tests/businessMediaAccess.test.ts", "server/tests/accountingSignature.test.ts",
  "server/tests/businessResourceBoundary.test.ts",
  "server/tests/authz.test.ts", "server/tests/technicianGuard.test.ts", "server/tests/dashboardAccess.test.ts",
  "server/tests/purchasePackageAccountingSubmissionPhase2.test.ts",
] } };

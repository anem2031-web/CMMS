import base from "./ui-vitest.config.mjs";
export default {
  ...base,
  test: {
    ...base.test,
    include: [
      "tools/inventory-settlement-review/ui.test.tsx",
      "tools/inventory-settlement-review/stale-warning-ui.test.tsx",
      "tools/inventory-settlement-review/posting.test.ts",
      "tools/inventory-settlement-permissions/review-service.test.ts",
      "tools/inventory-settlement-permissions/ui.test.tsx",
      "server/tests/inventorySettlementReviewPermissions.test.ts",
      "server/tests/inventorySettlementPermissions.test.ts",
      "server/tests/inventoryCountOpeningSnapshot.test.ts",
      "server/tests/inventoryCountUnifiedSearch.test.ts",
      "server/tests/inventoryCountSnapshotValuation.test.ts",
      "server/tests/inventoryCountSettlementCutoffGovernance.test.ts",
      "server/tests/inventorySettlementPhase4Step2Inputs.test.ts",
      "server/tests/inventorySettlementPhase4Step2Valuation.test.ts",
      "server/tests/inventorySettlementPhase4Step2Atomicity.test.ts",
      "server/tests/inventorySettlementPhase4Step3Ui.test.ts",
      "server/tests/businessRolesGuard.test.ts",
    ],
  },
};

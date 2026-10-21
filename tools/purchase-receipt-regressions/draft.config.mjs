import base from "./vitest.config.mjs";
export default { ...base, test: { ...base.test, include: [
  "server/tests/delegateOwnDraft.test.ts",
  "server/tests/authz.test.ts",
  "server/tests/purchaseNeedTimingSubmission.test.ts",
  "server/tests/purchaseItemNeedDate.test.ts",
  "server/tests/purchaseLeadDaysUi.test.tsx",
  "tools/improvement-center/router.test.ts",
  "tools/improvement-center/ui-state.test.tsx",
] } };

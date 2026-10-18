import base from "../maintenance-team-tickets/execution-vitest.config.mjs";
export default {
  ...base,
  test: { ...base.test, include: [
    "server/tests/delegatePricingBundles.test.ts",
    "server/tests/delegatePricingBundlesUi.test.tsx",
    "server/tests/pricingBundlePdfDownload.test.ts",
  ] },
};

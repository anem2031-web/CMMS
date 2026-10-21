import base from "./draft.config.mjs";
export default { ...base, test: { ...base.test, include: [
  ...base.test.include,
  "server/tests/catalogRequiredImage.test.ts",
  "server/tests/catalogFullAuditTrail.test.ts",
  "server/tests/catalogAuditGovernance.test.ts",
  "server/tests/catalogPickerAccess.test.ts",
] } };

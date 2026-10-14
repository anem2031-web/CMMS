import base from "../catalog-picker/vitest.config.mjs";
export default { ...base, test: { ...base.test, include: [...base.test.include, "tools/ticket-execution-parity/ui.test.tsx"] } };

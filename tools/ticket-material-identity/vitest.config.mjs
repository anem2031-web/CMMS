import base from "../ticket-execution-parity/vitest.config.mjs";
export default { ...base, test: { ...base.test, include: [...base.test.include, "tools/ticket-material-identity/identity-ui.test.tsx"] } };

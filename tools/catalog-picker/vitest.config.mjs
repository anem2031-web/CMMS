import base from "../maintenance-team-tickets/execution-vitest.config.mjs";
const files = [
  "tools/catalog-picker/picker.test.tsx",
  "tools/maintenance-team-tickets/execution-ui.test.tsx",
  "tools/maintenance-team-tickets/warehouse-ui.test.tsx",
  "tools/maintenance-team-tickets/warehouse-extra-ui.test.tsx",
  "tools/maintenance-team-tickets/material-parity-ui.test.tsx",
];
export default { ...base, test: { ...base.test, include: files } };

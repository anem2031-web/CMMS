import { spawnSync } from "node:child_process";
import fs from "node:fs";
const files = ["domain.node.ts", "execution-permissions.node.ts", "warehouse-navigation.node.ts", "assignment.node.tsx", "team-management.node.tsx", "views.node.tsx"];
const result = spawnSync(process.execPath, ["--import", "./tools/material-costs/forbid-network.mjs", "--import", "tsx", "--test", ...files.map(file => `server/maintenance-team-tickets/testing/${file}`)], {
  cwd: process.cwd(), windowsHide: true, encoding: "utf8", env: { ...process.env, DATABASE_URL: "", TSX_TSCONFIG_PATH: "tools/material-costs/domain.tsconfig.json" },
});
fs.writeFileSync("tools/material-costs/artifacts/domain-tests.txt", result.stdout + result.stderr);
console.log((result.stdout + result.stderr).split(/\r?\n/).filter(line => /^ℹ|^✖|^Error/.test(line)).join("\n"));
process.exitCode = result.status || 0;

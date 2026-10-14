import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import ts from "typescript";
const root = process.cwd();
const key = name => path.resolve(root, name).replaceAll("\\", "/").toLowerCase();
const read = name => fs.readFileSync(path.resolve(root, name), "utf8");
const added = new Set([
  "shared/dashboard-overview.ts", "server/services/dashboard/overview.ts", "server/services/dashboard/snapshots.ts",
  "client/src/pages/dashboard/FollowupDashboard.tsx", "client/src/pages/dashboard/copy.ts",
].map(key));
const original = new Map([
  [key("client/src/pages/dashboard/Home.tsx"), read("tools/dashboard-development/artifacts/Home.tsx.before")],
  [key("server/routers/system/dashboard.router.ts"), execFileSync("git", ["show", "HEAD:server/routers/system/dashboard.router.ts"], { cwd: root, encoding: "utf8" })],
  [key("shared/observer-native-reads.ts"), read("shared/observer-native-reads.ts").replace('  "dashboard.overview",\n', "").replace('  "dashboard.details",\n', "")],
  [key("client/src/i18n/ar.ts"), read("client/src/i18n/ar.ts").replace('totalCost: "قيمة المشتريات المستلمة"', 'totalCost: "إجمالي تكلفة الصيانة"')],
  [key("client/src/i18n/en.ts"), read("client/src/i18n/en.ts").replace('totalCost: "Received Purchases Value"', 'totalCost: "Total Maintenance Cost"')],
  [key("client/src/i18n/ur.ts"), read("client/src/i18n/ur.ts").replace('totalCost: "موصولہ خریداریوں کی مالیت"', 'totalCost: "کل دیکھ بھال لاگت"')],
]);
const config = ts.readConfigFile(path.join(root, "tsconfig.json"), ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
function check(baseline) {
  const host = ts.createCompilerHost(parsed.options);
  const get = host.getSourceFile.bind(host);
  if (baseline) host.getSourceFile = (name, version, error, fresh) => {
    if (original.has(key(name))) return ts.createSourceFile(name, original.get(key(name)), version, true);
    return get(name, version, error, fresh);
  };
  const program = ts.createProgram(parsed.fileNames.filter(name => !baseline || !added.has(key(name))), { ...parsed.options, incremental: false }, host);
  const diagnostics = ts.getPreEmitDiagnostics(program);
  return diagnostics.map(d => ({
    key: `${d.file ? key(d.file.fileName) : ""}|${d.code}|${ts.flattenDiagnosticMessageText(d.messageText, " ")}`,
    text: `${d.file ? path.relative(root, d.file.fileName) : "config"}:${d.file && d.start != null ? d.file.getLineAndCharacterOfPosition(d.start).line + 1 : 0} TS${d.code}: ${ts.flattenDiagnosticMessageText(d.messageText, " ")}`,
  }));
}
const before = check(true);
global.gc?.();
const after = check(false);
const counts = list => {
  const map = new Map();
  for (const diagnostic of list) map.set(diagnostic.key, (map.get(diagnostic.key) ?? 0) + 1);
  return map;
};
const oldCounts = counts(before), newCounts = counts(after);
const introduced = after.filter(d => {
  const left = oldCounts.get(d.key) ?? 0;
  if (left) { oldCounts.set(d.key, left - 1); return false; }
  return true;
});
fs.writeFileSync(path.join(root, "tools/dashboard-development/artifacts/typecheck-before.log"), before.map(d => d.text).join("\n"));
fs.writeFileSync(path.join(root, "tools/dashboard-development/artifacts/typecheck-current.log"), after.map(d => d.text).join("\n"));
fs.writeFileSync(path.join(root, "tools/dashboard-development/artifacts/typecheck-comparison.json"), JSON.stringify({ before: before.length, after: after.length, introduced: introduced.map(d => d.text) }, null, 2));
console.log(JSON.stringify({ before: before.length, after: after.length, introduced: introduced.map(d => d.text) }));
if (introduced.length) process.exitCode = 1;

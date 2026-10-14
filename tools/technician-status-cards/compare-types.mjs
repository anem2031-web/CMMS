import ts from "typescript";
import fs from "node:fs";
import path from "node:path";
const root = process.cwd();
const artifacts = path.join(root, "tools/technician-status-cards/artifacts");
const normalize = file => path.resolve(root, file).replaceAll("\\", "/").toLowerCase();
const manifest = JSON.parse(fs.readFileSync(path.join(artifacts, "before.json"), "utf8").replace(/^\uFEFF/, ""));
const originals = new Map(manifest.map(entry => [normalize(entry.file), fs.readFileSync(entry.backup, "utf8")]));
const added = new Set(["shared/technician-task-buckets.ts","client/src/components/maintenance/TechnicianStatusCards.tsx","client/src/pages/maintenance-teams/TechnicianTicketDashboard.tsx"].map(normalize));
const configuration = ts.readConfigFile(path.join(root, "tsconfig.json"), ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(configuration.config, ts.sys, root);
function check(before) {
  const host = ts.createCompilerHost(parsed.options);
  const originalRead = host.readFile.bind(host);
  if (before) host.readFile = file => originals.get(normalize(file)) ?? originalRead(file);
  const program = ts.createProgram({ rootNames: parsed.fileNames.filter(file => !before || !added.has(normalize(file))), options: { ...parsed.options, incremental: false }, host });
  return ts.getPreEmitDiagnostics(program).map(d => `${d.file ? path.relative(root, d.file.fileName).replaceAll("\\", "/") : "config"}: TS${d.code}: ${ts.flattenDiagnosticMessageText(d.messageText, " ")}`).sort();
}
const before = process.argv.includes("--current") ? fs.readFileSync(path.join(artifacts, "typecheck-current.log"), "utf8").split("\n").filter(Boolean) : check(true); global.gc?.(); const after = check(false);
const difference = (a, b) => { const remaining = [...b]; return a.filter(value => { const index = remaining.indexOf(value); if (index < 0) return true; remaining.splice(index, 1); return false; }); };
const result = { before: before.length, after: after.length, introduced: difference(after, before), resolved: difference(before, after) };
fs.writeFileSync(path.join(artifacts, "typecheck-comparison.json"), JSON.stringify(result, null, 2));
fs.writeFileSync(path.join(artifacts, "typecheck-current.log"), after.join("\n"));
console.log(JSON.stringify(result));
if (result.introduced.length) process.exitCode = 1;

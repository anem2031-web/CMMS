import ts from "typescript";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

// Compiler-only analysis: no application modules, environment or DB clients execute.
const root = process.cwd();
const normalize = value => path.resolve(value).replaceAll("\\", "/").toLowerCase();
const changed = execFileSync("git", ["diff", "--name-only"], { encoding: "utf8" }).trim().split(/\r?\n/).filter(Boolean);
const added = execFileSync("git", ["ls-files", "--others", "--exclude-standard"], { encoding: "utf8" }).trim().split(/\r?\n/).filter(Boolean);
const originals = new Map(changed.map(file => [normalize(file), execFileSync("git", ["show", `HEAD:${file}`], { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 })]));
const newFiles = new Set(added.map(normalize));
const read = ts.readConfigFile("tsconfig.json", ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, root);
function check(baseline) {
  const host = ts.createCompilerHost(parsed.options);
  const diskRead = host.readFile.bind(host), diskExists = host.fileExists.bind(host);
  if (baseline) {
    host.readFile = file => newFiles.has(normalize(file)) ? undefined : originals.get(normalize(file)) ?? diskRead(file);
    host.fileExists = file => !newFiles.has(normalize(file)) && diskExists(file);
  }
  const program = ts.createProgram(parsed.fileNames.filter(file => !baseline || !newFiles.has(normalize(file))), parsed.options, host);
  return ts.getPreEmitDiagnostics(program).map(d => ({
    file: d.file ? path.relative(root, d.file.fileName).replaceAll("\\", "/") : "",
    line: d.file && d.start != null ? d.file.getLineAndCharacterOfPosition(d.start).line + 1 : null,
    code: d.code, message: ts.flattenDiagnosticMessageText(d.messageText, "\n"),
  }));
}
const baseline = check(true), current = check(false);
const key = d => `${d.file}\n${d.code}\n${d.message}`;
const counts = new Map();
for (const d of baseline) counts.set(key(d), (counts.get(key(d)) || 0) + 1);
const introduced = current.filter(d => {
  const k = key(d), remaining = counts.get(k) || 0;
  if (remaining) { counts.set(k, remaining - 1); return false; }
  return true;
});
const report = { baselineCount: baseline.length, currentCount: current.length, introduced };
fs.writeFileSync("tools/read-scope-perf/type-results.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exitCode = introduced.length ? 1 : 0;


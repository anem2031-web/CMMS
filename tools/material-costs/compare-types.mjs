import ts from "typescript";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
const root = process.cwd(), artifacts = "tools/material-costs/artifacts";
const normalized = file => path.resolve(file).replaceAll("\\", "/").toLowerCase();
const tracked = execFileSync("git", ["diff", "--name-only", "--", "*.ts", "*.tsx"], { encoding: "utf8", windowsHide: true }).trim().split(/\r?\n/).filter(Boolean);
const originals = new Map(tracked.map(file => [normalized(file), execFileSync("git", ["show", `HEAD:${file}`], { encoding: "utf8", maxBuffer: 8 * 1024 * 1024, windowsHide: true })]));
const added = new Set(execFileSync("git", ["ls-files", "--others", "--exclude-standard"], { encoding: "utf8", windowsHide: true }).trim().split(/\r?\n/).filter(file => /\.(ts|tsx)$/.test(file)).map(normalized));
const config = ts.readConfigFile("tsconfig.json", ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
function check(before) {
 const host=ts.createCompilerHost(parsed.options), original=host.readFile.bind(host);
 if(before) host.readFile=file=>originals.get(normalized(file)) ?? original(file);
 const program=ts.createProgram({ rootNames: parsed.fileNames.filter(file=>!before || !added.has(normalized(file))), options: {...parsed.options, incremental:false},host });
 return ts.getPreEmitDiagnostics(program).map(d=>`${d.file?path.relative(root,d.file.fileName).replaceAll("\\","/"):"config"}: TS${d.code}: ${ts.flattenDiagnosticMessageText(d.messageText," ")}`).sort();
}
const before=process.argv.includes("--against-last") ? fs.readFileSync(`${artifacts}/type-current.txt`,"utf8").split("\n").filter(Boolean) : check(true); global.gc?.(); const after=check(false);
function difference(a,b) {const rest=[...b];return a.filter(item=>{const i=rest.indexOf(item);if(i<0)return true;rest.splice(i,1);return false;});}
const result={before:before.length,after:after.length,introduced:difference(after,before),resolved:difference(before,after)};
fs.mkdirSync(artifacts,{recursive:true});fs.writeFileSync(`${artifacts}/type-comparison.json`,JSON.stringify(result,null,2));fs.writeFileSync(`${artifacts}/type-current.txt`,after.join("\n"));
console.log(JSON.stringify(result));if(result.introduced.length)process.exitCode=1;

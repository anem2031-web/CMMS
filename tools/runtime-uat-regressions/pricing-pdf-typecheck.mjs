import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
const out = "docs/runtime-uat/2026-10-18";
const parsed = ts.getParsedCommandLineOfConfigFile("tsconfig.json", { incremental: false }, { ...ts.sys, onUnRecoverableConfigFileDiagnostic: d => { throw Error(ts.flattenDiagnosticMessageText(d.messageText,"\n")); } });
const program = ts.createProgram(parsed.fileNames, parsed.options);
const current = ts.getPreEmitDiagnostics(program).map(d=>({file:d.file?path.relative(process.cwd(),d.file.fileName).replaceAll("\\","/"):"config",code:d.code,message:ts.flattenDiagnosticMessageText(d.messageText,"\n")}));
const baseline = JSON.parse(fs.readFileSync("docs/runtime-uat/2026-10-17/fixes-typecheck-baseline.json","utf8")).filter(d=>!d.file.includes("parentTicketCompletion.test"));
// Five old diagnostics change their expanded table printer / union ordering
// when imports expand. Compare the passed argument, offending property and
// incompatible types, retaining the raw messages below for review. New files
// and all other diagnostics are compared literally.
const stableUnion = text => text.replace(/"[^"\n]+"(?:\s*\|\s*"[^"\n]+")+/g, union=>union.split("|").map(x=>x.trim()).sort().join(" | ")).replace(/'([^'\n]+)'/g,(full,type)=>type.includes("|")&&!type.includes("{")?`'${type.split("|").map(x=>x.trim()).sort().join(" | ")}'`:full);
function key(d) {
  let message=d.message;
  if(d.file==="client/src/pages/purchase/PurchaseOrderDetail.tsx"&&d.code===2339&&message.startsWith("Property 'submitForAccounting'")) message="Existing submitForAccounting dictionary diagnostic";
  if(d.code===2345&&["server/_core/db/purchase.ts","server/routers/construction/tasks.router.ts"].includes(d.file)&&message.includes("Types of property")) {
    message=message.split(" is not assignable to parameter of type ")[0]+"\n"+message.slice(message.indexOf("Types of property"));
    message=stableUnion(message);
  }
  if(d.code===2769&&["server/_core/db/users.ts","server/routers/construction/other-routers.ts"].includes(d.file)) {
    const argument=message.match(/Argument of type '([^\n]+?)' is not assignable/)?.[1]||"";
    const failures=Array.from(message.matchAll(/(?:Types of property '[^']+' are incompatible\.|Type '[^'\n]+' is not assignable to type '[^'\n]+?'\.|Object literal may only specify known properties, and '[^']+')/g),m=>stableUnion(m[0]));
    message=stableUnion(argument)+"\n"+failures.join("\n");
  }
  return JSON.stringify({...d,message});
}
const counts=new Map();for(const d of baseline)counts.set(key(d),(counts.get(key(d))||0)+1);
const added=current.filter(d=>{const count=counts.get(key(d))||0;if(!count)return true;counts.set(key(d),count-1);return false;});
const result={current:current.length,baseline:baseline.length,added,comparisonNote:"Known old table-printer/union changes compared by actual argument/property/type failure; raw diagnostics retained."};
fs.writeFileSync(`${out}/pricing-pdf-typecheck-current.json`,JSON.stringify(current,null,2));fs.writeFileSync(`${out}/pricing-pdf-typecheck.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result));if(added.length)process.exitCode=1;

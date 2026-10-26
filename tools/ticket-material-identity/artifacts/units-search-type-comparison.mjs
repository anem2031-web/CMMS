import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const cleanBefore = [
  'server/_core/catalog-item-matching.ts',
  'server/maintenance-team-tickets/material-identity-reader.ts',
  'server/routers/maintenance-teams/execution.router.ts',
  'shared/catalog-material-identity.ts',
  'shared/technician-policy.ts',
  'shared/maintenance-team-tickets/material-routing.ts',
  'shared/maintenance-team-tickets/warehouse-materials.ts',
  'client/src/components/catalog/MaterialIdentityDialog.tsx',
  'client/src/pages/maintenance-teams/TicketMaterialNeedPanel.tsx',
  'client/src/pages/maintenance-teams/TicketMaterialIdentityResolver.tsx',
  'client/src/pages/maintenance-teams/TicketWarehouseMaterialCard.tsx',
  'client/src/pages/maintenance-teams/TicketTechnicianMaterials.tsx',
];
const norm = f => path.resolve(f).replaceAll('\\','/').toLowerCase();
const old = new Map(cleanBefore.map(f => [norm(f), execFileSync('git', ['show', `HEAD:${f}`], { encoding: 'utf8' })]));
const service = 'server/maintenance-team-tickets/service.ts';
let s = fs.readFileSync(service, 'utf8');
s = s.slice(0, s.indexOf('  async materialUnitsContext(')) + s.slice(s.indexOf('  async materialIdentityContext('));
s = s.replace('        const differentUnit = n.unit !== item.unit;', `        if (n.unit !== item.unit)
          throw new TeamTicketError(
            "INVALID",
            "وحدة الاحتياج لا تطابق الصنف؛ لا يوجد تحويل وحدات تلقائي"
          );`);
const start = s.indexOf('        const resolutionNote = required(note, "سبب مطابقة الصنف")');
const end = s.indexOf('        const shortage = tracked', start);
s = s.slice(0, start) + '        const resolutionNote = required(note, "سبب مطابقة الصنف");\n' + s.slice(end);
s = s.replace('? differentUnit ? n.requested : Math.max(', '? Math.max(');
s = s.replace(/        const item = s\.catalog\.find\(item => item\.id === n\.catalogItemId && item\.active\);\r?\n        if \(!item \|\| item\.unit !== n\.unit\)\r?\n          throw new TeamTicketError\("INVALID", "تم ربط الصنف؛[^\n]+\r?\n/, '');
old.set(norm(service), s);
const config = ts.readConfigFile('tsconfig.json', ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, process.cwd());
function check(before) {
 const host = ts.createCompilerHost(parsed.options), read = host.readFile.bind(host);
 if (before) host.readFile = f => old.get(norm(f)) ?? read(f);
 const program = ts.createProgram({ rootNames: parsed.fileNames.filter(f => !before || !f.endsWith('/material-catalog-search.ts')), options: {...parsed.options, incremental:false}, host });
 return ts.getPreEmitDiagnostics(program).map(d => `${d.file ? path.relative(process.cwd(),d.file.fileName).replaceAll('\\','/') : 'config'}: TS${d.code}: ${ts.flattenDiagnosticMessageText(d.messageText,' ')}`).sort();
}
const before = check(true); global.gc?.(); const after = check(false);
function difference(a,b) { const remaining = [...b]; return a.filter(v => { const i=remaining.indexOf(v); if(i<0)return true;remaining.splice(i,1);return false; }); }
const result = {before:before.length, after:after.length, introduced:difference(after,before), resolved:difference(before,after)};
fs.writeFileSync('tools/ticket-material-identity/artifacts/units-search-type-comparison.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result));
process.exitCode = result.introduced.length ? 1 : 0;

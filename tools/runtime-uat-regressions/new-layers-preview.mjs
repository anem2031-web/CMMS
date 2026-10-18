import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { createRequire } from "node:module";
import { build } from "esbuild";
import { compile } from "@tailwindcss/node";
const root = process.cwd(), out = path.join(root,"docs/runtime-uat/2026-10-17");
const mock = (path) => ({ path, namespace: "fixture" });
const client = await build({ absWorkingDir: root, bundle:true, write:false, platform:"browser", target:"es2022", jsx:"automatic", tsconfigRaw:{}, define:{"process.env.NODE_ENV":'"production"'},
  stdin:{ loader:"tsx", resolveDir:root, contents:`import React from 'react'; import {createRoot} from 'react-dom/client'; import {Toaster} from 'sonner';
    import Pricing from './client/src/pages/purchase/DelegatePricingBundles'; import Manager from './client/src/pages/operational-issues/OperationalIssues'; import Warehouse from './client/src/pages/operational-issues/OperationalWarehouseRequests';
    const mode=new URLSearchParams(location.search).get('mode');createRoot(document.getElementById('root')).render(<><p className="p-4 text-sm text-muted-foreground">معاينة محلية ببيانات تجريبية — دون اتصال بالنظام أو القاعدة</p>{mode==='manager'?<Manager/>:mode==='warehouse'?<main className="p-6"><Warehouse/></main>:<Pricing/>}<Toaster/></>);` },
  plugins:[{name:"local-fixtures-only",setup(builder){
    builder.onResolve({filter:/^@\/(lib\/trpc|contexts\/LanguageContext|_core\/hooks\/useAuth)$/},args=>mock(args.path));
    builder.onResolve({filter:/.*/},args=>{
      if(/server[\\/]/.test(args.path)) throw Error("Server import forbidden in preview");
      const base=args.path.startsWith("@/")?path.join(root,"client/src",args.path.slice(2)):args.path.startsWith("@shared/")?path.join(root,"shared",args.path.slice(8)):args.path.startsWith(".")?path.resolve(args.resolveDir||root,args.path):null;
      const found=base?[base,base+".tsx",base+".ts",base+".js"].find(p=>fs.existsSync(p)&&fs.statSync(p).isFile()):createRequire(path.isAbsolute(args.importer||"")?args.importer:path.join(root,"package.json")).resolve(args.path);
      if(!found?.startsWith(root+path.sep)) throw Error("Outside preview workspace");return {path:found,namespace:"local"};
    });
    builder.onLoad({filter:/.*/,namespace:"local"},args=>({contents:fs.readFileSync(args.path,"utf8"),resolveDir:path.dirname(args.path),loader:args.path.endsWith("tsx")?"tsx":args.path.endsWith("ts")?"ts":"js"}));
    builder.onLoad({filter:/.*/,namespace:"fixture"},args=>({resolveDir:root,loader:"tsx",contents:args.path==="@/lib/trpc"?`export {trpc} from './tools/runtime-uat-regressions/new-layers-preview-fixture';`:args.path.includes("useAuth")?`import {user} from './tools/runtime-uat-regressions/new-layers-preview-fixture';export const useAuth=()=>({user});`:`import ar from './client/src/i18n/ar';import en from './client/src/i18n/en';import ur from './client/src/i18n/ur';import {language} from './tools/runtime-uat-regressions/new-layers-preview-fixture';export const useTranslation=()=>({language,t:({ar,en,ur})[language],dir:language==='en'?'ltr':'rtl',isRTL:language!=='en'});` }));
  }}],
});
const classes=new Set();
// UI primitives also declare utility strings through cn()/variants, not only className attributes.
for (const name of fs.readdirSync("client/src/components/ui").filter(n=>n.endsWith("tsx"))) {
  for (const token of fs.readFileSync(path.join("client/src/components/ui",name),"utf8").match(/[A-Za-z0-9!_:/%.\[\]@-]+/g)||[]) classes.add(token);
}
for(const dir of ["client/src/pages/operational-issues","client/src/components/ui","client/src/components/tickets","client/src/components/catalog"]){for(const name of fs.readdirSync(dir).filter(n=>n.endsWith("tsx"))){for(const m of fs.readFileSync(path.join(dir,name),"utf8").matchAll(/className="([^"]*)"/g)) m[1].split(/\s+/).forEach(c=>classes.add(c));}}
for(const m of fs.readFileSync("client/src/pages/purchase/DelegatePricingBundles.tsx","utf8").matchAll(/className="([^"]*)"/g))m[1].split(/\s+/).forEach(c=>classes.add(c));
const compiler=await compile(fs.readFileSync("client/src/index.css","utf8"),{base:path.join(root,"client/src"),onDependency(){}});const css=compiler.build(Array.from(classes));
fs.writeFileSync(path.join(out,"new-layers-preview.js"),client.outputFiles[0].text);
const server=http.createServer((req,res)=>{const url=new URL(req.url,"http://127.0.0.1:5199");if(url.pathname==="/preview.js"){res.setHeader("Content-Type","text/javascript");return res.end(client.outputFiles[0].text);}const lang=url.searchParams.get("lang")||"ar";res.setHeader("Content-Type","text/html; charset=utf-8");res.end(`<!doctype html><html lang="${lang}" dir="${lang==='en'?'ltr':'rtl'}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Local CMMS feature preview — fixtures only</title><style>${css}body{font-family:Arial,sans-serif;background:var(--background);color:var(--foreground)}</style><div id="root"></div><script src="/preview.js"></script></html>`);});
server.listen(5199,"127.0.0.1",()=>console.log("Isolated preview http://127.0.0.1:5199/?mode=pricing&lang=ar; no database/API"));

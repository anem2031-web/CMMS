import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { createRequire } from "node:module";
import { build } from "esbuild";
import { compile } from "@tailwindcss/node";
const root=process.cwd();
const client=await build({absWorkingDir:root,bundle:true,write:false,platform:"browser",target:"es2022",jsx:"automatic",tsconfigRaw:{},define:{"process.env.NODE_ENV":'"production"'},
  stdin:{loader:"tsx",resolveDir:root,contents:`import React from 'react';import{createRoot}from'react-dom/client';import{Toaster}from'sonner';import Page from './client/src/pages/purchase/DelegatePricingBundles';import{DelegateSupplyRows}from'./client/src/components/purchase/DelegateSupplyRows';import BarcodeScanner from './client/src/components/common/BarcodeScanner';function Preview(){const[result,setResult]=React.useState('');const mode=new URLSearchParams(location.search).get('mode');return mode==='tracking'?<main className="p-6"><h1 className="text-2xl font-bold mb-4">متابعة أصنافي</h1><DelegateSupplyRows items={[{id:1,purchaseOrderId:101,itemName:'فلتر تكييف تجريبي',status:'estimated',batchId:8,pricingBatchStatus:'pending_accounting'},{id:2,purchaseOrderId:102,itemName:'صمام مياه تجريبي',status:'approved'},{id:3,purchaseOrderId:103,itemName:'مضخة للصيانة الخارجية C',status:'purchased',isExternalMaintenance:true,externalMaintenanceStatus:'waiting_gate_entry'}]}/></main>:mode==='scanner'?<main className="p-6"><h1 className="text-2xl mb-4">فحص قارئ اللوت — بيانات تجريبية</h1><BarcodeScanner onScan={setResult}/><p dir="ltr" data-testid="scan-result">{result}</p></main>:<Page/>;}createRoot(document.getElementById('root')).render(<><p className="p-4 text-sm text-muted-foreground">معاينة محلية ببيانات تجريبية فقط — لا اتصال بالنظام أو القاعدة</p><Preview/><Toaster/></>);`},
  plugins:[{name:"local-fixtures-only",setup(builder){
    builder.onResolve({filter:/^@\/(lib\/trpc|contexts\/LanguageContext|_core\/hooks\/useAuth|hooks\/useContentTranslation)$/},args=>({path:args.path,namespace:"fixture"}));
    builder.onResolve({filter:/.*/},args=>{
      if(/server[\\/]/.test(args.path))throw Error("Server import forbidden in preview");
      const base=args.path.startsWith("@/")?path.join(root,"client/src",args.path.slice(2)):args.path.startsWith("@shared/")?path.join(root,"shared",args.path.slice(8)):args.path.startsWith(".")?path.resolve(args.resolveDir||root,args.path):null;
      const found=base?[base,base+".tsx",base+".ts",base+".js"].find(p=>fs.existsSync(p)&&fs.statSync(p).isFile()):createRequire(path.isAbsolute(args.importer||"")?args.importer:path.join(root,"package.json")).resolve(args.path);
      if(!found?.startsWith(root+path.sep))throw Error("Outside preview workspace");return{path:found,namespace:"local"};
    });
    builder.onLoad({filter:/.*/,namespace:"local"},args=>({contents:fs.readFileSync(args.path,"utf8"),resolveDir:path.dirname(args.path),loader:args.path.endsWith("tsx")?"tsx":args.path.endsWith("ts")?"ts":"js"}));
    builder.onLoad({filter:/.*/,namespace:"fixture"},args=>({resolveDir:root,loader:"tsx",contents:args.path==="@/lib/trpc"?`export{trpc}from'./tools/runtime-uat-regressions/pricing-pdf-preview-fixture';`:args.path.includes("useContentTranslation")?`export const getLocalizedItemField=(item,field)=>item[field];`:args.path.includes("useAuth")?`import{user}from'./tools/runtime-uat-regressions/pricing-pdf-preview-fixture';export const useAuth=()=>({user});`:`import{language}from'./tools/runtime-uat-regressions/pricing-pdf-preview-fixture';export const useTranslation=()=>({language,dir:language==='en'?'ltr':'rtl'});`}));
  }}],
});
const classes=new Set();
for(const file of ["client/src/pages/purchase/DelegatePricingBundles.tsx","client/src/components/purchase/PricingBundleRows.tsx","client/src/components/purchase/DelegateSupplyRows.tsx","client/src/components/common/BarcodeScanner.tsx",...fs.readdirSync("client/src/components/ui").filter(n=>n.endsWith("tsx")).map(n=>"client/src/components/ui/"+n)])for(const token of fs.readFileSync(file,"utf8").match(/[A-Za-z0-9!_:/%.\[\]@-]+/g)||[])classes.add(token);
const compiler=await compile(fs.readFileSync("client/src/index.css","utf8"),{base:path.join(root,"client/src"),onDependency(){}});const css=compiler.build(Array.from(classes));
http.createServer((req,res)=>{const url=new URL(req.url,"http://127.0.0.1:5199");
  res.setHeader("Content-Security-Policy","default-src 'self'; script-src 'self'; style-src 'unsafe-inline'; frame-src 'none'; object-src 'none'; img-src 'self' data:");
  if(url.pathname==="/preview.js"){res.setHeader("Content-Type","text/javascript");return res.end(client.outputFiles[0].text);}
  res.setHeader("Content-Type","text/html; charset=utf-8");res.end(`<!doctype html><html lang="${url.searchParams.get("lang")==="en"?"en":"ar"}" dir="${url.searchParams.get("lang")==="en"?"ltr":"rtl"}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Local pricing PDF fixture — no database</title><style>${css}body{font-family:Arial,sans-serif;background:var(--background);color:var(--foreground)}</style><div id="root"></div><script src="/preview.js"></script></html>`);
}).listen(5199,"127.0.0.1",()=>console.log("Isolated pricing preview http://127.0.0.1:5199 — fixtures only, no API/database"));

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { transformSync } from "esbuild";
import { compile } from "@tailwindcss/node";
import puppeteer from "puppeteer-core";
const require=createRequire(import.meta.url), root=process.cwd(), out=path.join(root,"tools/material-costs/artifacts");
fs.mkdirSync(out,{recursive:true});
const summary={issued:90,returned:15,net:75,financialNet:60,difference:15,incomplete:0};
const rows=[{eventKey:"i1",source:"ticket_named",sourceNumber:"MT-2026-00600-01",eventNumber:"DLV-2026-00001",eventDate:"2026-10-15 10:00:00",itemName:"لمبات LED",lotCode:"LOT-2026-001",deliveryNumber:"DLV-2026-00001",unit:"حبة",quantity:3,issued:45,returned:0,net:45,financialNet:36,difference:9},
{eventKey:"r1",source:"ticket_named",sourceNumber:"MT-2026-00600-01",eventNumber:"RTN-2026-00001",eventDate:"2026-10-15 11:00:00",itemName:"لمبات LED",lotCode:"LOT-2026-001",deliveryNumber:"DLV-2026-00001",unit:"حبة",quantity:1,issued:0,returned:15,net:-15,financialNet:-12,difference:-3},
{eventKey:"i2",source:"pmv2",sourceNumber:"PMV2-20261015-P1-T1",eventNumber:"DLV-2026-00002",eventDate:"2026-10-15 12:00:00",itemName:"لمبات LED",lotCode:"LOT-2026-002",deliveryNumber:"DLV-2026-00002",unit:"حبة",quantity:3,issued:45,returned:0,net:45,financialNet:36,difference:9}];
const result={enabled:true,summary,rows,total:rows.length,groups:[{id:"1",name:"الحديقة",siteName:"الحديقة",sectionName:"الألعاب",...summary}]};
const query=data=>({useQuery:()=>({data,error:null,isFetching:false,refetch:async()=>{}})});
const trpc={catalog:{units:{list:query([{id:1,nameAr:"حبة",isActive:1}])}},sites:{list:query([{id:1,name:"الحديقة"}])},sections:{list:query([{id:2,name:"الألعاب",siteId:1}])},assets:{list:query([{id:3,name:"لعبة السيارات",siteId:1,sectionId:2}])},materialCosts:{report:query(result),document:query(result)}};
const cache=new Map();
function load(file) {
 file=path.resolve(root,file);
 if(!file.startsWith(root+path.sep)||file.includes(`${path.sep}server${path.sep}`))throw new Error("Forbidden preview import "+file);
 if(cache.has(file))return cache.get(file).exports;
 const module={exports:{}};cache.set(file,module);
 const code=transformSync(fs.readFileSync(file,"utf8"),{loader:file.endsWith("tsx")?"tsx":"ts",format:"cjs",jsx:"automatic",target:"es2022"}).code;
 vm.runInNewContext(code,{module,exports:module.exports,console,require(id){
   if(id==="@/lib/trpc")return{trpc};
   if(id==="@/contexts/LanguageContext")return{useLanguage:()=>({language:"ar"})};
   if(id.startsWith("@/")||id.startsWith("@shared/")||id.startsWith(".")){
    const target=id.startsWith("@/")?path.join(root,"client/src",id.slice(2)):id.startsWith("@shared/")?path.join(root,"shared",id.slice(8)):path.resolve(path.dirname(file),id);
    const found=[target,target+".tsx",target+".ts",path.join(target,"index.ts")].find(value=>fs.existsSync(value)&&fs.statSync(value).isFile());
    if(!found)throw new Error("Missing preview import "+id);return load(found);
   }
   return require(id);
 }},{filename:file});return module.exports;
}
const {ReceiptConversionFields}=load("client/src/components/inventory/ReceiptConversionFields.tsx");
const Report=load("client/src/pages/reports/MaterialExecutionCostReport.tsx").default;
const body=renderToStaticMarkup(React.createElement("main",{className:"mx-auto max-w-7xl p-4 space-y-6",dir:"rtl"},
 React.createElement("section",{className:"rounded-lg border bg-card p-4 space-y-3"},React.createElement("h1",{className:"font-bold text-xl"},"معاينة معزولة — بيانات اختبار فقط"),React.createElement("p",{},"استلام كرتونين × 20 حبة، سعر الكرتون 300 ريال"),React.createElement(ReceiptConversionFields,{item:{purchaseUnit:"كرتون",issueUnit:"حبة",receivedQuantity:2,conversionFactor:20,unitCost:"300"},onChange(){}})),React.createElement(Report)));
const classes=Array.from(new Set(Array.from(body.matchAll(/class="([^"]*)"/g)).flatMap(match=>match[1].split(/\s+/))));
const compiler=await compile(fs.readFileSync("client/src/index.css","utf8"),{base:path.join(root,"client/src"),onDependency(){}});
const html=`<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${compiler.build(classes)} body{font-family:Arial,sans-serif;background:var(--background);color:var(--foreground)}</style><body>${body}</body></html>`;
fs.writeFileSync(path.join(out,"preview.html"),html);
if(process.argv.includes("--capture")) {
const profile=path.join(out,"preview-browser-profile");
const browser=await puppeteer.launch({executablePath:"C:/Program Files/Google/Chrome/Application/chrome.exe",headless:true,pipe:true,timeout:15000,userDataDir:profile,args:["--disable-background-networking","--disable-sync","--no-first-run"]});
try{const page=await browser.newPage();await page.setRequestInterception(true);page.on("request",request=>request.abort());
 for(const [name,width,height]of[["desktop",1440,1100],["mobile",390,1100]]){await page.setViewport({width,height,deviceScaleFactor:1});await page.setContent(html);await page.screenshot({path:path.join(out,`${name}.png`),fullPage:true});
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);if(overflow)throw new Error(`${name}: page overflow`);}
}finally{await browser.close();}
// Only the disposable profile created by this script, resolved beneath the authorized workspace.
if(path.resolve(profile).startsWith(path.resolve(out)+path.sep)&&path.basename(profile)==="preview-browser-profile")fs.rmSync(profile,{recursive:true,force:true});
console.log("Isolated desktop/mobile screenshots complete; all browser network requests blocked.");
} else console.log("Isolated HTML/CSS preview generated without network or application startup.");

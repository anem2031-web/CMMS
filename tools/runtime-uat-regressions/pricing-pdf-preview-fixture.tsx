// Local interaction fixture only. No real API, credentials, server or database imports.
import { useState, useSyncExternalStore } from "react";
const params=new URLSearchParams(location.search);
export const language=params.get("lang")||"ar";
export const user={id:11,role:params.get("role")||"delegate",isActive:1};
const listeners=new Set<()=>void>();let version=0;
const emit=()=>{version++;listeners.forEach(fn=>fn());};
let bundle:any={id:1,bundleNumber:"DPB-DEMO-000001",status:params.get("status")||"open",revision:2,effectsDone:1,delegateName:"مندوب المعاينة",createdAt:"2026-10-18T08:00:00Z",total:100,
  items:[{id:1,purchaseOrderId:101,poNumber:"PR-DEMO-101",itemName:"فلتر تكييف تجريبي",categoryName:"تكييف",sectionName:"قسم التشغيل",quantity:2,unit:"حبة",estimatedUnitCost:"25.00",estimatedTotalCost:"50.00",supplierName:"مورد تجريبي"},
    {id:2,purchaseOrderId:102,poNumber:"PR-DEMO-102",itemName:"صمام مياه تجريبي",categoryName:"سباكة",sectionName:"قسم الصيانة",quantity:2,unit:"حبة",estimatedUnitCost:"25.00",estimatedTotalCost:"50.00",supplierName:"مورد تجريبي"}]};
function data(path:string){if(path.endsWith(".status"))return{enabled:true};if(path.endsWith(".list"))return[{...bundle,itemCount:bundle.items.length}];if(path.endsWith(".detail"))return bundle;return [];}
// A static one-page ASCII PDF to verify the browser's download, independently of PDF generation.
const objects=["<< /Type /Catalog /Pages 2 0 R >>","<< /Type /Pages /Kids [3 0 R] /Count 1 >>","<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 150] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>","<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"];
const stream="BT /F1 12 Tf 20 90 Td (Local bundle download fixture only) Tj ET";
objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
let document="%PDF-1.4\n";const offsets=[0];objects.forEach((value,index)=>{offsets.push(document.length);document+=`${index+1} 0 obj\n${value}\nendobj\n`;});
const xref=document.length;document+=`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(offset=>String(offset).padStart(10,"0")+" 00000 n \n").join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
const pause=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
const proxy=(path=""):any=>new Proxy(()=>{},{get(_target,key){
  if(key==="useUtils")return()=>proxy("utils");
  if(key==="setData")return(_input:any,update:any)=>{if(path.endsWith(".detail"))bundle=update(bundle);emit();};
  if(key==="invalidate")return async()=>{await pause(8000);emit();}; // Deliberately slow refetch: send must still finish promptly.
  if(key==="useQuery")return(_input:any,opts:any)=>{useSyncExternalStore(fn=>{listeners.add(fn);return()=>listeners.delete(fn);},()=>version);return{data:opts?.enabled===false?undefined:data(path),isLoading:false,error:null};};
  if(key==="useMutation")return(opts:any)=>{const[pending,setPending]=useState(false);return{isPending:pending,mutate:async(input:any)=>{setPending(true);try{
    await pause(150);const result=path.endsWith(".pdf")?{name:`${bundle.bundleNumber}.pdf`,content:btoa(document)}:{success:true,effectsDone:true};
    await opts?.onSuccess?.(result,input);
  }catch(error){opts?.onError?.(error);}finally{setPending(false);}}};};
  return proxy(path?`${path}.${String(key)}`:String(key));
}});
export const trpc=proxy();

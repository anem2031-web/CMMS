import 'dotenv/config';
import fs from 'node:fs';
import mysql from 'mysql2/promise';
import {connect,sources} from './audit.mjs';
import {queueTranslation} from '../../server/services/translation/translationEngine';
const coverage=JSON.parse(fs.readFileSync('tools/translation-repair/ten-coverage.json','utf8'));
if(coverage.tickets.length!==10)throw Error('Expected ten tickets');
const db=await connect();
const report:any={startedAt:new Date().toISOString(),status:'running',created:[],completed:[],failed:[],skipped:0};
const save=()=>fs.writeFileSync('tools/translation-repair/ten-missing-result.json',JSON.stringify(report,null,2));
save();
try{
 await db.query("SET SESSION time_zone='+00:00'");
 const groups=new Map<string,any[]>();
 for(const item of coverage.missing){const key=JSON.stringify([item.entityType,item.entityId,item.sourceLanguage]);const g=groups.get(key)||[];g.push(item);groups.set(key,g);}
 for(const group of groups.values()){
  const first=group[0],table=sources[first.entityType];
  if(!table||!coverage.tickets.includes(first.ticketId))throw Error('Outside approved scope');
  const parent=first.entityType==='TICKET'?'s.id':'s.ticketId';
  const [rows]:any=await db.query(`SELECT s.* FROM ${mysql.escapeId(table)} s JOIN tickets t ON t.id=${parent} WHERE s.id=? AND t.id=? AND t.createdAt>='2026-10-14 21:00:00' AND t.createdAt<'2026-10-26 21:00:00'`,[first.entityId,first.ticketId]);
  if(!rows.length){report.skipped+=group.length;continue;}
  const [existing]:any=await db.query('SELECT fieldName,languageCode FROM entity_translations WHERE entityType=? AND entityId=?',[first.entityType,first.entityId]);
  const todo=group.filter((x:any)=>!existing.some((e:any)=>e.fieldName===x.fieldName&&e.languageCode===x.targetLanguage));
  const targets=[...new Set(todo.map((x:any)=>x.targetLanguage))] as any;
  const fields=[...new Set(todo.map((x:any)=>x.fieldName))].map((fieldName:any)=>({fieldName,text:rows[0][fieldName]})).filter(f=>typeof f.text==='string'&&f.text.trim());
  if(!fields.length){report.skipped+=group.length;continue;}
  // Queue only missing targets. Separate by each field's exact missing language set.
  const languageGroups=new Map<string,any[]>();
  for(const f of fields){const langs=todo.filter((x:any)=>x.fieldName===f.fieldName).map((x:any)=>x.targetLanguage).sort();const k=JSON.stringify(langs);const g=languageGroups.get(k)||[];g.push(f);languageGroups.set(k,g);}
  const ids:number[]=[];
  for(const [languages,fs] of languageGroups){ids.push(...await queueTranslation({entityType:first.entityType,entityId:first.entityId,sourceLanguage:first.sourceLanguage,targetLanguages:JSON.parse(languages),fields:fs}));}
  report.created.push(...ids);save();
  if(!ids.length)continue;
  let results:any[]=[];const deadline=Date.now()+360000;
  do{
   await new Promise(r=>setTimeout(r,2000));
   const [r]:any=await db.query(`SELECT j.id,j.status,e.translationStatus,e.translatedText FROM translation_jobs j JOIN entity_translations e ON e.translationJobId=j.id WHERE j.id IN (${ids.map(()=>'?').join(',')})`,ids);results=r;
   if(r.length===ids.length&&r.every((x:any)=>x.status==='failed'||(x.status==='completed'&&x.translationStatus==='completed'&&x.translatedText?.trim())))break;
  }while(Date.now()<deadline);
  for(const id of ids){const r=results.find(x=>x.id===id);if(r?.status==='completed'&&r.translationStatus==='completed'&&r.translatedText?.trim())report.completed.push(id);else report.failed.push(id);}
  save();console.log(JSON.stringify({created:report.created.length,completed:report.completed.length,failed:report.failed.length}));
  if(report.failed.length){report.status='stopped_on_failure';break;}
 }
 if(report.status==='running')report.status='finished';
}catch(error:any){report.status='stopped_on_error';report.errorCode=error?.code||error?.name;}
finally{report.finishedAt=new Date().toISOString();save();await db.end();}
process.exit(report.status==='finished'?0:1);

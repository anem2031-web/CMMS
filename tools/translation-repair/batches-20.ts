import 'dotenv/config';
import fs from 'node:fs';
import mysql from 'mysql2/promise';
import {connect,sources} from './audit.mjs';
import {ENTITY_FIELD_MAP,queueTranslation,runTranslationJobs} from '../../server/services/translation/translationEngine';
import {detectLanguage} from '../../server/services/translation/translation';
const apply=process.argv.includes('--apply');
let db=await connect();
const from='2026-10-15 21:00:00',until='2026-10-26 21:00:00';
const report:any={startedAt:new Date().toISOString(),fromRiyadh:'2026-10-16',throughRiyadh:'2026-10-26',status:'audit',batches:[]};
const save=()=>fs.writeFileSync('tools/translation-repair/batches-20-result.json',JSON.stringify(report,null,2));
try{
 await db.query("SET SESSION time_zone='+00:00'");
 const [tickets]:any=await db.query('SELECT id,ticketNumber FROM tickets WHERE createdAt>=? AND createdAt<? ORDER BY createdAt,id',[from,until]);
 const work=new Map<number,any[]>();
 for(const [type,table] of Object.entries(sources)){
  const parent=type==='TICKET'?'s.id':'s.ticketId';
  const [rows]:any=await db.query(`SELECT s.*,t.id AS repairTicketId FROM ${mysql.escapeId(table as string)} s JOIN tickets t ON t.id=${parent} WHERE t.createdAt>=? AND t.createdAt<?`,[from,until]);
  if(!rows.length)continue;
  const [existing]:any=await db.query(`SELECT entityId,fieldName,languageCode,translationStatus FROM entity_translations WHERE entityType=? AND entityId IN (${rows.map(()=>'?').join(',')})`,[type,...rows.map((r:any)=>r.id)]);
  for(const r of rows)for(const field of ENTITY_FIELD_MAP[type]){
   if(typeof r[field]!=='string'||!r[field].trim())continue;
   const language=await detectLanguage(r[field]);
   const targets=['ar','en','ur'].filter(l=>l!==language&&!existing.some((e:any)=>e.entityId===r.id&&e.fieldName===field&&e.languageCode===l&&['completed','approved'].includes(e.translationStatus)));
   if(!targets.length)continue;
   const group=work.get(r.repairTicketId)||[];group.push({entityType:type,entityId:r.id,fieldName:field,targets});work.set(r.repairTicketId,group);
  }
 }
 const selected=tickets.filter((t:any)=>work.has(t.id));
 report.tickets=selected;report.targets=[...work.values()].flat().reduce((n,x)=>n+x.targets.length,0);
 save();console.log(JSON.stringify({tickets:selected.length,targets:report.targets,batches:Math.ceil(selected.length/20),apply}));
 if(apply){
  report.status='running';save();
  for(let offset=0;offset<selected.length;offset+=20){
   const group=selected.slice(offset,offset+20),ids:number[]=[];
   const batch:any={ticketIds:group.map((t:any)=>t.id),status:'preparing',jobIds:[],completed:0};report.batches.push(batch);save();
   for(const ticket of group)for(const item of work.get(ticket.id)||[]){
    const table=sources[item.entityType];const parent=item.entityType==='TICKET'?'s.id':'s.ticketId';
    if(!table||!/^[A-Za-z][A-Za-z0-9]*$/.test(item.fieldName))throw Error('Outside ticket scope');
    const [rows]:any=await db.query(`SELECT s.${mysql.escapeId(item.fieldName)} AS sourceText FROM ${mysql.escapeId(table)} s JOIN tickets t ON t.id=${parent} WHERE s.id=? AND t.id=? AND t.createdAt>=? AND t.createdAt<?`,[item.entityId,ticket.id,from,until]);
    const text=rows[0]?.sourceText;if(typeof text!=='string'||!text.trim())continue;
    const [current]:any=await db.query('SELECT languageCode,translationStatus FROM entity_translations WHERE entityType=? AND entityId=? AND fieldName=?',[item.entityType,item.entityId,item.fieldName]);
    const sourceLanguage=await detectLanguage(text);
    const targets=item.targets.filter((l:string)=>l!==sourceLanguage&&!current.some((e:any)=>e.languageCode===l&&['approved','completed'].includes(e.translationStatus)));
    if(!targets.length)continue;
    ids.push(...await queueTranslation({entityType:item.entityType,entityId:item.entityId,sourceLanguage,targetLanguages:targets,fields:[{fieldName:item.fieldName,text}]},{deferProcessing:true}));
    // Existing pending jobs may have been queued by the application. Include only exact current text/target matches.
    const [pending]:any=await db.query(`SELECT j.id FROM translation_jobs j JOIN entity_translations e ON e.translationJobId=j.id WHERE j.entityType=? AND j.entityId=? AND j.fieldName=? AND j.targetLanguage IN (${targets.map(()=>'?').join(',')}) AND BINARY j.sourceText=BINARY ? AND j.status='pending' AND e.translationStatus='pending'`,[item.entityType,item.entityId,item.fieldName,...targets,text]);
    ids.push(...pending.map((j:any)=>j.id));
   }
   batch.jobIds=[...new Set(ids)];batch.status='translating';save();
   await runTranslationJobs(batch.jobIds,true);
   // The orchestration connection is idle during the remote request and engine writes.
   // Reopen before verification; the engine uses its own connection pool.
   try { await db.end(); } catch {}
   db=await connect(); await db.query("SET SESSION time_zone='+00:00'");
   const deadline=Date.now()+360000;let states:any[]=[];
   while(batch.jobIds.length){
    const [rows]:any=await db.query(`SELECT j.id,j.status,e.translationStatus,e.translatedText FROM translation_jobs j JOIN entity_translations e ON e.translationJobId=j.id WHERE j.id IN (${batch.jobIds.map(()=>'?').join(',')})`,batch.jobIds);states=rows;
    if(rows.length===batch.jobIds.length&&rows.every((r:any)=>r.status==='failed'||(r.status==='completed'&&r.translationStatus==='completed'&&r.translatedText?.trim())))break;
    if(Date.now()>deadline)break;await new Promise(r=>setTimeout(r,2000));
   }
   batch.completed=states.filter(r=>r.status==='completed'&&r.translationStatus==='completed'&&r.translatedText?.trim()).length;
   batch.status=batch.completed===batch.jobIds.length?'finished':'stopped';save();console.log(JSON.stringify({batch:report.batches.length,tickets:group.length,completed:batch.completed,targets:batch.jobIds.length,status:batch.status}));
   if(batch.status==='stopped'){report.status='stopped_on_incomplete_batch';break;}
  }
  if(report.status==='running')report.status='finished';
 }
}catch(error:any){report.status='stopped_on_error';report.errorCode=error?.code||error?.cause?.code||error?.name;report.errorMessage=String(error?.cause?.message||error?.message||'').slice(0,400);console.error(JSON.stringify({status:report.status,errorCode:report.errorCode}));}
finally{report.updatedAt=new Date().toISOString();save();await db.end();}
process.exit(report.status.startsWith('stopped')?1:0);

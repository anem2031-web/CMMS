import 'dotenv/config';
import fs from 'node:fs';
import mysql from 'mysql2/promise';
import { connect, sources } from './audit.mjs';
import { runTranslationJobs } from '../../server/services/translation/translationEngine';

const apply = process.argv.includes('--apply');
const fixedIds=JSON.parse(fs.readFileSync('tools/translation-repair/ten-selected.json','utf8')).tickets.map((t:any)=>t.id);
if(fixedIds.length!==10)throw Error('Expected fixed ten-ticket scope');
const db = await connect();
const from = '2026-10-14 21:00:00', until = '2026-10-26 21:00:00';
const report: any = { startedAt: new Date().toISOString(), database: 'cmms', fromRiyadh: '2026-10-15', throughRiyadh: '2026-10-26', tickets: [], completed: [], failed: [], skipped: [], status: 'audit' };
const save = () => fs.writeFileSync('tools/translation-repair/ten-recent-result.json',JSON.stringify(report,null,2));
try {
 await db.query("SET SESSION time_zone='+00:00'");
 const candidates: any[]=[];
 for(const [type, table] of Object.entries(sources)) {
  const parent = type==='TICKET' ? 's.id' : 's.ticketId';
  const [rows]: any = await db.query(`SELECT j.id,j.entityType,j.entityId,j.fieldName,t.id AS ticketId,t.ticketNumber,t.createdAt
   FROM translation_jobs j JOIN entity_translations e ON e.translationJobId=j.id
    AND e.entityType=j.entityType AND e.entityId=j.entityId AND e.fieldName=j.fieldName AND e.languageCode=j.targetLanguage
   JOIN ${mysql.escapeId(table as string)} s ON s.id=j.entityId JOIN tickets t ON t.id=${parent}
   WHERE j.entityType=? AND t.createdAt>=? AND t.createdAt<? AND j.status='failed' AND e.translationStatus IN ('failed','pending')`,[type,from,until]);
  candidates.push(...rows.filter((r:any)=>fixedIds.includes(r.ticketId)));
 }
 candidates.sort((a,b)=>new Date(a.createdAt).getTime()-new Date(b.createdAt).getTime() || a.ticketId-b.ticketId || a.id-b.id);
 const chosen=fixedIds;
 const jobs=candidates.filter(j=>chosen.includes(j.ticketId));
 report.tickets=chosen.map(id=>({id,number:JSON.parse(fs.readFileSync('tools/translation-repair/ten-selected.json','utf8')).tickets.find((t:any)=>t.id===id).number,tasks:jobs.filter(j=>j.ticketId===id).length}));
 report.total=jobs.length;save();console.log(JSON.stringify({tickets:report.tickets,total:jobs.length,apply}));
 if(apply) {
  report.status='running';save();
  const groups=new Map<string,any[]>();
  for(const j of jobs) { const k=`${j.entityType}:${j.entityId}`;const g=groups.get(k)||[];g.push(j);groups.set(k,g); }
  for(const group of groups.values()) {
   const ids:number[]=[];
   await db.beginTransaction();
   try {
    for(const j of group) {
     if(!/^[A-Za-z][A-Za-z0-9]*$/.test(j.fieldName))throw Error('Invalid field');
     const table=sources[j.entityType];
     if(!table||!chosen.includes(j.ticketId))throw Error('Outside approved scope');
     const parent=j.entityType==='TICKET'?'s.id':'s.ticketId';
     const [rows]:any=await db.query(`SELECT j.id,e.id AS translationId FROM translation_jobs j
      JOIN entity_translations e ON e.translationJobId=j.id AND e.entityType=j.entityType AND e.entityId=j.entityId AND e.fieldName=j.fieldName AND e.languageCode=j.targetLanguage
      JOIN ${mysql.escapeId(table)} s ON s.id=j.entityId JOIN tickets t ON t.id=${parent}
      WHERE j.id=? AND j.entityType=? AND t.id=? AND t.createdAt>=? AND t.createdAt<?
      AND j.status='failed' AND e.translationStatus IN ('failed','pending')
      AND BINARY TRIM(s.${mysql.escapeId(j.fieldName)})=BINARY TRIM(j.sourceText) FOR UPDATE`,[j.id,j.entityType,j.ticketId,from,until]);
     if(!rows.length){report.skipped.push(j.id);continue;}
     await db.query("UPDATE translation_jobs SET status='pending',retryCount=0,errorMessage=NULL WHERE id=? AND status='failed'",[j.id]);
     await db.query("UPDATE entity_translations SET translationStatus='pending',errorMessage=NULL WHERE id=? AND translationJobId=? AND translationStatus IN ('failed','pending')",[rows[0].translationId,j.id]);
     ids.push(j.id);
    }
    await db.commit();
   } catch(error){await db.rollback();throw error;}
   if(!ids.length)continue;
   await runTranslationJobs(ids);
   const deadline=Date.now()+240000;
   let states:any[]=[];
   do {
    const [r]:any=await db.query(`SELECT j.id,j.status,e.translationStatus,e.translatedText FROM translation_jobs j JOIN entity_translations e ON e.translationJobId=j.id WHERE j.id IN (${ids.map(()=>'?').join(',')})`,ids);
    states=r;
    if(r.length===ids.length && r.every((x:any)=>x.status==='failed'||(x.status==='completed'&&x.translationStatus==='completed'&&x.translatedText?.trim())))break;
    await new Promise(resolve=>setTimeout(resolve,2000));
   }while(Date.now()<deadline);
   for(const id of ids){const r=states.find(x=>x.id===id);if(r?.status==='completed'&&r.translationStatus==='completed'&&r.translatedText?.trim())report.completed.push(id);else report.failed.push(id);}
   save();console.log(JSON.stringify({completed:report.completed.length,total:report.total,failed:report.failed.length}));
   if(report.failed.length){report.status='stopped_on_failure';break;}
  }
  if(report.status==='running')report.status='finished';
 }
 report.finishedAt=new Date().toISOString();save();
}catch(error:any){report.status='stopped_on_error';report.errorCode=error?.code||error?.name;save();console.error(JSON.stringify({status:report.status,errorCode:report.errorCode}));}
finally{await db.end();}
process.exit(report.status.startsWith('stopped')?1:0);

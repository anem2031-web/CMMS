import {connect,sources} from './audit.mjs';
import mysql from 'mysql2/promise';
const db=await connect();
try {
 await db.query("SET SESSION time_zone = '+00:00'");
 const cutoff='2026-10-14 21:00:00'; // 15 October midnight, Riyadh.
 const [total]=await db.query('SELECT COUNT(*) AS tickets FROM tickets WHERE createdAt>=?',[cutoff]);
 const all=[];
 for(const [type,table] of Object.entries(sources)){
  const join=type==='TICKET'?'JOIN tickets t ON t.id=j.entityId':`JOIN ${mysql.escapeId(table)} s ON s.id=j.entityId JOIN tickets t ON t.id=s.ticketId`;
  const [rows]=await db.query(`SELECT j.id,t.id AS ticketId,j.entityType,j.fieldName,j.status AS jobStatus,e.translationStatus
   FROM translation_jobs j JOIN entity_translations e ON e.translationJobId=j.id
    AND e.entityType=j.entityType AND e.entityId=j.entityId AND e.fieldName=j.fieldName AND e.languageCode=j.targetLanguage
   ${join} WHERE j.entityType=? AND t.createdAt>=?`,[type,cutoff]);all.push(...rows);
 }
 const retry=all.filter(r=>r.jobStatus==='failed'&&['failed','pending'].includes(r.translationStatus));
 console.log(JSON.stringify({sinceRiyadh:'2026-10-15 00:00:00',totalTickets:total[0].tickets,
   ticketsWithFailedTranslations:new Set(retry.map(r=>r.ticketId)).size,failedJobs:retry.length,
   byType:Object.fromEntries(Object.keys(sources).map(t=>[t,retry.filter(r=>r.entityType===t).length])),
   currentJobStatuses:all.reduce((a,r)=>(a[r.jobStatus]=(a[r.jobStatus]||0)+1,a),{}),
   uniqueFailedFields:new Set(retry.map(r=>`${r.ticketId}:${r.entityType}:${r.id}`)).size},null,2));
}finally{await db.end()}

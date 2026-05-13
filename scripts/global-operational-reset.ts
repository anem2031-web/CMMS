/**
 * STAGE 0.2 — GLOBAL OPERATIONAL DATA RESET SCRIPT
 *
 * MANDATORY PRE-CONDITION: Full cold storage backup of ALL purgeable tables.
 * If ANY backup export fails, the script ABORTS entirely — no data is deleted.
 *
 * Protected Master Data (NEVER TOUCHED):
 *   users, technicians, sites, sections, assets, asset_categories,
 *   asset_spare_parts, inventory, preventive_plans, push_subscriptions,
 *   two_factor_secrets, entity_translations, translation_versions,
 *   __drizzle_migrations
 *
 * Purgeable Operational Data (FK-safe deletion order):
 *   Level 1: audit_logs, attachments, notifications, two_factor_audit_logs, translation_jobs
 *   Level 2: ticket_status_history, inspection_results, inventory_transactions,
 *             asset_metrics, procurement_comments
 *   Level 3: pm_checklist_items, pm_execution_results, pm_execution_sessions,
 *             pm_jobs, purchase_order_items
 *   Level 4: tickets, purchase_orders, pm_work_orders
 *   Level 5: backups
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { drizzle } from 'drizzle-orm/mysql2';
import { sql } from 'drizzle-orm';

const db = drizzle(process.env.DATABASE_URL!);

// ============================================================
// CONSTANTS
// ============================================================
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const BACKUP_DIR = path.join(process.cwd(), 'archives', `system_reset_backup_${TIMESTAMP}`);
const BATCH_SIZE = 2000;

// FK-safe deletion sequence (bottom-up)
const DELETION_SEQUENCE: Array<{ table: string; batchColumn?: string }> = [
  // Level 1: Polymorphic dependents and standalone logs
  { table: 'audit_logs',            batchColumn: 'id' },
  { table: 'attachments',           batchColumn: 'id' },
  { table: 'notifications',         batchColumn: 'id' },
  { table: 'two_factor_audit_logs', batchColumn: 'id' },
  { table: 'translation_jobs',      batchColumn: 'id' },
  // Level 2: Workflow and metrics dependents
  { table: 'ticket_status_history', batchColumn: 'id' },
  { table: 'inspection_results',    batchColumn: 'id' },
  { table: 'inventory_transactions',batchColumn: 'id' },
  { table: 'asset_metrics',         batchColumn: 'id' },
  { table: 'procurement_comments',  batchColumn: 'id' },
  // Level 3: PM and procurement items
  { table: 'pm_checklist_items',    batchColumn: 'id' },
  { table: 'pm_execution_results',  batchColumn: 'id' },
  { table: 'pm_execution_sessions', batchColumn: 'id' },
  { table: 'pm_jobs',               batchColumn: 'id' },
  { table: 'purchase_order_items',  batchColumn: 'id' },
  // Level 4: Operational roots
  { table: 'tickets',               batchColumn: 'id' },
  { table: 'purchase_orders',       batchColumn: 'id' },
  { table: 'pm_work_orders',        batchColumn: 'id' },
  // Level 5: System operational logs
  { table: 'backups',               batchColumn: 'id' },
];

// Tables to backup (all purgeable tables with data)
const BACKUP_TABLES = [
  'tickets', 'ticket_status_history', 'notifications', 'attachments',
  'audit_logs', 'purchase_orders', 'purchase_order_items', 'pm_work_orders',
  'pm_jobs', 'pm_execution_sessions', 'pm_execution_results', 'pm_checklist_items',
  'inspection_results', 'inventory_transactions', 'asset_metrics',
  'procurement_comments', 'two_factor_audit_logs', 'translation_jobs', 'backups',
];

// ============================================================
// HELPERS
// ============================================================
function log(msg: string) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${msg}`);
}

function abort(reason: string): never {
  console.error(`\n🚨 ABORT: ${reason}`);
  console.error('No data was deleted. Exiting.');
  process.exit(1);
}

// ============================================================
// PHASE 1: COLD STORAGE BACKUP
// ============================================================
async function runBackup(): Promise<void> {
  log('=== PHASE 1: GLOBAL COLD STORAGE BACKUP ===');

  // Create backup directory — ABORT if fails
  try {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    log(`Backup directory created: ${BACKUP_DIR}`);
  } catch (err: any) {
    abort(`Failed to create backup directory: ${err.message}`);
  }

  // Write manifest file
  const manifest: Record<string, any> = {
    timestamp: new Date().toISOString(),
    description: 'Global Operational Data Reset — Cold Storage Backup',
    backup_dir: BACKUP_DIR,
    tables: {},
  };

  let totalRows = 0;

  for (const tableName of BACKUP_TABLES) {
    try {
      const rows = await db.execute(sql.raw(`SELECT * FROM \`${tableName}\``));
      const data = rows[0] as any[];
      const filePath = path.join(BACKUP_DIR, `${tableName}.json`);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
      const sizeMB = (fs.statSync(filePath).size / 1024 / 1024).toFixed(3);
      manifest.tables[tableName] = { rows: data.length, file: `${tableName}.json`, size_mb: sizeMB };
      totalRows += data.length;
      log(`  ✅ ${tableName}: ${data.length} rows backed up (${sizeMB} MB)`);
    } catch (err: any) {
      // ABORT if any backup fails
      abort(`Backup FAILED for table '${tableName}': ${err.message}. No data will be deleted.`);
    }
  }

  manifest.total_rows_backed_up = totalRows;
  fs.writeFileSync(path.join(BACKUP_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8');
  log(`✅ ALL BACKUPS SUCCESSFUL. Total rows backed up: ${totalRows}`);
  log(`   Manifest: ${path.join(BACKUP_DIR, 'manifest.json')}`);
}

// ============================================================
// PHASE 2: FK-SAFE BATCH DELETION
// ============================================================
const deletionCounts: Record<string, number> = {};

async function deleteTableInBatches(tableName: string, batchColumn: string): Promise<void> {
  deletionCounts[tableName] = 0;

  // Get all IDs to delete
  const idsResult = await db.execute(sql.raw(`SELECT \`${batchColumn}\` AS id FROM \`${tableName}\` ORDER BY \`${batchColumn}\``));
  const allIds: number[] = (idsResult[0] as any[]).map((r: any) => r.id);

  if (allIds.length === 0) {
    log(`  ⏭️  ${tableName}: 0 rows — skipping`);
    return;
  }

  const totalBatches = Math.ceil(allIds.length / BATCH_SIZE);
  log(`  🗑️  ${tableName}: ${allIds.length} rows in ${totalBatches} batch(es) of ${BATCH_SIZE}`);

  for (let i = 0; i < totalBatches; i++) {
    const batchIds = allIds.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
    const idCsv = batchIds.join(',');
    const result = await db.execute(sql.raw(`DELETE FROM \`${tableName}\` WHERE \`${batchColumn}\` IN (${idCsv})`));
    deletionCounts[tableName] += (result[0] as any).affectedRows || 0;
  }

  log(`  ✅ ${tableName}: ${deletionCounts[tableName]} rows deleted`);
}

async function runDeletion(): Promise<void> {
  log('=== PHASE 2: FK-SAFE BATCH DELETION ===');
  log(`Deletion sequence: ${DELETION_SEQUENCE.length} tables`);

  for (const { table, batchColumn } of DELETION_SEQUENCE) {
    try {
      await deleteTableInBatches(table, batchColumn || 'id');
    } catch (err: any) {
      console.error(`\n🚨 DELETION FAILED for table '${table}': ${err.message}`);
      console.error('Partial deletion has occurred. Stopping execution.');
      console.error('Deletion counts so far:', deletionCounts);
      process.exit(1);
    }
  }

  log('✅ All tables processed successfully.');
}

// ============================================================
// PHASE 3: POST-PURGE VERIFICATION
// ============================================================
async function runVerification(): Promise<void> {
  log('=== PHASE 3: POST-PURGE VERIFICATION ===');

  const EXPECTED_ZERO = [
    'tickets', 'ticket_status_history', 'notifications', 'attachments',
    'audit_logs', 'purchase_orders', 'purchase_order_items', 'pm_work_orders',
    'pm_jobs', 'pm_execution_sessions', 'pm_execution_results', 'pm_checklist_items',
    'inspection_results', 'inventory_transactions', 'asset_metrics',
    'procurement_comments', 'two_factor_audit_logs', 'translation_jobs', 'backups',
  ];

  const EXPECTED_PRESERVED = [
    { table: 'users', minRows: 1 },
    { table: 'assets', minRows: 1 },
    { table: 'sites', minRows: 1 },
    { table: 'sections', minRows: 1 },
    { table: 'technicians', minRows: 1 },
    { table: 'asset_categories', minRows: 1 },
  ];

  let allPassed = true;
  const verificationResults: Record<string, any> = {};

  // Check purgeable tables are empty
  log('  Checking purgeable tables...');
  for (const t of EXPECTED_ZERO) {
    const r = await db.execute(sql.raw(`SELECT COUNT(*) AS cnt FROM \`${t}\``));
    const cnt = (r[0] as any[])[0].cnt;
    const passed = cnt == 0;
    if (!passed) allPassed = false;
    verificationResults[t] = { expected: 0, actual: cnt, passed };
    log(`    ${passed ? '✅' : '❌'} ${t}: ${cnt} rows (expected: 0)`);
  }

  // Check master data is preserved
  log('  Checking protected master data...');
  for (const { table, minRows } of EXPECTED_PRESERVED) {
    const r = await db.execute(sql.raw(`SELECT COUNT(*) AS cnt FROM \`${table}\``));
    const cnt = (r[0] as any[])[0].cnt;
    const passed = cnt >= minRows;
    if (!passed) allPassed = false;
    verificationResults[table] = { expected: `>=${minRows}`, actual: cnt, passed };
    log(`    ${passed ? '✅' : '❌'} ${table}: ${cnt} rows (expected: >=${minRows})`);
  }

  // Check for orphan records
  log('  Checking for orphan records...');
  const orphanInspection = await db.execute(sql.raw('SELECT COUNT(*) AS cnt FROM inspection_results WHERE ticketId IS NOT NULL AND ticketId NOT IN (SELECT id FROM tickets)'));
  const orphanInvTx = await db.execute(sql.raw('SELECT COUNT(*) AS cnt FROM inventory_transactions WHERE ticketId IS NOT NULL AND ticketId NOT IN (SELECT id FROM tickets)'));
  const orphanNotifs = await db.execute(sql.raw('SELECT COUNT(*) AS cnt FROM notifications WHERE relatedTicketId IS NOT NULL AND relatedTicketId NOT IN (SELECT id FROM tickets)'));
  const orphanTsh = await db.execute(sql.raw('SELECT COUNT(*) AS cnt FROM ticket_status_history WHERE ticketId NOT IN (SELECT id FROM tickets)'));

  const orphanChecks = {
    inspection_results_orphans: (orphanInspection[0] as any[])[0].cnt,
    inventory_transactions_orphans: (orphanInvTx[0] as any[])[0].cnt,
    notifications_orphans: (orphanNotifs[0] as any[])[0].cnt,
    ticket_status_history_orphans: (orphanTsh[0] as any[])[0].cnt,
  };

  for (const [key, val] of Object.entries(orphanChecks)) {
    const passed = val == 0;
    if (!passed) allPassed = false;
    log(`    ${passed ? '✅' : '❌'} ${key}: ${val} (expected: 0)`);
  }

  // Save verification report
  const verificationReport = {
    timestamp: new Date().toISOString(),
    all_checks_passed: allPassed,
    deletion_counts: deletionCounts,
    table_verification: verificationResults,
    orphan_checks: orphanChecks,
  };

  fs.writeFileSync(
    path.join(process.cwd(), 'archives', `global_reset_verification_${TIMESTAMP}.json`),
    JSON.stringify(verificationReport, null, 2)
  );

  log(`\n${allPassed ? '✅ ALL VERIFICATION CHECKS PASSED' : '⚠️  WARNING: Some checks failed'}`);
  log(`Verification report: archives/global_reset_verification_${TIMESTAMP}.json`);
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  log('🚀 STARTING GLOBAL OPERATIONAL DATA RESET');
  log(`Backup directory: ${BACKUP_DIR}`);
  log('---');

  // Phase 1: Backup (ABORT if any table fails)
  await runBackup();

  // Phase 2: Deletion
  await runDeletion();

  // Phase 3: Verification
  await runVerification();

  log('---');
  log('🏁 GLOBAL OPERATIONAL DATA RESET COMPLETE.');
  log('Final deletion counts:');
  console.table(deletionCounts);
  log('ACTION REQUIRED: Restart the application to flush NodeCache.');

  process.exit(0);
}

main().catch((err) => {
  console.error('🚨 UNHANDLED ERROR:', err);
  process.exit(1);
});

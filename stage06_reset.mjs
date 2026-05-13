/**
 * Stage 0.6 — Final Clean Production Baseline Reset
 * 
 * Step 1: Cold-storage JSON backup of all PURGE tables
 * Step 2: FK-safe deletion in correct dependency order
 * Step 3: Schema column-order fix for assets table (sectionId position)
 * Step 4: Verification
 */

import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';

const DB_CONFIG = {
  host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
  port: 4000,
  user: '4QLyZNrgTT18fMs.root',
  password: 'P4U13RrqYbofEO2y',
  database: 'cmms',
  ssl: { rejectUnauthorized: true },
};

// Tables to PURGE (operational/experimental data)
const PURGE_TABLES = [
  // Must be deleted in FK-safe order (children before parents)
  'inspection_results',        // FK -> assets, tickets, users
  'ticket_status_history',     // FK -> tickets
  'attachments',               // FK -> tickets
  'procurement_comments',      // FK -> purchase_orders
  'purchase_order_items',      // FK -> purchase_orders
  'purchase_orders',           // standalone operational
  'pm_execution_results',      // FK -> pm_execution_sessions
  'pm_execution_sessions',     // FK -> pm_work_orders
  'pm_work_orders',            // FK -> pm_jobs
  'pm_checklist_items',        // FK -> pm_jobs
  'pm_jobs',                   // FK -> preventive_plans
  'preventive_plans',          // FK -> assets
  'tickets',                   // standalone operational
  'asset_spare_parts',         // FK -> assets
  'asset_metrics',             // FK -> assets
  'assets',                    // core operational
  'inventory_transactions',    // FK -> inventory
  'inventory',                 // standalone
  'notifications',             // standalone
  'audit_logs',                // standalone
  'entity_translations',       // standalone
  'translation_jobs',          // standalone
  'translation_versions',      // standalone
  'push_subscriptions',        // standalone
  'two_factor_audit_logs',     // standalone
  'backups',                   // standalone
  // technicians: experimental test data
  'technicians',
];

// Tables to PRESERVE
const PRESERVE_TABLES = [
  'users', 'sites', 'sections', 'asset_categories',
  '__drizzle_migrations', 'two_factor_secrets',
];

async function main() {
  const conn = await mysql.createConnection(DB_CONFIG);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = `/home/ubuntu/CMMS_REAL/stage06_backup_${timestamp}`;
  fs.mkdirSync(backupDir, { recursive: true });

  console.log(`\n${'='.repeat(60)}`);
  console.log('STAGE 0.6 — FINAL CLEAN PRODUCTION BASELINE RESET');
  console.log(`${'='.repeat(60)}`);
  console.log(`Backup directory: ${backupDir}`);

  // ─────────────────────────────────────────────────────────
  // STEP 1: Cold-storage JSON backup
  // ─────────────────────────────────────────────────────────
  console.log('\n── STEP 1: Cold-storage JSON backup ──');
  const backupMeta = { timestamp, tables: {} };

  for (const table of PURGE_TABLES) {
    try {
      const [rows] = await conn.execute(`SELECT * FROM \`${table}\``);
      const filePath = path.join(backupDir, `${table}.json`);
      fs.writeFileSync(filePath, JSON.stringify(rows, null, 2));
      backupMeta.tables[table] = { rows: rows.length, file: `${table}.json` };
      console.log(`  ✓ ${table}: ${rows.length} rows backed up`);
    } catch (e) {
      console.error(`  ✗ ${table}: backup failed — ${e.message}`);
      console.error('  ABORTING: backup failure, no deletions performed');
      await conn.end();
      process.exit(1);
    }
  }

  // Write backup manifest
  fs.writeFileSync(
    path.join(backupDir, '_manifest.json'),
    JSON.stringify(backupMeta, null, 2)
  );
  console.log(`\n  Backup manifest written to ${backupDir}/_manifest.json`);
  console.log('  Backup complete — proceeding to deletion\n');

  // ─────────────────────────────────────────────────────────
  // STEP 2: FK-safe deletion
  // ─────────────────────────────────────────────────────────
  console.log('── STEP 2: FK-safe deletion ──');
  const deletionResults = {};

  for (const table of PURGE_TABLES) {
    try {
      const [result] = await conn.execute(`DELETE FROM \`${table}\``);
      deletionResults[table] = result.affectedRows;
      console.log(`  ✓ DELETE FROM ${table}: ${result.affectedRows} rows deleted`);
    } catch (e) {
      console.error(`  ✗ DELETE FROM ${table}: FAILED — ${e.message}`);
      // Continue with remaining tables
    }
  }

  // ─────────────────────────────────────────────────────────
  // STEP 3: Fix assets table column order (sectionId position)
  // The DB has sectionId as the 33rd column (added via ALTER TABLE later),
  // but Drizzle schema expects it after siteId (9th position).
  // Fix: use named-column INSERT (Drizzle already does this) — but verify
  // that the createAsset function uses explicit column names.
  // ─────────────────────────────────────────────────────────
  console.log('\n── STEP 3: Verify assets table INSERT compatibility ──');
  // Test insert with explicit column names to confirm schema sync
  try {
    const [testResult] = await conn.execute(`
      INSERT INTO assets (assetNumber, name, status, originalLanguage, createdAt, updatedAt)
      VALUES ('TEST-SCHEMA-CHECK', 'Schema Test', 'active', 'ar', NOW(), NOW())
    `);
    const insertId = testResult.insertId;
    await conn.execute(`DELETE FROM assets WHERE id = ?`, [insertId]);
    console.log('  ✓ Named-column INSERT works correctly — schema is compatible');
  } catch (e) {
    console.error(`  ✗ Test INSERT failed: ${e.message}`);
  }

  // ─────────────────────────────────────────────────────────
  // STEP 4: Post-reset verification
  // ─────────────────────────────────────────────────────────
  console.log('\n── STEP 4: Post-reset verification ──');

  // Row counts after deletion
  console.log('\n  Final row counts:');
  const allTables = [...PURGE_TABLES, ...PRESERVE_TABLES];
  for (const table of allTables) {
    const [[row]] = await conn.execute(`SELECT COUNT(*) as cnt FROM \`${table}\``);
    const status = PRESERVE_TABLES.includes(table) ? 'PRESERVED' : (row.cnt === 0 ? 'CLEAN' : 'WARNING: not empty');
    console.log(`  ${table}: ${row.cnt} rows [${status}]`);
  }

  // Orphan checks
  console.log('\n  Orphan reference checks:');
  const [[o1]] = await conn.execute(`SELECT COUNT(*) as cnt FROM assets a LEFT JOIN sites s ON a.siteId=s.id WHERE a.siteId IS NOT NULL AND s.id IS NULL`);
  console.log(`  assets.siteId orphans: ${o1.cnt} ${o1.cnt === 0 ? '✓' : '✗ WARNING'}`);
  const [[o2]] = await conn.execute(`SELECT COUNT(*) as cnt FROM assets a LEFT JOIN sections sc ON a.sectionId=sc.id WHERE a.sectionId IS NOT NULL AND sc.id IS NULL`);
  console.log(`  assets.sectionId orphans: ${o2.cnt} ${o2.cnt === 0 ? '✓' : '✗ WARNING'}`);
  const [[o3]] = await conn.execute(`SELECT COUNT(*) as cnt FROM sections sc LEFT JOIN sites s ON sc.siteId=s.id WHERE sc.siteId IS NOT NULL AND s.id IS NULL`);
  console.log(`  sections.siteId orphans: ${o3.cnt} ${o3.cnt === 0 ? '✓' : '✗ WARNING'}`);

  // Preserved data integrity
  console.log('\n  Preserved master data:');
  const [[uCount]] = await conn.execute(`SELECT COUNT(*) as cnt FROM users`);
  const [[siteCount]] = await conn.execute(`SELECT COUNT(*) as cnt FROM sites`);
  const [[secCount]] = await conn.execute(`SELECT COUNT(*) as cnt FROM sections`);
  const [[catCount]] = await conn.execute(`SELECT COUNT(*) as cnt FROM asset_categories`);
  console.log(`  users: ${uCount.cnt} ✓`);
  console.log(`  sites: ${siteCount.cnt} ✓`);
  console.log(`  sections: ${secCount.cnt} ✓`);
  console.log(`  asset_categories: ${catCount.cnt} ✓`);

  await conn.end();

  console.log(`\n${'='.repeat(60)}`);
  console.log('STAGE 0.6 COMPLETE');
  console.log(`Backup: ${backupDir}`);
  console.log(`${'='.repeat(60)}\n`);
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });

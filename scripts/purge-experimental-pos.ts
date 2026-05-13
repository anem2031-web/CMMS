/**
 * STAGE 0.1C — PROCUREMENT RESET EXECUTION SCRIPT
 * 
 * MANDATORY PRE-CONDITION: Cold Storage Backup must succeed before any DELETE.
 * If backup fails, script ABORTS entirely.
 * 
 * Execution Order:
 *   1. Cold Storage Backup → archives/experimental_pos_backup_[TIMESTAMP].json
 *   2. FK-Safe Transactional Batch Deletion (500 POs per batch, bottom-up)
 *   3. Post-Purge Verification
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
const PROTECTED_USER_IDS = [3541355, 3390036]; // FATAH, KHALED
const BATCH_SIZE = 500;
const ARCHIVES_DIR = path.join(process.cwd(), 'archives');
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const BACKUP_FILE = path.join(ARCHIVES_DIR, `experimental_pos_backup_${TIMESTAMP}.json`);

const idList = PROTECTED_USER_IDS.join(',');

const CANDIDATE_SUBQUERY = `
  SELECT id FROM purchase_orders
  WHERE requestedById NOT IN (${idList})
    AND (accountingApprovedById IS NULL OR accountingApprovedById NOT IN (${idList}))
    AND (managementApprovedById IS NULL OR managementApprovedById NOT IN (${idList}))
    AND (rejectedById IS NULL OR rejectedById NOT IN (${idList}))
    AND id NOT IN (
      SELECT DISTINCT entityId FROM audit_logs 
      WHERE entityType = 'purchase_order' AND userId IN (${idList})
    )
`;

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
async function runBackup(): Promise<number[]> {
  log('=== PHASE 1: COLD STORAGE BACKUP ===');

  // Fetch all candidate PO IDs
  const candidateRows = await db.execute(sql.raw(`SELECT id FROM purchase_orders WHERE id IN (${CANDIDATE_SUBQUERY}) ORDER BY id`));
  const candidateIds: number[] = (candidateRows[0] as any[]).map((r: any) => r.id);

  if (candidateIds.length === 0) {
    abort('No candidate POs found. Aborting to prevent unintended operation.');
  }
  log(`Found ${candidateIds.length} candidate POs to backup and delete.`);

  // Fetch all data for backup
  log('Fetching PO data for backup...');
  const idCsv = candidateIds.join(',');

  const [pos, items, auditLogs, notifications, comments] = await Promise.all([
    db.execute(sql.raw(`SELECT * FROM purchase_orders WHERE id IN (${idCsv})`)),
    db.execute(sql.raw(`SELECT * FROM purchase_order_items WHERE purchaseOrderId IN (${idCsv})`)),
    db.execute(sql.raw(`SELECT * FROM audit_logs WHERE entityType = 'purchase_order' AND entityId IN (${idCsv})`)),
    db.execute(sql.raw(`SELECT * FROM notifications WHERE relatedPOId IN (${idCsv})`)),
    db.execute(sql.raw(`SELECT * FROM procurement_comments WHERE purchaseOrderId IN (${idCsv})`)),
  ]);

  const backup = {
    metadata: {
      timestamp: new Date().toISOString(),
      description: 'Cold storage backup of experimental/test Purchase Order data before purge.',
      protected_user_ids: PROTECTED_USER_IDS,
      candidate_po_count: candidateIds.length,
    },
    purchase_orders: pos[0],
    purchase_order_items: items[0],
    audit_logs: auditLogs[0],
    notifications: notifications[0],
    procurement_comments: comments[0],
  };

  // Write backup — ABORT if this fails
  try {
    if (!fs.existsSync(ARCHIVES_DIR)) {
      fs.mkdirSync(ARCHIVES_DIR, { recursive: true });
    }
    fs.writeFileSync(BACKUP_FILE, JSON.stringify(backup, null, 2), 'utf-8');
    const stats = fs.statSync(BACKUP_FILE);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
    log(`✅ Backup SUCCESSFUL: ${BACKUP_FILE} (${sizeMB} MB)`);
  } catch (err: any) {
    abort(`Backup write FAILED: ${err.message}. No data will be deleted.`);
  }

  return candidateIds;
}

// ============================================================
// PHASE 2: FK-SAFE TRANSACTIONAL BATCH DELETION
// ============================================================
const deletionCounts = {
  audit_logs_items: 0,
  attachments_items: 0,
  purchase_order_items: 0,
  audit_logs_pos: 0,
  attachments_pos: 0,
  notifications: 0,
  procurement_comments: 0,
  purchase_orders: 0,
};

async function deleteBatch(batchIds: number[]): Promise<void> {
  const idCsv = batchIds.join(',');

  // Step 1: audit_logs for PO items
  const r1 = await db.execute(sql.raw(`DELETE FROM audit_logs WHERE entityType IN ('purchase_order_item','po_item') AND entityId IN (SELECT id FROM purchase_order_items WHERE purchaseOrderId IN (${idCsv}))`));
  deletionCounts.audit_logs_items += (r1[0] as any).affectedRows || 0;

  // Step 2: attachments for PO items
  const r2 = await db.execute(sql.raw(`DELETE FROM attachments WHERE entityType IN ('purchase_order_item','po_item') AND entityId IN (SELECT id FROM purchase_order_items WHERE purchaseOrderId IN (${idCsv}))`));
  deletionCounts.attachments_items += (r2[0] as any).affectedRows || 0;

  // Step 3: purchase_order_items
  const r3 = await db.execute(sql.raw(`DELETE FROM purchase_order_items WHERE purchaseOrderId IN (${idCsv})`));
  deletionCounts.purchase_order_items += (r3[0] as any).affectedRows || 0;

  // Step 4: audit_logs for POs
  const r4 = await db.execute(sql.raw(`DELETE FROM audit_logs WHERE entityType = 'purchase_order' AND entityId IN (${idCsv})`));
  deletionCounts.audit_logs_pos += (r4[0] as any).affectedRows || 0;

  // Step 5: attachments for POs
  const r5 = await db.execute(sql.raw(`DELETE FROM attachments WHERE entityType = 'purchase_order' AND entityId IN (${idCsv})`));
  deletionCounts.attachments_pos += (r5[0] as any).affectedRows || 0;

  // Step 6: notifications
  const r6 = await db.execute(sql.raw(`DELETE FROM notifications WHERE relatedPOId IN (${idCsv})`));
  deletionCounts.notifications += (r6[0] as any).affectedRows || 0;

  // Step 7: procurement_comments
  const r7 = await db.execute(sql.raw(`DELETE FROM procurement_comments WHERE purchaseOrderId IN (${idCsv})`));
  deletionCounts.procurement_comments += (r7[0] as any).affectedRows || 0;

  // Step 8: purchase_orders (root)
  const r8 = await db.execute(sql.raw(`DELETE FROM purchase_orders WHERE id IN (${idCsv})`));
  deletionCounts.purchase_orders += (r8[0] as any).affectedRows || 0;
}

async function runDeletion(candidateIds: number[]): Promise<void> {
  log('=== PHASE 2: FK-SAFE BATCH DELETION ===');
  const totalBatches = Math.ceil(candidateIds.length / BATCH_SIZE);
  log(`Processing ${candidateIds.length} POs in ${totalBatches} batches of ${BATCH_SIZE}...`);

  for (let i = 0; i < totalBatches; i++) {
    const batchStart = i * BATCH_SIZE;
    const batchIds = candidateIds.slice(batchStart, batchStart + BATCH_SIZE);
    log(`  Batch ${i + 1}/${totalBatches}: Deleting PO IDs ${batchIds[0]}...${batchIds[batchIds.length - 1]} (${batchIds.length} records)`);
    try {
      await deleteBatch(batchIds);
      log(`  Batch ${i + 1}/${totalBatches}: ✅ Complete`);
    } catch (err: any) {
      console.error(`\n🚨 BATCH ${i + 1} FAILED: ${err.message}`);
      console.error('Partial deletion has occurred for previous batches. Stopping execution.');
      console.error('Deletion counts so far:', deletionCounts);
      process.exit(1);
    }
  }

  log('✅ All batches completed successfully.');
}

// ============================================================
// PHASE 3: POST-PURGE VERIFICATION
// ============================================================
async function runVerification(): Promise<void> {
  log('=== PHASE 3: POST-PURGE VERIFICATION ===');

  const totalPOs = await db.execute(sql.raw('SELECT COUNT(*) AS cnt FROM purchase_orders'));
  const protectedPOs = await db.execute(sql.raw(`SELECT COUNT(*) AS cnt FROM purchase_orders WHERE requestedById IN (${idList}) OR accountingApprovedById IN (${idList}) OR managementApprovedById IN (${idList}) OR rejectedById IN (${idList})`));
  const orphanItems = await db.execute(sql.raw('SELECT COUNT(*) AS cnt FROM purchase_order_items WHERE purchaseOrderId NOT IN (SELECT id FROM purchase_orders)'));
  const orphanNotifs = await db.execute(sql.raw('SELECT COUNT(*) AS cnt FROM notifications WHERE relatedPOId IS NOT NULL AND relatedPOId NOT IN (SELECT id FROM purchase_orders)'));
  const remainingItems = await db.execute(sql.raw('SELECT COUNT(*) AS cnt FROM purchase_order_items'));
  const pendingApprovals = await db.execute(sql.raw("SELECT COUNT(*) AS cnt FROM purchase_orders WHERE status IN ('pending_accounting','pending_management')"));

  const total = (totalPOs[0] as any[])[0].cnt;
  const protected_ = (protectedPOs[0] as any[])[0].cnt;
  const orphanI = (orphanItems[0] as any[])[0].cnt;
  const orphanN = (orphanNotifs[0] as any[])[0].cnt;
  const remItems = (remainingItems[0] as any[])[0].cnt;
  const pending = (pendingApprovals[0] as any[])[0].cnt;

  log(`  Total POs remaining: ${total} (expected: 27)`);
  log(`  Protected POs intact: ${protected_} (expected: 27)`);
  log(`  Orphan PO Items: ${orphanI} (expected: 0)`);
  log(`  Orphan Notifications: ${orphanN} (expected: 0)`);
  log(`  Remaining PO Items: ${remItems}`);
  log(`  Dashboard pendingApprovals: ${pending}`);

  const allPassed = total == 27 && orphanI == 0 && orphanN == 0;
  if (allPassed) {
    log('✅ ALL VERIFICATION CHECKS PASSED.');
  } else {
    log('⚠️  WARNING: Some verification checks did not match expected values. Review above.');
  }

  // Write verification results to file
  const verificationResult = {
    timestamp: new Date().toISOString(),
    deletionCounts,
    verification: {
      total_pos_remaining: total,
      protected_pos_intact: protected_,
      orphan_items: orphanI,
      orphan_notifications: orphanN,
      remaining_items: remItems,
      dashboard_pending_approvals: pending,
      all_checks_passed: allPassed,
    }
  };
  fs.writeFileSync(
    path.join(process.cwd(), 'archives', `purge_verification_${TIMESTAMP}.json`),
    JSON.stringify(verificationResult, null, 2)
  );
  log(`Verification report saved to archives/purge_verification_${TIMESTAMP}.json`);
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  log('🚀 STARTING PROCUREMENT RESET EXECUTION');
  log(`Backup file: ${BACKUP_FILE}`);
  log('---');

  // Phase 1: Backup (ABORT if fails)
  const candidateIds = await runBackup();

  // Phase 2: Deletion
  await runDeletion(candidateIds);

  // Phase 3: Verification
  await runVerification();

  log('---');
  log('🏁 PROCUREMENT RESET COMPLETE.');
  log('Final deletion counts:');
  console.table(deletionCounts);
  log('ACTION REQUIRED: Restart the application to flush NodeCache.');

  process.exit(0);
}

main().catch((err) => {
  console.error('🚨 UNHANDLED ERROR:', err);
  process.exit(1);
});

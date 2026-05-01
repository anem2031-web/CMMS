-- ============================================================
-- Phase 1 Migration: PO Review Schema Changes
-- Date: 2026-05-01
-- Safe to run on live data: YES (additive only, no data moved)
-- Rollback: See rollback section at bottom
-- ============================================================

-- CHANGE 1: Add 'pending_review' to purchase_orders.status enum
-- Position: inserted after 'draft', before 'pending_estimate'
-- Existing data: 4 rows (statuses: 'approved' x1, 'received' x3) — unaffected
ALTER TABLE purchase_orders
  MODIFY COLUMN status
    ENUM(
      'draft',
      'pending_review',
      'pending_estimate',
      'pending_accounting',
      'pending_management',
      'approved',
      'partial_purchase',
      'purchased',
      'received',
      'closed',
      'rejected'
    )
    COLLATE utf8mb4_unicode_ci
    NOT NULL
    DEFAULT 'draft';

-- CHANGE 2: Add 'rejected' to purchase_order_items.status enum
-- Position: inserted after 'approved', before 'funded'
-- Existing data: 4 rows (statuses: 'approved' x1, 'delivered_to_requester' x3) — unaffected
ALTER TABLE purchase_order_items
  MODIFY COLUMN status
    ENUM(
      'pending',
      'estimated',
      'approved',
      'rejected',
      'funded',
      'purchased',
      'delivered_to_warehouse',
      'delivered_to_requester'
    )
    COLLATE utf8mb4_unicode_ci
    NOT NULL
    DEFAULT 'pending';

-- CHANGE 3: Add rejectionReason column to purchase_order_items
-- Type: TEXT, nullable (no default needed — only set when item is rejected)
-- Existing data: unaffected (column is nullable, all existing rows get NULL)
ALTER TABLE purchase_order_items
  ADD COLUMN rejectionReason TEXT NULL
  AFTER delegateId;

-- ============================================================
-- ROLLBACK (if needed — run in reverse order)
-- ============================================================
-- ALTER TABLE purchase_order_items DROP COLUMN rejectionReason;
--
-- ALTER TABLE purchase_order_items
--   MODIFY COLUMN status
--     ENUM('pending','estimated','approved','funded','purchased','delivered_to_warehouse','delivered_to_requester')
--     COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending';
--
-- ALTER TABLE purchase_orders
--   MODIFY COLUMN status
--     ENUM('draft','pending_estimate','pending_accounting','pending_management','approved','partial_purchase','purchased','received','closed','rejected')
--     COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'draft';
-- ============================================================

-- Ticket inspection workflow: direct assignment, technician/manager recording,
-- manager review, correction returns, and reliable actor attribution.
-- TiDB: statements are intentionally separated because a newly added column
-- cannot always be referenced by AFTER in the same ALTER TABLE statement.

ALTER TABLE `tickets`
  ADD COLUMN IF NOT EXISTS `inspectionWorkflowStatus`
  ENUM(
    'maintenance_inspection_pending_submission',
    'maintenance_inspection_submitted_for_review',
    'maintenance_inspection_returned_for_correction',
    'maintenance_inspection_approved'
  ) NULL
  AFTER `inspectionNotes`;

ALTER TABLE `tickets`
  ADD COLUMN IF NOT EXISTS `inspectionPerformedById` INT NULL
  AFTER `inspectionWorkflowStatus`;

ALTER TABLE `tickets`
  ADD COLUMN IF NOT EXISTS `inspectionRecordedById` INT NULL
  AFTER `inspectionPerformedById`;

ALTER TABLE `tickets`
  ADD COLUMN IF NOT EXISTS `inspectionSubmittedAt` TIMESTAMP NULL DEFAULT NULL
  AFTER `inspectionRecordedById`;

ALTER TABLE `tickets`
  ADD COLUMN IF NOT EXISTS `inspectionSubmittedById` INT NULL
  AFTER `inspectionSubmittedAt`;

ALTER TABLE `tickets`
  ADD COLUMN IF NOT EXISTS `inspectionApprovedAt` TIMESTAMP NULL DEFAULT NULL
  AFTER `inspectionSubmittedById`;

ALTER TABLE `tickets`
  ADD COLUMN IF NOT EXISTS `inspectionApprovedById` INT NULL
  AFTER `inspectionApprovedAt`;

ALTER TABLE `tickets`
  ADD COLUMN IF NOT EXISTS `inspectionReturnedAt` TIMESTAMP NULL DEFAULT NULL
  AFTER `inspectionApprovedById`;

ALTER TABLE `tickets`
  ADD COLUMN IF NOT EXISTS `inspectionReturnedById` INT NULL
  AFTER `inspectionReturnedAt`;

ALTER TABLE `tickets`
  ADD COLUMN IF NOT EXISTS `inspectionReturnReason` TEXT NULL
  AFTER `inspectionReturnedById`;

ALTER TABLE `inspection_results`
  ADD COLUMN IF NOT EXISTS `performedById` INT NULL
  AFTER `inspectorId`;

ALTER TABLE `inspection_results`
  ADD COLUMN IF NOT EXISTS `recordedById` INT NULL
  AFTER `performedById`;

ALTER TABLE `inspection_results`
  ADD COLUMN IF NOT EXISTS `inspectionNotes` TEXT NULL
  AFTER `recommendedAction`;

ALTER TABLE `inspection_results`
  ADD COLUMN IF NOT EXISTS `workflowStatus`
  ENUM(
    'maintenance_inspection_result_draft',
    'maintenance_inspection_result_submitted',
    'maintenance_inspection_result_returned',
    'maintenance_inspection_result_approved',
    'maintenance_inspection_result_superseded'
  ) NOT NULL DEFAULT 'maintenance_inspection_result_draft'
  AFTER `inspectionNotes`;

ALTER TABLE `inspection_results`
  ADD COLUMN IF NOT EXISTS `revisionNumber` INT NOT NULL DEFAULT 1
  AFTER `workflowStatus`;

ALTER TABLE `inspection_results`
  ADD COLUMN IF NOT EXISTS `submittedAt` TIMESTAMP NULL DEFAULT NULL
  AFTER `revisionNumber`;

ALTER TABLE `inspection_results`
  ADD COLUMN IF NOT EXISTS `approvedAt` TIMESTAMP NULL DEFAULT NULL
  AFTER `submittedAt`;

ALTER TABLE `inspection_results`
  ADD COLUMN IF NOT EXISTS `approvedById` INT NULL
  AFTER `approvedAt`;

ALTER TABLE `inspection_results`
  ADD COLUMN IF NOT EXISTS `returnedAt` TIMESTAMP NULL DEFAULT NULL
  AFTER `approvedById`;

ALTER TABLE `inspection_results`
  ADD COLUMN IF NOT EXISTS `returnedById` INT NULL
  AFTER `returnedAt`;

ALTER TABLE `inspection_results`
  ADD COLUMN IF NOT EXISTS `returnReason` TEXT NULL
  AFTER `returnedById`;

ALTER TABLE `inspection_results`
  ADD COLUMN IF NOT EXISTS `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  AFTER `createdAt`;

-- Existing results are preserved and treated as approved historical inspections.
UPDATE `inspection_results`
SET
  `performedById` = COALESCE(`performedById`, `inspectorId`),
  `recordedById` = COALESCE(`recordedById`, `inspectorId`),
  `workflowStatus` = 'maintenance_inspection_result_approved',
  `submittedAt` = COALESCE(`submittedAt`, `createdAt`),
  `approvedAt` = COALESCE(`approvedAt`, `createdAt`),
  `approvedById` = COALESCE(`approvedById`, `recordedById`, `inspectorId`)
WHERE `workflowStatus` = 'maintenance_inspection_result_draft'
  AND `createdAt` IS NOT NULL;

-- Backfill active tickets without changing closed or pre-triage reports.
UPDATE `tickets`
SET `inspectionWorkflowStatus` = CASE
  WHEN `status` = 'under_inspection' AND NULLIF(TRIM(COALESCE(`inspectionNotes`, '')), '') IS NULL
    THEN 'maintenance_inspection_pending_submission'
  WHEN `status` = 'under_inspection'
    THEN 'maintenance_inspection_approved'
  WHEN `status` IN (
    'work_approved','ready_for_closure','approved','assigned','in_progress','needs_purchase',
    'purchase_pending_estimate','purchase_pending_accounting','purchase_pending_management',
    'purchase_approved','partial_purchase','purchased','received_warehouse','out_for_repair',
    'repaired','verified','closed','requester_confirmed'
  )
    THEN 'maintenance_inspection_approved'
  ELSE `inspectionWorkflowStatus`
END
WHERE `inspectionWorkflowStatus` IS NULL;

CREATE INDEX `idx_tickets_inspection_workflow_status`
  ON `tickets` (`inspectionWorkflowStatus`);

CREATE INDEX `idx_inspection_results_ticket_revision`
  ON `inspection_results` (`ticketId`, `revisionNumber`);

CREATE INDEX `idx_inspection_results_workflow_status`
  ON `inspection_results` (`workflowStatus`);

-- IT notification isolation. No historical rows are updated.
ALTER TABLE `notifications`
ADD COLUMN `eventKey` varchar(80) NULL AFTER `type`;

-- Execute as a separate statement on TiDB.
CREATE INDEX `idx_notifications_user_event_created`
ON `notifications` (`userId`, `eventKey`, `createdAt`);

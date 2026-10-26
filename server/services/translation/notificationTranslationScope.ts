import { eq, sql, type SQLWrapper } from "drizzle-orm";
import { notifications, users } from "../../../drizzle/schema";
import { APP_ROLE } from "../../../shared/roles";

// Used inside the bounded SQL selection, never a per-row lookup in list loops.
export function automaticTranslationScope(entityType: SQLWrapper, entityId: SQLWrapper) {
  return sql<number>`(${entityType} <> 'NOTIFICATION' OR EXISTS (
    SELECT 1 FROM notifications translation_recipient_notification
    INNER JOIN users translation_recipient_user
      ON translation_recipient_user.id = translation_recipient_notification.userId
    WHERE translation_recipient_notification.id = ${entityId}
      AND translation_recipient_user.role IN (${APP_ROLE.IT_MANAGER}, ${APP_ROLE.IT_MEMBER})
  ))`;
}

// Only individual enqueue/execution boundaries call this reader. No cached roles.
export async function loadNotificationRecipientRole(db: any, entityType: string, entityId: number): Promise<string | undefined> {
  if (entityType.trim().toUpperCase() !== "NOTIFICATION") return undefined;
  const [recipient] = await db.select({ role: users.role }).from(notifications)
    .innerJoin(users, eq(users.id, notifications.userId))
    .where(eq(notifications.id, entityId)).limit(1);
  return recipient?.role;
}

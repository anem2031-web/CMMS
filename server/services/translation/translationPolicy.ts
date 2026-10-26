import { isItTeamRole } from "../../../shared/roles";

// Recipient role, not sender/actor role. Delivery permissions are unchanged.
export function isAutomaticTranslationEnabled(entityType: string, recipientRole?: string | null): boolean {
  return entityType.trim().toUpperCase() !== "NOTIFICATION" || isItTeamRole(recipientRole);
}

export const TRANSLATION_RETRY_BATCH_SIZE = 20;

export function canProcessTranslationJob(job: any, translation: any, recipientRole?: string | null): boolean {
  return isAutomaticTranslationEnabled(job.entityType, recipientRole)
    && job.status === "pending"
    && !!translation
    && translation.translationJobId === job.id
    && !["approved", "completed"].includes(translation.translationStatus);
}

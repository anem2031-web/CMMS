import { and, eq } from "drizzle-orm";
import { pmv2ExecutionActor, pmv2ExecutionActorCondition, pmv2ExecutionTeamCondition } from "../security/execution-access";
import {
  pmv2ItemActions,
  pmv2TaskItems,
  pmv2Tasks,
  pmv2Visits,
} from "../../../drizzle/schema";
import { getDb } from "../../_core/db/client";
import {
  canAccessPmv2TechnicianExecution,
  canManagePmv2Foundation,
} from "../security/policy";

export class Pmv2EvidenceAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Pmv2EvidenceAccessError";
  }
}

export type Pmv2EvidenceAccessMode = "read" | "write";

type Pmv2EvidenceUser = {
  id: number;
  role: string;
};

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("تعذر الاتصال بقاعدة البيانات");
  return db;
}

/**
 * Attachment boundary for PM V2 execution evidence.
 * Evidence is attached to the existing pmv2_item_actions record, never to a
 * parallel PM V2 attachment table.
 *
 * Read:
 * - PM V2 managers may review evidence.
 * - Technicians require active team membership; designated administrative executors may access all teams.
 *
 * Write:
 * - an active account with execution access to the Task Team;
 * - the target Item Action must have been performed by the same technician;
 * - the Visit that owns that action must still be open.
 */
export async function assertPmv2ItemActionEvidenceAccess(
  user: Pmv2EvidenceUser,
  itemActionId: number,
  mode: Pmv2EvidenceAccessMode = "read",
) {
  const db = await requireDb();
  const rows = await db
    .select({
      actionId: pmv2ItemActions.id,
      taskItemId: pmv2ItemActions.taskItemId,
      performedById: pmv2ItemActions.performedById,
      visitId: pmv2ItemActions.visitId,
      visitEndedAt: pmv2Visits.endedAt,
      taskId: pmv2Tasks.id,
      teamId: pmv2Tasks.teamId,
      executionActorId: pmv2ExecutionActor.id,
    })
    .from(pmv2ItemActions)
    .innerJoin(pmv2TaskItems, eq(pmv2TaskItems.id, pmv2ItemActions.taskItemId))
    .innerJoin(pmv2Tasks, eq(pmv2Tasks.id, pmv2TaskItems.taskId))
    .innerJoin(
      pmv2Visits,
      and(
        eq(pmv2Visits.id, pmv2ItemActions.visitId),
        eq(pmv2Visits.taskId, pmv2Tasks.id),
      ),
    )
    .leftJoin(
      pmv2ExecutionActor, pmv2ExecutionActorCondition(user.id),
    )
    .where(eq(pmv2ItemActions.id, itemActionId))
    .limit(1);

  const row = rows[0];
  if (!row) throw new Pmv2EvidenceAccessError("إجراء التنفيذ المرتبط بالدليل غير موجود");

  if (mode === "read" && canManagePmv2Foundation(user.role)) return row;

  if (!canAccessPmv2TechnicianExecution(user.role) || !row.executionActorId) {
    throw new Pmv2EvidenceAccessError("ليس لديك صلاحية الوصول إلى دليل تنفيذ هذا البند");
  }

  // Keep the existing manager review exception and own-action/open-visit rules.
  // The team proof belongs in WHERE, not in the optional actor JOIN ON.
  const allowed = await db.select({ id: pmv2ExecutionActor.id }).from(pmv2ExecutionActor)
    .where(pmv2ExecutionTeamCondition(user.id, Number(row.teamId))).limit(1);
  if (!allowed[0]) {
    throw new Pmv2EvidenceAccessError("ليس لديك صلاحية الوصول إلى دليل تنفيذ هذا البند");
  }

  if (mode === "write") {
    if (Number(row.performedById) !== Number(user.id)) {
      throw new Pmv2EvidenceAccessError("يمكنك إضافة دليل فقط إلى إجراء نفذته أنت");
    }
    if (row.visitEndedAt != null) {
      throw new Pmv2EvidenceAccessError("لا يمكن إضافة دليل بعد إنهاء الزيارة");
    }
  }

  return row;
}

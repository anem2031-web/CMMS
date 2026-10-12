import {
  TeamTicketError,
  integer,
  required,
} from "../../../shared/maintenance-team-tickets/model";
import {
  canManageTicketTeams,
  type TeamManagementRepository,
  type TeamManagementActor,
  type SaveTeamInput,
} from "../../../shared/maintenance-team-tickets/team-management";

function memberIds(ids: number[]) {
  if (!Array.isArray(ids))
    throw new TeamTicketError("INVALID", "قائمة الفنيين غير صحيحة");
  ids.forEach(id => integer(id, "الفني"));
  if (new Set(ids).size !== ids.length)
    throw new TeamTicketError("INVALID", "لا تكرر الفني في الفريق");
  return [...ids].sort((a, b) => a - b);
}

function authorize(actor: TeamManagementActor) {
  if (!actor.active || !canManageTicketTeams(actor.role))
    throw new TeamTicketError(
      "FORBIDDEN",
      "إدارة فرق تذاكر الصيانة للمسؤول المخوّل فقط"
    );
  integer(actor.id, "المستخدم");
}
export class TicketTeamManagementService {
  constructor(private readonly repository: TeamManagementRepository) {}
  async list(actor: TeamManagementActor) {
    authorize(actor);
    return this.repository.readData();
  }
  async create(
    actor: TeamManagementActor,
    input: { name: string; warehouseId: number; memberIds?: number[] }
  ) {
    authorize(actor);
    const name = required(input.name, "اسم الفريق", 100);
    integer(input.warehouseId, "المستودع");
    const selected = memberIds(input.memberIds ?? []);
    return this.repository.transaction(async tx => {
      const warehouse = await tx.findWarehouse(input.warehouseId);
      if (!warehouse?.active || warehouse.type !== "branch")
        throw new TeamTicketError(
          "INVALID",
          "اختر مستودعًا فرعيًا قائمًا ونشطًا"
        );
      if (await tx.findTeamByName(name))
        throw new TeamTicketError("CONFLICT", "اسم الفريق موجود مسبقًا");
      for (const userId of selected) {
        const tech = await tx.findUser(userId);
        if (!tech?.active || tech.role !== "technician")
          throw new TeamTicketError("INVALID", "اختر فنيين داخليين نشطين فقط");
      }
      const id = await tx.createTeam(name, input.warehouseId, actor.id);
      integer(id, "الفريق الجديد");
      for (const userId of selected)
        await tx.setMembership(id, userId, true, actor.id);
      await tx.audit(actor, {
        action: "create_ticket_maintenance_team",
        entityId: id,
        oldValues: null,
        newValues: {
          name,
          warehouseId: input.warehouseId,
          isActive: true,
          memberIds: selected,
        },
      });
      return { id };
    });
  }
  async save(actor: TeamManagementActor, input: SaveTeamInput) {
    authorize(actor);
    integer(input.teamId, "الفريق");
    integer(input.warehouseId, "المستودع");
    const name = required(input.name, "اسم الفريق", 100);
    const selected = memberIds(input.memberIds);
    const expectedMembers = memberIds(input.expected.memberIds);
    return this.repository.transaction(async tx => {
      const team = await tx.findTeam(input.teamId);
      if (!team) throw new TeamTicketError("NOT_FOUND", "الفريق غير موجود");
      const memberships = await tx.membershipsForTeam(team.id);
      const current = memberships
        .filter(m => m.active)
        .map(m => m.userId)
        .sort((a, b) => a - b);
      const oldValues = {
        name: team.name,
        warehouseId: team.warehouseId,
        memberIds: current,
      };
      if (
        team.name !== input.expected.name ||
        team.warehouseId !== input.expected.warehouseId ||
        team.active !== input.expected.active ||
        JSON.stringify(current) !== JSON.stringify(expectedMembers)
      )
        throw new TeamTicketError(
          "CONFLICT",
          "تغيرت بيانات الفريق؛ أغلق التعديل وافتحه مجددًا قبل الحفظ"
        );
      const warehouseChanged = team.warehouseId !== input.warehouseId;
      const added = selected.filter(id => !current.includes(id));
      const removed = current.filter(id => !selected.includes(id));
      if (
        name === team.name &&
        !warehouseChanged &&
        !added.length &&
        !removed.length
      )
        return { changed: false };
      const existingName = await tx.findTeamByName(name);
      if (existingName && existingName.id !== team.id)
        throw new TeamTicketError("CONFLICT", "اسم الفريق موجود مسبقًا");
      if (warehouseChanged) {
        if (await tx.hasOpenExecution(team.id))
          throw new TeamTicketError(
            "CONFLICT",
            "لا يمكن تغيير مستودع فريق لديه تنفيذ مفتوح"
          );
        const warehouse = await tx.findWarehouse(input.warehouseId);
        if (!warehouse?.active || warehouse.type !== "branch")
          throw new TeamTicketError(
            "INVALID",
            "اختر مستودعًا فرعيًا قائمًا ونشطًا"
          );
      }
      if (!team.active && (added.length || removed.length))
        throw new TeamTicketError("INVALID", "فعّل الفريق قبل تعديل الفنيين");
      let validSelected = 0;
      // Validate the final membership before any write; a replacement technician can be added in the same save.
      for (const userId of selected) {
        const tech = await tx.findUser(userId);
        if (tech?.active && tech.role === "technician") validSelected++;
        else if (added.includes(userId))
          throw new TeamTicketError("INVALID", "اختر فنيين داخليين نشطين فقط");
      }
      if (
        removed.length &&
        (await tx.hasOpenExecution(team.id)) &&
        validSelected === 0
      )
        throw new TeamTicketError(
          "CONFLICT",
          "لا يمكن إزالة آخر فني نشط من فريق لديه تنفيذ مفتوح"
        );
      if (name !== team.name || warehouseChanged)
        await tx.updateTeamProfile(team.id, name, input.warehouseId, actor.id);
      for (const userId of added)
        await tx.setMembership(team.id, userId, true, actor.id);
      for (const userId of removed)
        await tx.setMembership(team.id, userId, false, actor.id);
      await tx.audit(actor, {
        action: "save_ticket_maintenance_team",
        entityId: team.id,
        oldValues,
        newValues: {
          name,
          warehouseId: input.warehouseId,
          memberIds: selected,
        },
      });
      return { changed: true };
    });
  }
  async setActive(
    actor: TeamManagementActor,
    input: { teamId: number; active: boolean }
  ) {
    authorize(actor);
    integer(input.teamId, "الفريق");
    if (typeof input.active !== "boolean")
      throw new TeamTicketError("INVALID", "حالة التفعيل غير صحيحة");
    return this.repository.transaction(async tx => {
      const team = await tx.findTeam(input.teamId);
      if (!team) throw new TeamTicketError("NOT_FOUND", "الفريق غير موجود");
      if (team.active === input.active) return { changed: false };
      if (!input.active && (await tx.hasOpenExecution(team.id)))
        throw new TeamTicketError(
          "CONFLICT",
          "لا يمكن تعطيل فريق لديه تنفيذ مفتوح"
        );
      if (input.active) {
        const warehouse = await tx.findWarehouse(team.warehouseId);
        if (!warehouse?.active || warehouse.type !== "branch")
          throw new TeamTicketError(
            "INVALID",
            "المستودع المرتبط غير نشط أو غير فرعي"
          );
      }
      await tx.setTeamActive(team.id, input.active, actor.id);
      await tx.audit(actor, {
        action: "set_ticket_maintenance_team_active",
        entityId: team.id,
        oldValues: { isActive: team.active },
        newValues: { isActive: input.active },
      });
      return { changed: true };
    });
  }
  async setMembership(
    actor: TeamManagementActor,
    input: { teamId: number; userId: number; active: boolean }
  ) {
    authorize(actor);
    integer(input.teamId, "الفريق");
    integer(input.userId, "الفني");
    if (typeof input.active !== "boolean")
      throw new TeamTicketError("INVALID", "حالة العضوية غير صحيحة");
    return this.repository.transaction(async tx => {
      // Locking the parent team serializes membership removal and prevents two last-member removals.
      const team = await tx.findTeam(input.teamId);
      if (!team) throw new TeamTicketError("NOT_FOUND", "الفريق غير موجود");
      const existing = await tx.findMembership(team.id, input.userId);
      if ((!existing && !input.active) || existing?.active === input.active)
        return { changed: false };
      if (input.active) {
        const tech = await tx.findUser(input.userId);
        if (!team.active || !tech?.active || tech.role !== "technician")
          throw new TeamTicketError(
            "INVALID",
            "اختر فنيًا داخليًا نشطًا وفريقًا نشطًا"
          );
      } else if (
        (await tx.hasOpenExecution(team.id)) &&
        (await tx.remainingActiveMemberCount(team.id, input.userId)) === 0
      ) {
        throw new TeamTicketError(
          "CONFLICT",
          "لا يمكن إزالة آخر فني نشط من فريق لديه تنفيذ مفتوح"
        );
      }
      await tx.setMembership(team.id, input.userId, input.active, actor.id);
      await tx.audit(actor, {
        action: "set_ticket_maintenance_team_member",
        entityId: team.id,
        oldValues: {
          userId: input.userId,
          isActive: existing?.active ?? false,
        },
        newValues: { userId: input.userId, isActive: input.active },
      });
      return { changed: true };
    });
  }
}

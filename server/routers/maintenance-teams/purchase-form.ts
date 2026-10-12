import { MaintenanceTeamTicketService } from "../../maintenance-team-tickets/service";
import { SqlExecutionStore } from "./execution.repository";
import { ProductionMaterialGateway } from "./execution.materials";
import { TeamTicketError } from "../../../shared/maintenance-team-tickets/model";
import type { TeamManagementActor } from "../../../shared/maintenance-team-tickets/team-management";
import type { MaterialGateway } from "../../maintenance-team-tickets/ports";

/** Runs within the canonical purchase header/items transaction. Never opens a DB. */
export async function createTicketMaterialPurchase(
  tx: any,
  actor: TeamManagementActor,
  input: any,
  create: NonNullable<MaterialGateway["purchaseForm"]>
) {
  let created = false;
  const context = input.ticketTeam;
  const store = new SqlExecutionStore(
    context.assignmentId,
    actor,
    {},
    async () => ({
      db: {
        execute: query => tx.execute(query),
        transaction: work => work(tx),
      },
      gateway: (current, state, user, options) => {
        const gateway = new ProductionMaterialGateway(
          current,
          state,
          user,
          options
        );
        gateway.purchaseForm = async handoff => {
          const item = input.items[0];
          if (
            input.items.length !== 1 ||
            Number(input.ticketId) !== handoff.ticketId ||
            Number(input.ticketItemId) !== handoff.ticketItemId ||
            Number(item.catalogItemId) !== handoff.catalogItemId ||
            item.unit !== handoff.unit ||
            Number(item.quantity) !== handoff.purchaseTotalQuantity ||
            Number(input.siteId) !== handoff.location.siteId ||
            Number(input.sectionId) !== handoff.location.sectionId ||
            (input.assetId ?? null) !== (handoff.location.assetId ?? null)
          )
            throw new TeamTicketError(
              "INVALID",
              "نموذج الشراء لا يطابق احتياج التذكرة والصنف والكمية وموقع التنفيذ"
            );
          const result = await create(handoff);
          created = true;
          return result;
        };
        return gateway;
      },
    })
  );
  const result = await new MaintenanceTeamTicketService(store).purchaseFromForm(
    actor.id,
    {
      assignmentId: context.assignmentId,
      expectedRevision: context.expectedRevision,
      operationKey: context.operationKey,
    },
    context.needId,
    {
      ...input,
      ticketTeam: {
        assignmentId: context.assignmentId,
        needId: context.needId,
        // Preserve the fingerprint of existing shortage-only operations on retry.
        ...(context.warehouseExtraQuantity === undefined ||
        context.warehouseExtraQuantity === 0
          ? {}
          : { warehouseExtraQuantity: context.warehouseExtraQuantity }),
      },
    }
  );
  return { ...result, created };
}

/** TEST/PREVIEW ONLY. Never import this module from the production router. */
import {
  TeamTicketError,
  type Snapshot,
} from "../../../shared/maintenance-team-tickets/model";
import type {
  Store,
  MaterialGateway,
  PhysicalDelivery,
  SupplyResult,
} from "../ports";

export interface SimulatedLot {
  id: number;
  warehouseId: number;
  catalogItemId: number;
  quantity: number;
  originalCost: number;
}
interface PhysicalState {
  lots: SimulatedLot[];
  deliveries: Array<
    PhysicalDelivery & { returned: number; originalCost: number }
  >;
  supplies: Array<
    SupplyResult & { warehouseId: number; catalogItemId: number; unit: string }
  >;
  receipts: Array<{
    returnId: number;
    sourceDeliveryId: number;
    lotId: number;
    quantity: number;
    originalCost: number;
  }>;
  operations: Array<{ key: string; result: unknown }>;
  nextId: number;
}
/** Serial in-memory transactions prove domain behavior, not TiDB locking. */
export class MemoryStore implements Store {
  private tail: Promise<unknown> = Promise.resolve();
  private state: Snapshot;
  private physical: PhysicalState;
  failNextIssue = false;
  failIssueForCatalog: number | null = null;
  failNextReturn = false;
  failReturnForDelivery: number | null = null;
  constructor(state: Snapshot, lots: SimulatedLot[]) {
    this.state = structuredClone(state);
    this.physical = {
      lots: structuredClone(lots),
      deliveries: [],
      supplies: [],
      receipts: [],
      operations: [],
      nextId: 10000,
    };
  }
  async read() {
    await this.tail;
    return structuredClone(this.state);
  }
  async inspectPhysical() {
    await this.tail;
    return structuredClone(this.physical);
  }
  async transaction<T>(
    work: (state: Snapshot, effects: MaterialGateway) => Promise<T>
  ): Promise<T> {
    const run = this.tail.then(async () => {
      const state = structuredClone(this.state);
      const physical = structuredClone(this.physical);
      const result = await work(state, this.gateway(physical));
      this.state = state;
      this.physical = physical;
      return structuredClone(result);
    });
    this.tail = run.catch(() => undefined);
    return run;
  }
  private gateway(p: PhysicalState): MaterialGateway {
    const availability = async (warehouseId: number, catalogItemId: number) =>
      p.lots
        .filter(
          l =>
            l.warehouseId === warehouseId && l.catalogItemId === catalogItemId
        )
        .reduce((n, l) => n + l.quantity, 0);
    const once = async <T>(key: string, run: () => Promise<T>): Promise<T> => {
      const existing = p.operations.find(op => op.key === key);
      if (existing) return structuredClone(existing.result) as T;
      const result = await run();
      p.operations.push({ key, result: structuredClone(result) });
      return result;
    };
    return {
      mainWarehouseId: async () => 10,
      availability,
      issue: input =>
        once(input.operationKey, async () => {
          if (
            this.failNextIssue ||
            this.failIssueForCatalog === input.catalogItemId
          ) {
            this.failNextIssue = false;
            this.failIssueForCatalog = null;
            throw new TeamTicketError("UNAVAILABLE", "فشل صرف محاكى");
          }
          if (
            (await availability(input.warehouseId, input.catalogItemId)) <
            input.quantity
          )
            throw new TeamTicketError("CONFLICT", "المخزون المحاكى غير كافٍ");
          let left = input.quantity;
          const result: PhysicalDelivery[] = [];
          for (const lot of p.lots.filter(
            l =>
              l.warehouseId === input.warehouseId &&
              l.catalogItemId === input.catalogItemId &&
              l.quantity > 0
          )) {
            const quantity = Math.min(left, lot.quantity);
            if (!quantity) continue;
            lot.quantity -= quantity;
            left -= quantity;
            const deliveryId = p.nextId++;
            const d: PhysicalDelivery = {
              deliveryId,
              deliveryNumber: `SIM-DLV-${deliveryId}`,
              lotId: lot.id,
              inventoryTransactionId: p.nextId++,
              catalogItemId: input.catalogItemId,
              warehouseId: input.warehouseId,
              quantity,
              unit: input.unit,
              receivedById: input.receiverId,
            };
            p.deliveries.push({
              ...d,
              returned: 0,
              originalCost: lot.originalCost,
            });
            result.push(d);
          }
          return result;
        }),
      transfer: input =>
        once(input.operationKey, async () => {
          const sourceWarehouseId = 10;
          if (
            input.destinationWarehouseId === sourceWarehouseId ||
            (await availability(sourceWarehouseId, input.catalogItemId)) <
              input.quantity
          )
            throw new TeamTicketError(
              "CONFLICT",
              "الرصيد المحاكى بالمستودع الرئيسي غير كافٍ؛ اختر طلب شراء"
            );
          let left = input.quantity;
          for (const source of [
            ...p.lots.filter(
              l =>
                l.warehouseId === sourceWarehouseId &&
                l.catalogItemId === input.catalogItemId
            ),
          ]) {
            const take = Math.min(left, source.quantity);
            if (!take) continue;
            source.quantity -= take;
            left -= take;
            const destination = p.lots.find(
              l =>
                l.id === source.id &&
                l.warehouseId === input.destinationWarehouseId
            );
            if (destination) destination.quantity += take;
            else
              p.lots.push({
                ...source,
                warehouseId: input.destinationWarehouseId,
                quantity: take,
              });
          }
          const sourceId = p.nextId++;
          const result: SupplyResult = {
            sourceId,
            sourceNumber: `SIM-TRF-${sourceId}`,
            quantity: input.quantity,
            status: "received",
          };
          p.supplies.push({
            ...result,
            warehouseId: input.destinationWarehouseId,
            catalogItemId: input.catalogItemId,
            unit: input.unit,
          });
          return result;
        }),
      purchase: input =>
        once(input.operationKey, async () => {
          const sourceId = p.nextId++;
          const result: SupplyResult = {
            sourceId,
            sourceNumber: `SIM-PO-${sourceId}`,
            quantity: input.quantity,
            status: "pending",
          };
          p.supplies.push({
            ...result,
            warehouseId: input.destinationWarehouseId,
            catalogItemId: input.catalogItemId,
            unit: input.unit,
          });
          return result;
        }),
      receivePurchase: input =>
        once(input.operationKey, async () => {
          const source = p.supplies.find(
            x => x.sourceId === input.sourceId && x.status === "pending"
          );
          if (!source)
            throw new TeamTicketError(
              "CONFLICT",
              "طلب الشراء المحاكى مستلم أو غير موجود"
            );
          // Simulates an already approved/received existing PO, not approval authority.
          source.status = "received";
          p.lots.push({
            id: p.nextId++,
            warehouseId: source.warehouseId,
            catalogItemId: source.catalogItemId,
            quantity: source.quantity,
            originalCost: 12,
          });
          return {
            sourceId: source.sourceId,
            sourceNumber: source.sourceNumber,
            quantity: source.quantity,
            status: "received",
          };
        }),
      returnToWarehouse: input =>
        once(input.operationKey, async () => {
          if (
            this.failNextReturn ||
            this.failReturnForDelivery === input.sourceDeliveryId
          ) {
            this.failNextReturn = false;
            this.failReturnForDelivery = null;
            throw new TeamTicketError("UNAVAILABLE", "فشل مرتجع محاكى");
          }
          const d = p.deliveries.find(
            d => d.deliveryId === input.sourceDeliveryId
          );
          if (!d || input.quantity > d.quantity - d.returned)
            throw new TeamTicketError("INVALID", "مرتجع محاكى أكبر من المصروف");
          const lot = p.lots.find(
            l => l.id === d.lotId && l.warehouseId === d.warehouseId
          );
          if (!lot)
            throw new TeamTicketError("INVALID", "الدفعة الأصلية غير موجودة");
          d.returned += input.quantity;
          lot.quantity += input.quantity;
          const returnId = p.nextId++;
          p.receipts.push({
            returnId,
            sourceDeliveryId: d.deliveryId,
            lotId: lot.id,
            quantity: input.quantity,
            originalCost: d.originalCost,
          });
          return {
            returnId,
            returnNumber: `SIM-RTN-${returnId}`,
            quantity: input.quantity,
          };
        }),
    };
  }
}

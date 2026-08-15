// ============================================================
// inventory-costing.ts — قواعد التكلفة المحاسبية المركزية للمخزون
// المرحلة 1: توحيد الحسابات فقط، دون تغيير Workflow أو واجهات المستخدم.
// ============================================================

export const INVENTORY_AVERAGE_COST_SCALE = 4;
export const INVENTORY_VALUE_SCALE = 2;

function assertFiniteNumber(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} يجب أن يكون رقماً صالحاً`);
  }
}

export function roundTo(value: number, scale: number): number {
  assertFiniteNumber(value, "القيمة");
  const factor = 10 ** scale;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function calculateIssueQuantity(receivedQuantity: number, conversionFactor: number): number {
  assertFiniteNumber(receivedQuantity, "كمية الاستلام");
  assertFiniteNumber(conversionFactor, "معامل التحويل");
  if (receivedQuantity < 0) throw new Error("كمية الاستلام لا يمكن أن تكون سالبة");
  if (conversionFactor <= 0) throw new Error("معامل التحويل يجب أن يكون أكبر من صفر");
  return receivedQuantity * conversionFactor;
}

export function calculateIssueUnitCost(purchaseUnitCost: number, conversionFactor: number): number {
  assertFiniteNumber(purchaseUnitCost, "تكلفة وحدة الشراء");
  assertFiniteNumber(conversionFactor, "معامل التحويل");
  if (purchaseUnitCost < 0) throw new Error("تكلفة وحدة الشراء لا يمكن أن تكون سالبة");
  if (conversionFactor <= 0) throw new Error("معامل التحويل يجب أن يكون أكبر من صفر");
  return roundTo(purchaseUnitCost / conversionFactor, INVENTORY_AVERAGE_COST_SCALE);
}

export function calculateMovingWeightedAverage(params: {
  currentQuantity: number;
  currentAverageCost: number;
  incomingQuantity: number;
  incomingUnitCost: number;
}): number {
  const { currentQuantity, currentAverageCost, incomingQuantity, incomingUnitCost } = params;
  [currentQuantity, currentAverageCost, incomingQuantity, incomingUnitCost].forEach((value, index) =>
    assertFiniteNumber(value, ["الرصيد الحالي", "متوسط التكلفة الحالي", "الكمية الواردة", "تكلفة الوحدة الواردة"][index]),
  );
  if (currentQuantity < 0 || incomingQuantity < 0 || currentAverageCost < 0 || incomingUnitCost < 0) {
    throw new Error("قيم الكمية والتكلفة المستخدمة في المتوسط المرجح لا يمكن أن تكون سالبة");
  }

  const newQuantity = currentQuantity + incomingQuantity;
  if (newQuantity === 0) return roundTo(incomingUnitCost, INVENTORY_AVERAGE_COST_SCALE);

  const weighted = ((currentQuantity * currentAverageCost) + (incomingQuantity * incomingUnitCost)) / newQuantity;
  return roundTo(weighted, INVENTORY_AVERAGE_COST_SCALE);
}

export function calculateInventoryValue(quantity: number, averageCost: number): number {
  assertFiniteNumber(quantity, "الكمية");
  assertFiniteNumber(averageCost, "متوسط التكلفة");
  return roundTo(quantity * averageCost, INVENTORY_VALUE_SCALE);
}

export function calculateMovementTotal(quantity: number, unitCost: number): number {
  assertFiniteNumber(quantity, "كمية الحركة");
  assertFiniteNumber(unitCost, "تكلفة الحركة");
  return roundTo(quantity * unitCost, INVENTORY_VALUE_SCALE);
}

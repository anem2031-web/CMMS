import { describe, expect, it } from "vitest";
import {
  calculateInventoryValue,
  calculateIssueQuantity,
  calculateIssueUnitCost,
  calculateMovementTotal,
  calculateMovingWeightedAverage,
  normalizeInventoryQuantity,
} from "../_core/inventory-costing";

describe("inventory costing foundation", () => {
  it("converts purchase units into issue units without inflating inventory value", () => {
    const issueQty = calculateIssueQuantity(1, 12);
    const issueUnitCost = calculateIssueUnitCost(120, 12);

    expect(issueQty).toBe(12);
    expect(issueUnitCost).toBe(10);
    expect(calculateMovementTotal(issueQty, issueUnitCost)).toBe(120);
  });

  it("keeps purchase value correct when conversion produces a repeating unit cost", () => {
    const issueQty = calculateIssueQuantity(1, 3);
    const issueUnitCost = calculateIssueUnitCost(100, 3);

    expect(issueQty).toBe(3);
    expect(issueUnitCost).toBe(33.3333);
    expect(calculateMovementTotal(issueQty, issueUnitCost)).toBe(100);
  });

  it("calculates moving weighted average on the inventory issue unit", () => {
    const newAverage = calculateMovingWeightedAverage({
      currentQuantity: 10,
      currentAverageCost: 8,
      incomingQuantity: 12,
      incomingUnitCost: 10,
    });

    expect(newAverage).toBe(9.0909);
    expect(calculateInventoryValue(22, newAverage)).toBe(200);
  });

  it("preserves fractional inventory quantities to three decimal places", () => {
    expect(normalizeInventoryQuantity(0.5)).toBe(0.5);
    expect(normalizeInventoryQuantity(1.2344)).toBe(1.234);
    expect(normalizeInventoryQuantity(1.2346)).toBe(1.235);
    expect(calculateInventoryValue(0.5, 120)).toBe(60);
    expect(calculateMovementTotal(0.125, 80)).toBe(10);
  });

  it("normalizes converted quantities before valuing inventory", () => {
    const issueQty = calculateIssueQuantity(0.3334, 3);
    expect(issueQty).toBe(1);
    expect(calculateInventoryValue(issueQty, 10)).toBe(10);
  });

  it("rejects converted quantities below the supported 0.001 precision", () => {
    expect(() => calculateIssueQuantity(0.0001, 1)).toThrow("0.001");
  });

  it("recalculates inventory value from quantity and stored average cost", () => {
    expect(calculateInventoryValue(8, 100)).toBe(800);
    expect(calculateInventoryValue(0, 100)).toBe(0);
  });
});

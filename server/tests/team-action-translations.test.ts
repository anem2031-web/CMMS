import { describe, it, expect, vi } from "vitest";
import { actionTranslationText, localizeActionSnapshot } from "../maintenance-team-tickets/action-translations";
import type { Snapshot } from "../../shared/maintenance-team-tickets/model";

const snapshot = (count = 1) => ({ actions: Array.from({ length: count }, (_, i) => ({ id: i + 1, kind: "fixed", note: "تم إصلاح المحرك" })) }) as Snapshot;
describe("team action localized read", () => {
  it("keeps protocol JSON out of translation and extracts material display text", () => {
    expect(actionTranslationText({ kind: "visit_ended", note: '{"version":1}' })).toBe("");
    expect(actionTranslationText({ kind: "fixed", note: " repaired " })).toBe("repaired");
    expect(actionTranslationText({ kind: "needs_material", note: JSON.stringify({ version: 1, type: "ticket_material_need", round: 1, originalName: "bolt", shortage: 1, message: "Need bolt" }) })).toBe("Need bolt");
  });
  it("preserves original and only uses completed/approved translations", async () => {
    const s = snapshot(3);
    const read = vi.fn().mockResolvedValue({ 1: { note: { text: "Repaired", status: "completed" } }, 2: { note: { text: "Pending", status: "pending" } }, 3: { note: { text: "Approved", status: "approved" } } });
    const result = await localizeActionSnapshot(s, "en", read);
    expect(result.actions.map(a => a.translatedNote)).toEqual(["Repaired", undefined, "Approved"]);
    expect(s.actions[0].translatedNote).toBeUndefined();
    expect(result.actions[0].note).toBe(s.actions[0].note);
  });
  it("bounds reads by 500 distinct authorized IDs, without cross-request reuse", async () => {
    const read = vi.fn().mockResolvedValue({});
    const s = snapshot(1001); s.actions.push(s.actions[0]);
    await localizeActionSnapshot(s, "en", read);
    expect(read.mock.calls.map(c => c[1].length)).toEqual([500, 500, 1]);
    await localizeActionSnapshot(snapshot(), "ur", read);
    expect(read.mock.calls[3][1]).toEqual([1]);
    expect(read.mock.calls[3][2]).toBe("ur");
  });
  it("skips absent language and empty snapshots; propagates read failures", async () => {
    const read = vi.fn().mockRejectedValue(new Error("offline"));
    await localizeActionSnapshot(snapshot(), undefined, read);
    await localizeActionSnapshot(snapshot(0), "en", read);
    expect(read).not.toHaveBeenCalled();
    await expect(localizeActionSnapshot(snapshot(), "en", read)).rejects.toThrow("offline");
  });
});

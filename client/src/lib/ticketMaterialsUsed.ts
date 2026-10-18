/** Format the existing team-material snapshot without changing stored values. */
export function formatTicketMaterialsUsed(
  original: string | null | undefined,
  translated?: string | null,
  unspecifiedQuantity = "—",
): string {
  if (!original?.trim()) return "";

  try {
    const materials: unknown = JSON.parse(original);
    if (Array.isArray(materials) && materials.length === 0) return "";
    if (
      Array.isArray(materials) && materials.length > 0 &&
      materials.every((material) => material && typeof material === "object" &&
        typeof material.name === "string" && material.name.trim().length > 0)
    ) {
      // Names, units and quantities come from the original snapshot. A prose
      // translation of JSON must never replace or recalculate the usage values.
      return materials.map((material) => {
        const used = material.used;
        const unit = typeof material.unit === "string" ? material.unit.trim() : "";
        const quantity = typeof used === "number" && Number.isFinite(used) && used >= 0
          ? `${used}${unit ? ` ${unit}` : ""}`
          : unspecifiedQuantity;
        return `${material.name.trim()} — ${quantity}`;
      }).join("\n");
    }
  } catch {
    // Legacy tickets hold free text rather than a structured materials list.
  }

  return translated?.trim() ? translated : original;
}

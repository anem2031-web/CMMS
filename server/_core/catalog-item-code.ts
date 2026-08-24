export interface ExistingCatalogItemCode {
  id: number;
  code?: string | null;
}

/**
 * Generates the next Catalog Item code for one leaf category.
 *
 * Rules approved in 2B-6:
 * - The category code is the item-code prefix.
 * - If the leaf has no valid item codes, start with <nodeCode>0001.
 * - If the leaf already has item codes, preserve the suffix width used by
 *   the most recently-created valid item in that leaf, then increment the
 *   highest numeric suffix that uses that same width.
 *
 * Examples for nodeCode="111":
 * - [] => 1110001
 * - 1110001,1110002,1110003 => 1110004
 * - 111001,111002,111003 => 111004
 */
export function nextCatalogItemCode(
  nodeCodeInput: string | null | undefined,
  existingItems: ExistingCatalogItemCode[],
): string {
  const nodeCode = String(nodeCodeInput || "").trim();
  if (!nodeCode) {
    throw new Error("لا يمكن توليد كود الصنف لأن التصنيف لا يحتوي على كود");
  }

  const valid = existingItems
    .map((item) => {
      const code = String(item.code || "").trim();
      if (!code.startsWith(nodeCode)) return null;
      const suffix = code.slice(nodeCode.length);
      if (!/^\d+$/.test(suffix)) return null;
      return {
        id: Number(item.id || 0),
        suffix,
        width: suffix.length,
        sequence: BigInt(suffix),
      };
    })
    .filter((row): row is NonNullable<typeof row> => !!row);

  if (valid.length === 0) {
    return `${nodeCode}0001`;
  }

  // Preserve the format currently in use for this leaf. If historical data
  // contains mixed suffix widths, the latest valid item determines the active
  // width, while the highest sequence within that width determines next value.
  const latest = valid.reduce((current, row) => row.id > current.id ? row : current);
  const activeWidth = latest.width;
  let maxSequence = 0n;
  for (const row of valid) {
    if (row.width === activeWidth && row.sequence > maxSequence) {
      maxSequence = row.sequence;
    }
  }

  const nextSequence = (maxSequence + 1n).toString();
  return `${nodeCode}${nextSequence.padStart(activeWidth, "0")}`;
}

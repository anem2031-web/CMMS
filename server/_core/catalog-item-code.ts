export interface ExistingCatalogItemCode {
  id: number;
  code?: string | null;
}

const DEFAULT_ITEM_SEQUENCE_WIDTH = 3;

function parseSequenceForNode(codeInput: string | null | undefined, nodeCode: string): { sequence: bigint; width: number } | null {
  const code = String(codeInput || "").trim();
  if (!code || !nodeCode) return null;

  // Current approved format: <nodeCode>-<sequence>, e.g. 11-001.
  const hyphenPrefix = `${nodeCode}-`;
  if (code.startsWith(hyphenPrefix)) {
    const suffix = code.slice(hyphenPrefix.length);
    if (!/^\d+$/.test(suffix)) return null;
    return { sequence: BigInt(suffix), width: suffix.length };
  }

  // Historical format without a hyphen remains readable for sequence allocation.
  // Existing codes are never rewritten; this only prevents the new allocator from
  // restarting at 001 when a leaf already has legacy codes such as 11001.
  if (code.startsWith(nodeCode)) {
    const suffix = code.slice(nodeCode.length);
    if (!/^\d+$/.test(suffix)) return null;
    return { sequence: BigInt(suffix), width: suffix.length };
  }

  return null;
}

/**
 * Returns true when a newly-entered Catalog Item code follows the approved
 * human-readable format for the selected category: <nodeCode>-<digits>.
 *
 * Historical codes without a hyphen remain valid only when they are left
 * unchanged on an existing item; this helper is for new/changed codes.
 */
export function isCatalogItemCodeForNode(
  codeInput: string | null | undefined,
  nodeCodeInput: string | null | undefined,
): boolean {
  const code = String(codeInput || "").trim();
  const nodeCode = String(nodeCodeInput || "").trim();
  if (!code || !nodeCode || !/^\d+$/.test(nodeCode)) return false;
  return code.startsWith(`${nodeCode}-`) && /^\d+$/.test(code.slice(nodeCode.length + 1));
}

/**
 * Generates the next Catalog Item code for one category.
 *
 * Current approved policy (2026-08-25):
 * - New codes use a hyphen between category code and item sequence.
 * - Example: category 11 => 11-001, 11-002, ...
 * - Existing historical codes are NOT renumbered.
 * - Both historical no-hyphen codes (11001) and current hyphenated codes
 *   (11-001 / 11-0001) are read when finding the next sequence.
 * - If the category already has a recognized sequence width, preserve the
 *   latest recognized width to avoid unnecessary formatting churn.
 * - A category with no recognized existing item code starts with a 3-digit
 *   sequence (001), as approved by the owner.
 */
export function nextCatalogItemCode(
  nodeCodeInput: string | null | undefined,
  existingItems: ExistingCatalogItemCode[],
): string {
  const nodeCode = String(nodeCodeInput || "").trim();
  if (!nodeCode) {
    throw new Error("لا يمكن توليد كود الصنف لأن التصنيف لا يحتوي على كود");
  }
  if (!/^\d+$/.test(nodeCode)) {
    throw new Error("كود التصنيف يجب أن يحتوي على أرقام فقط لتوليد كود الصنف");
  }

  const valid = existingItems
    .map((item) => {
      const parsed = parseSequenceForNode(item.code, nodeCode);
      if (!parsed) return null;
      return {
        id: Number(item.id || 0),
        ...parsed,
      };
    })
    .filter((row): row is NonNullable<typeof row> => !!row);

  if (valid.length === 0) {
    return `${nodeCode}-${"1".padStart(DEFAULT_ITEM_SEQUENCE_WIDTH, "0")}`;
  }

  // Keep the most recently used recognized suffix width for visual consistency,
  // while using the highest numeric sequence across both historical and current
  // formats so the allocator never restarts the semantic sequence.
  const latest = valid.reduce((current, row) => row.id > current.id ? row : current);
  const activeWidth = Math.max(DEFAULT_ITEM_SEQUENCE_WIDTH, latest.width);
  let maxSequence = 0n;
  for (const row of valid) {
    if (row.sequence > maxSequence) maxSequence = row.sequence;
  }

  const nextSequence = (maxSequence + 1n).toString();
  return `${nodeCode}-${nextSequence.padStart(activeWidth, "0")}`;
}

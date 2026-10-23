const HIERARCHY_CODE_PATTERN = /^\d+(?:-\d+)*$/;

export function isReadableCatalogNodeCode(value: string | null | undefined): boolean {
  const code = String(value || "").trim();
  if (!HIERARCHY_CODE_PATTERN.test(code)) return false;
  return code.split("-").every(segment => {
    try {
      return BigInt(segment) > 0n;
    } catch {
      return false;
    }
  });
}

export function formatCatalogCodeSegment(value: bigint | number | string): string {
  const numeric = BigInt(String(value));
  if (numeric < 1n) throw new Error("رقم مقطع التصنيف يجب أن يبدأ من 01");
  return numeric.toString().padStart(2, "0");
}

export function isHierarchicalCatalogNodeCode(value: string | null | undefined): boolean {
  const code = String(value || "").trim();
  if (!HIERARCHY_CODE_PATTERN.test(code)) return false;
  return code.split("-").every(segment => {
    if (segment.length < 2) return false;
    try {
      return BigInt(segment) > 0n && formatCatalogCodeSegment(BigInt(segment)) === segment;
    } catch {
      return false;
    }
  });
}

export function catalogChildSegment(
  childCodeInput: string | null | undefined,
  parentCodeInput: string | null | undefined,
): string | null {
  const childCode = String(childCodeInput || "").trim();
  const parentCode = String(parentCodeInput || "").trim();
  if (!childCode || !parentCode) return null;

  const hierarchicalPrefix = `${parentCode}-`;
  if (childCode.startsWith(hierarchicalPrefix)) {
    const segment = childCode.slice(hierarchicalPrefix.length);
    return /^\d+$/.test(segment) && !segment.includes("-") ? segment : null;
  }

  // Compatibility for the current compact tree (1 -> 11 -> 111). New codes
  // always use an explicit hyphen boundary.
  if (/^\d+$/.test(childCode) && /^\d+$/.test(parentCode) && childCode.startsWith(parentCode)) {
    const suffix = childCode.slice(parentCode.length);
    return /^\d+$/.test(suffix) && suffix.length > 0 ? suffix : null;
  }
  return null;
}

export function nextCatalogRootCode(
  rootCodes: Iterable<string | null | undefined>,
  reservedCodes: Set<string>,
): string {
  const occupiedRootNumbers = new Set<bigint>();
  for (const raw of rootCodes) {
    const code = String(raw || "").trim();
    if (!/^\d+$/.test(code)) continue;
    const value = BigInt(code);
    if (value > 0n) occupiedRootNumbers.add(value);
  }

  // Choose the lowest available root instead of following the largest value.
  // This prevents temporary/UAT roots such as 9901 from forcing every later
  // category into the same high range. Legacy root `1` occupies new root `01`.
  let value = 1n;
  let candidate = formatCatalogCodeSegment(value);
  while (occupiedRootNumbers.has(value) || reservedCodes.has(candidate)) {
    value += 1n;
    candidate = formatCatalogCodeSegment(value);
  }
  return candidate;
}

export function nextCatalogChildCode(
  parentCodeInput: string | null | undefined,
  siblingCodes: Iterable<string | null | undefined>,
  reservedCodes: Set<string>,
): string {
  const parentCode = String(parentCodeInput || "").trim();
  if (!parentCode || (!isHierarchicalCatalogNodeCode(parentCode) && !/^\d+$/.test(parentCode))) {
    throw new Error("التصنيف الأب لا يحتوي على كود صالح");
  }

  let max = 0n;
  for (const raw of siblingCodes) {
    const segment = catalogChildSegment(raw, parentCode);
    if (!segment) continue;
    const value = BigInt(segment);
    if (value > max) max = value;
  }

  let value = max + 1n;
  let candidate = `${parentCode}-${formatCatalogCodeSegment(value)}`;
  while (reservedCodes.has(candidate)) {
    value += 1n;
    candidate = `${parentCode}-${formatCatalogCodeSegment(value)}`;
  }
  return candidate;
}

export function isCatalogNodeCodeForParent(
  codeInput: string | null | undefined,
  parentCodeInput: string | null | undefined,
): boolean {
  const code = String(codeInput || "").trim();
  const parentCode = String(parentCodeInput || "").trim();
  if (!isReadableCatalogNodeCode(code) || !isReadableCatalogNodeCode(parentCode)) return false;
  if (!code.startsWith(`${parentCode}-`)) return false;
  if (code.split("-").length !== parentCode.split("-").length + 1) return false;

  const childSegment = code.slice(parentCode.length + 1);
  return childSegment.length >= 2 && formatCatalogCodeSegment(BigInt(childSegment)) === childSegment;
}

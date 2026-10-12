export type PurchaseOrderValidationPath = Array<string | number>;

export type PurchaseOrderValidationIssue = {
  path: PurchaseOrderValidationPath;
  code?: string;
  message?: string;
};

function asIssues(value: unknown): PurchaseOrderValidationIssue[] {
  const source = Array.isArray(value)
    ? value
    : value && typeof value === "object" && Array.isArray((value as any).issues)
      ? (value as any).issues
      : [];

  return source
    .filter((issue: any) => issue && typeof issue === "object" && Array.isArray(issue.path))
    .map((issue: any) => ({
      path: issue.path as PurchaseOrderValidationPath,
      code: typeof issue.code === "string" ? issue.code : undefined,
      message: typeof issue.message === "string" ? issue.message : undefined,
    }));
}

/**
 * tRPC/Zod can expose validation failures as a JSON array in error.message.
 * Keep parsing intentionally narrow: only objects that contain a Zod-style path
 * are treated as structured validation errors.
 */
export function parsePurchaseOrderValidationIssues(message: unknown): PurchaseOrderValidationIssue[] {
  const text = message == null ? "" : String(message).trim();
  if (!text) return [];

  const candidates = [text];
  const firstArray = text.indexOf("[");
  const lastArray = text.lastIndexOf("]");
  if (firstArray >= 0 && lastArray > firstArray) {
    candidates.push(text.slice(firstArray, lastArray + 1));
  }
  const firstObject = text.indexOf("{");
  const lastObject = text.lastIndexOf("}");
  if (firstObject >= 0 && lastObject > firstObject) {
    candidates.push(text.slice(firstObject, lastObject + 1));
  }

  for (const candidate of candidates) {
    try {
      const issues = asIssues(JSON.parse(candidate));
      if (issues.length > 0) return issues;
    } catch {
      // Continue to the next candidate. A normal API message is not JSON.
    }
  }
  return [];
}

export function looksLikeRawValidationError(message: unknown): boolean {
  const text = message == null ? "" : String(message);
  if (!text) return false;
  return (
    /Zod(?:Error|Issue)/i.test(text) ||
    (/"path"\s*:/i.test(text) && /"code"\s*:/i.test(text)) ||
    (/expected\s+(?:string|number|array|object)/i.test(text) && /(?:too_small|invalid_type|invalid_value)/i.test(text))
  );
}

export function isValidPurchaseRequiredDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

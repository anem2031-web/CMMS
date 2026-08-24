export type SupplierMatchReason =
  | "tax_exact"
  | "alias_exact"
  | "name_exact"
  | "name_contains"
  | "name_tokens"
  | "weak";

export interface SupplierMatchSource {
  id: number;
  nameAr: string;
  nameEn?: string | null;
  taxNumber?: string | null;
  commercialRegistration?: string | null;
  aliases?: string[];
}

export interface SupplierMatchResult extends SupplierMatchSource {
  score: number;
  reason: SupplierMatchReason;
  matchedText?: string;
}

const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

export function normalizeSupplierIdentifier(value?: string | null): string {
  return (value || "")
    .replace(/[٠-٩]/g, d => String(ARABIC_DIGITS.indexOf(d)))
    .replace(/[۰-۹]/g, d => String(PERSIAN_DIGITS.indexOf(d)))
    .replace(/[^0-9a-zA-Z]/g, "")
    .toLowerCase();
}

const LEGAL_WORDS = new Set([
  "شركة", "شركه", "مؤسسة", "موسسة", "مؤسسه", "للتجارة", "للتجاره", "التجارية", "التجاريه",
  "للمستلزمات", "للتوريدات", "للمقاولات", "company", "co", "ltd", "llc", "est", "establishment",
  "trading", "supplies", "supply",
]);

export function normalizeSupplierName(value?: string | null): string {
  return (value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[ؤئ]/g, "ء")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const NORMALIZED_LEGAL_WORDS = new Set(Array.from(LEGAL_WORDS).map(normalizeSupplierName));

function significantTokens(value: string): string[] {
  return normalizeSupplierName(value)
    .split(" ")
    .filter(Boolean)
    .filter(token => token.length > 1 && !NORMALIZED_LEGAL_WORDS.has(token));
}

function tokenScore(a: string, b: string): number {
  const aa = new Set(significantTokens(a));
  const bb = new Set(significantTokens(b));
  if (aa.size === 0 || bb.size === 0) return 0;

  let intersection = 0;
  aa.forEach(token => { if (bb.has(token)) intersection += 1; });
  if (intersection === 0) return 0;

  // Sørensen-Dice on meaningful words. It favors a short query like "الأمير"
  // matching "شركة الأمير للمستلزمات" without treating legal words as noise.
  return (2 * intersection) / (aa.size + bb.size);
}

function scoreName(query: string, candidate: string): { score: number; reason: SupplierMatchReason } {
  const q = normalizeSupplierName(query);
  const c = normalizeSupplierName(candidate);
  if (!q || !c) return { score: 0, reason: "weak" };
  if (q === c) return { score: 97, reason: "name_exact" };

  const qMeaningful = significantTokens(query).join(" ");
  const cMeaningful = significantTokens(candidate).join(" ");
  if (qMeaningful && cMeaningful && qMeaningful === cMeaningful) {
    return { score: 95, reason: "name_exact" };
  }

  if (c.includes(q) || q.includes(c) || (qMeaningful && cMeaningful && (cMeaningful.includes(qMeaningful) || qMeaningful.includes(cMeaningful)))) {
    return { score: 90, reason: "name_contains" };
  }

  const dice = tokenScore(query, candidate);
  if (dice > 0) return { score: Math.round(55 + dice * 35), reason: "name_tokens" };
  return { score: 0, reason: "weak" };
}

export function matchSuppliers(
  suppliers: SupplierMatchSource[],
  query?: string | null,
  taxNumber?: string | null,
  limit = 5,
): SupplierMatchResult[] {
  const normalizedTax = normalizeSupplierIdentifier(taxNumber);
  const normalizedQuery = normalizeSupplierName(query);

  const results: SupplierMatchResult[] = [];

  for (const supplier of suppliers) {
    let score = 0;
    let reason: SupplierMatchReason = "weak";
    let matchedText: string | undefined;

    if (normalizedTax && normalizeSupplierIdentifier(supplier.taxNumber) === normalizedTax) {
      score = 100;
      reason = "tax_exact";
      matchedText = supplier.taxNumber || undefined;
    }

    if (normalizedQuery) {
      for (const alias of supplier.aliases || []) {
        if (normalizeSupplierName(alias) === normalizedQuery && score < 99) {
          score = 99;
          reason = "alias_exact";
          matchedText = alias;
        }
      }

      for (const candidateName of [supplier.nameAr, supplier.nameEn || ""]) {
        const scored = scoreName(query || "", candidateName);
        if (scored.score > score) {
          score = scored.score;
          reason = scored.reason;
          matchedText = candidateName;
        }
      }
    }

    if (score > 0) {
      results.push({ ...supplier, score, reason, matchedText });
    }
  }

  return results
    .sort((a, b) => b.score - a.score || a.nameAr.localeCompare(b.nameAr, "ar"))
    .slice(0, Math.max(1, limit));
}

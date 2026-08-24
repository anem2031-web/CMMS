import { normalizeCatalogItemText } from "./catalog-item-matching";

export interface CatalogDuplicateCheckItem {
  id: number;
  code?: string | null;
  nameAr: string;
  nameEn?: string | null;
}

export interface CandidateReviewNames {
  nameAr?: string | null;
  nameEn?: string | null;
  code?: string | null;
}

export function findExactCatalogDuplicate(
  candidate: CandidateReviewNames,
  items: CatalogDuplicateCheckItem[],
): CatalogDuplicateCheckItem | null {
  const ar = normalizeCatalogItemText(candidate.nameAr);
  const en = normalizeCatalogItemText(candidate.nameEn);
  const code = (candidate.code || "").trim().toLowerCase();

  for (const item of items) {
    const itemAr = normalizeCatalogItemText(item.nameAr);
    const itemEn = normalizeCatalogItemText(item.nameEn);
    const itemCode = (item.code || "").trim().toLowerCase();

    if (code && itemCode && code === itemCode) return item;
    if (ar && itemAr && ar === itemAr) return item;
    if (en && itemEn && en === itemEn) return item;
  }

  return null;
}

export function candidateReviewDisplayName(candidate: {
  itemName: string;
  itemNameAr?: string | null;
  itemNameEn?: string | null;
}): string {
  return (candidate.itemNameAr || candidate.itemName || candidate.itemNameEn || "").trim();
}

export interface PendingCandidateDuplicateInput {
  id: number;
  itemName: string;
  itemNameAr?: string | null;
  itemNameEn?: string | null;
  supplierItemCode?: string | null;
  catalogSupplierId?: number | null;
}

export function findExactPendingCandidateDuplicate(
  candidate: {
    nameAr?: string | null;
    nameEn?: string | null;
    code?: string | null;
    catalogSupplierId?: number | null;
  },
  candidates: PendingCandidateDuplicateInput[],
): PendingCandidateDuplicateInput | null {
  const ar = normalizeCatalogItemText(candidate.nameAr);
  const en = normalizeCatalogItemText(candidate.nameEn);
  const code = (candidate.code || "").trim().toUpperCase().replace(/[^\p{L}\p{N}]/gu, "");

  for (const item of candidates) {
    const names = [item.itemNameAr, item.itemName, item.itemNameEn]
      .map(value => normalizeCatalogItemText(value))
      .filter(Boolean);
    const sameName = (!!ar && names.includes(ar)) || (!!en && names.includes(en));
    if (sameName) return item;

    const itemCode = (item.supplierItemCode || "").trim().toUpperCase().replace(/[^\p{L}\p{N}]/gu, "");
    const sameSupplier = !!candidate.catalogSupplierId && candidate.catalogSupplierId === item.catalogSupplierId;
    if (sameSupplier && code && itemCode && code === itemCode) return item;
  }

  return null;
}



export interface CandidateDuplicateDecisionLike {
  candidateLowId: number;
  candidateHighId: number;
  decision: "same_item" | "not_same_item";
  primaryCandidateId?: number | null;
}

export function normalizeCandidatePair(a: number, b: number): { candidateLowId: number; candidateHighId: number } {
  if (!Number.isInteger(a) || !Number.isInteger(b) || a <= 0 || b <= 0 || a === b) {
    throw new Error("Candidate pair must contain two different positive integer IDs");
  }
  return a < b ? { candidateLowId: a, candidateHighId: b } : { candidateLowId: b, candidateHighId: a };
}

export function sameItemPrimaryForCandidate(candidateId: number, decisions: CandidateDuplicateDecisionLike[]): number | null {
  for (const decision of decisions) {
    if (decision.decision !== "same_item" || !decision.primaryCandidateId) continue;
    if (decision.candidateLowId === candidateId || decision.candidateHighId === candidateId) {
      if (decision.primaryCandidateId !== candidateId) return decision.primaryCandidateId;
    }
  }
  return null;
}

export function sameItemGroupIds(primaryCandidateId: number, decisions: CandidateDuplicateDecisionLike[]): number[] {
  const ids = new Set<number>([primaryCandidateId]);
  for (const decision of decisions) {
    if (decision.decision !== "same_item" || decision.primaryCandidateId !== primaryCandidateId) continue;
    ids.add(decision.candidateLowId);
    ids.add(decision.candidateHighId);
  }
  return [...ids];
}

export function decidedPeerIds(candidateId: number, decisions: CandidateDuplicateDecisionLike[]): number[] {
  const peers = new Set<number>();
  for (const decision of decisions) {
    if (decision.candidateLowId === candidateId) peers.add(decision.candidateHighId);
    else if (decision.candidateHighId === candidateId) peers.add(decision.candidateLowId);
  }
  return [...peers];
}

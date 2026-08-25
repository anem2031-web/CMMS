import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildAiResponseCacheKey } from "../_core/ai-response-cache";

const matchingSource = readFileSync(new URL("../_core/catalog-item-matching.ts", import.meta.url), "utf8");
const routerSource = readFileSync(new URL("../routers/catalog/catalog.router.ts", import.meta.url), "utf8");

describe("Catalog invoice AI zero-quality-loss optimization", () => {
  it("builds a stable cache key for the same logical input", () => {
    const a = buildAiResponseCacheKey({
      feature: "catalog_invoice_matching",
      operation: "semantic_rerank",
      cacheVersion: "v1",
      input: { item: { name: "Bearing 6204", unit: "pcs" }, ids: [1, 2, 3] },
    });
    const b = buildAiResponseCacheKey({
      operation: "semantic_rerank",
      feature: "catalog_invoice_matching",
      cacheVersion: "v1",
      input: { ids: [1, 2, 3], item: { unit: "pcs", name: "Bearing 6204" } },
    });

    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it("invalidates rerank cache when candidate content changes", () => {
    const common = {
      feature: "catalog_invoice_matching",
      operation: "semantic_rerank",
      cacheVersion: "v1",
    } as const;
    const original = buildAiResponseCacheKey({
      ...common,
      input: { candidates: [{ id: 10, nameAr: "رولمان بلي 6204", manufacturer: "SKF" }] },
    });
    const changed = buildAiResponseCacheKey({
      ...common,
      input: { candidates: [{ id: 10, nameAr: "رولمان بلي 6204", manufacturer: "NSK" }] },
    });

    expect(changed).not.toBe(original);
  });

  it("does not reduce the accepted AI shortlist or token ceilings", () => {
    expect(matchingSource).toContain("const HYBRID_SHORTLIST_SIZE = 100;");
    expect(matchingSource).toContain("const HYBRID_EXPANDED_SHORTLIST_SIZE = 120;");
    expect(matchingSource).toContain("const HYBRID_WIDE_FALLBACK_SIZE = 180;");
    expect(matchingSource).toContain("maxTokens: 350");
    expect(matchingSource).toContain("maxTokens: 900");
  });

  it("keeps the existing DeepSeek prompt contracts and adds cache/usage instrumentation around them", () => {
    expect(matchingSource).toContain("أنت مساعد استرجاع لكتالوج CMMS");
    expect(matchingSource).toContain("أنت محرك ترتيب دلالي لأصناف كتالوج CMMS");
    expect(matchingSource).toContain("withAiResponseCache");
    expect(routerSource).toContain('action: "ai_catalog_match_usage"');
    expect(routerSource).toContain("deterministicBypassCount");
    expect(routerSource).toContain("persistentCacheHits");
    expect(routerSource).toContain("inFlightDedupeHits");
  });
});

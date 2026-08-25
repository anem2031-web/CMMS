# CMMS — Catalog Invoice Matching AI — Zero Quality Loss Optimization

**Date:** 2026-08-25  
**Status:** IMPLEMENTED IN CODE / PERSISTENT CACHE REQUIRES LIVE DB TABLE  
**Scope:** Catalog invoice-item matching only (`catalog.itemSuppliers.matchInvoiceItems`)

## 1. Approved objective

Reduce unnecessary DeepSeek API calls and token consumption **without reducing matching quality**.

The accepted rule for this step is that the existing AI analysis contract stays unchanged:

- no reduction to the initial shortlist (`100`), expanded shortlist (`120`), or wide fallback (`180`);
- no change to the accepted DeepSeek prompts;
- no reduction to `maxTokens` (`350` for search-term expansion and `900` for semantic reranking);
- no batching of several invoice items into one new prompt;
- no change to measurement-conflict protection;
- no new AI auto-selection behavior.

## 2. What was implemented

### 2.1 Persistent exact-input AI response cache

A dedicated table, `ai_response_cache`, stores **parsed AI results only** for exact versioned inputs.

Two catalog-matching operations are cached:

1. search-term expansion;
2. semantic shortlist reranking.

The cache key is SHA-256 over:

- feature;
- operation;
- cache-contract version;
- exact logical input.

For semantic reranking, the logical input includes the full candidate shortlist fields used by the prompt (`catalogItemId`, code, Arabic name, English name, unit, manufacturer). Therefore changing the candidate content produces a different cache key automatically.

Default cache lifetime: **30 days**.

The cache never stores the DeepSeek API key and does not replace Catalog master data or supplier-item aliases.

### 2.2 In-process memory reuse + in-flight de-duplication

For identical requests on the same running server:

- a recently produced result can be reused from memory;
- if the exact same AI operation is already running, a second caller awaits the same Promise instead of sending another DeepSeek request.

This is an optimization around the existing AI call. It does not modify the AI result.

### 2.3 Existing confirmed supplier memory remains first

`catalog_supplier_item_aliases` already persists confirmed Supplier + SKU/name → Catalog Item relationships when receiving/confirming items.

`matchInvoiceItems` continues to load this supplier memory **before AI**. Existing exact supplier SKU/alias and other strong deterministic matches continue to bypass DeepSeek exactly as before.

No new automatic learning from an unconfirmed AI suggestion was introduced. User/operational confirmation remains the authority for supplier-item memory.

### 2.4 Persistent usage measurement in Catalog Audit

Each `matchInvoiceItems` request writes **one compact Catalog Audit entry**:

- `action = ai_catalog_match_usage`
- `entityType = catalog_ai_matching`
- `userId = current user`

The audit payload records:

- invoice lines submitted;
- deterministic bypass count;
- AI-eligible line count;
- lines skipped by the existing 5-line AI budget;
- actual DeepSeek call count;
- memory-cache hits;
- persistent-cache hits;
- in-flight de-duplication hits;
- prompt tokens;
- completion tokens;
- total tokens;
- provider prompt-cache hit/miss tokens when returned by the API;
- per-call operation/phase and duration.

Telemetry failure is **non-blocking**: matching still returns normally even if writing the audit entry fails.

### 2.5 Cache failure is non-blocking

If `ai_response_cache` does not exist yet, is unavailable, or a cache read/write fails:

- the system logs a warning;
- the existing DeepSeek matching flow continues;
- invoice matching is not blocked.

This allows safe deployment sequencing while respecting Live DB change control.

## 3. What was deliberately NOT changed

This optimization does **not**:

- reduce AI candidates;
- shorten prompts;
- reduce token ceilings;
- change DeepSeek model selection;
- change scoring thresholds;
- change confidence/measurement rules;
- auto-link AI-only suggestions;
- backfill historical invoices;
- re-run historical invoice matching;
- create historical supplier-item aliases;
- alter inventory, valuation, accounting, or receipt workflow.

## 4. Live DB requirement

Persistent cache activation requires the dedicated table:

`ai_response_cache`

The project contains the matching migration:

`drizzle/2026_08_25_ai_response_cache.sql`

Per project change-control rules, presence of the migration file does **not** mean the Live DB migration has been applied. Live DB remains the source of truth.

No historical data is inserted into this table. It starts empty and fills only from future matching requests.

## 5. Expected behavior after deployment

First occurrence of a genuinely ambiguous input:

`deterministic checks → existing DeepSeek analysis → cache parsed result`

Repeated exact input with the same candidate content:

`deterministic checks → cache hit → same stored AI result → 0 new DeepSeek tokens`

Simultaneous duplicate input while the first call is still running:

`second request waits for first request → 0 duplicate DeepSeek call`

Confirmed supplier SKU/name mapping:

`existing supplier memory → deterministic result → DeepSeek not called`

## 6. Validation / measurement

Use Catalog Audit entries with action `ai_catalog_match_usage` to compare:

- `deepSeekCallCount`
- `persistentCacheHits`
- `memoryCacheHits`
- `inFlightDedupeHits`
- `totalTokens`

before considering any second-stage optimization.

No second-stage change to shortlist size, prompts, token ceilings, or batching should be approved unless a benchmark demonstrates equal or better matching quality.

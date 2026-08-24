# CMMS — Deferred Centralized Document Numbering Service / Engine

**Decision date:** 2026-08-23  
**Status:** **DOCUMENTED / DEFERRED — DO NOT IMPLEMENT AUTOMATICALLY**

## Purpose

The system currently generates business document numbers through multiple existing mechanisms. Main Phase 5 / 5.3 reviewed Receipt numbering and deliberately **did not** create a one-off `receipt_number_counter`. The owner requested that numbering unification be documented for a later dedicated change.

The future goal is a **Centralized Document Numbering Service / Engine** that can govern document-number allocation consistently across the application without rewriting historical documents.

## Current state to preserve until the future project is approved

Known current families include, at minimum:

- `RCV-...` — Warehouse Receipt: existing `getNextReceiptNumber(tx?)` derives the next display number from current Receipt records.
- `DLV-...` — Delivery: existing AUTO_INCREMENT-backed delivery counter.
- `RTN-...` — Return: existing `getNextReturnNumber(tx?)` based on current Return records.
- `DO-...` — Disposal: existing AUTO_INCREMENT-backed disposal counter.
- `TRF-...` — Warehouse Transfer: existing AUTO_INCREMENT-backed transfer counter.
- `CNT-...` — Inventory Count: existing counter mechanism.
- `ADJ-...` — Settlement/Adjustment: existing counter mechanism.

Other numbered document families must be inventoried from the then-current project before implementation; this document is not permission to assume the list is exhaustive.

## Future design objectives

A later approved design should define a central API/service with explicit policies for:

- document type / prefix;
- calendar/fiscal year partitioning;
- sequence width/padding;
- uniqueness under concurrency;
- allocation inside the same business transaction where required;
- whether a rolled-back allocation may leave a number gap;
- environment/site/project/warehouse scoping, if any;
- idempotency/retry behavior;
- auditability of number allocation;
- migration/compatibility strategy for existing mechanisms.

## Recommended safety policy

Unless separately approved for a specific legal/accounting requirement, the centralized engine should prioritize **uniqueness, concurrency safety, and traceability** over gapless numbering. DB AUTO_INCREMENT or an equivalent atomic sequence can legitimately consume a sequence value on rollback. A gap is preferable to duplicate or reused business-document numbers.

## Historical-data policy

The future implementation must be future-facing by default:

- no renumbering existing documents;
- no historical backfill solely to normalize formats;
- no deletion/merge of old counter rows without explicit migration approval;
- existing document references must remain resolvable;
- old prefixes/formats remain valid historical identifiers.

## Required pre-implementation inventory

Before coding the centralized engine, inspect the **then-latest Full Project** and **Live DB** and produce a matrix for every numbered document type:

`Document type | current prefix/format | generator function | DB counter/table | transaction boundary | uniqueness evidence | consumers/references | proposed central policy`

Live DB is the source of truth for actual tables/columns/counters. Do not create or alter counter tables merely because a code Schema suggests they exist or should exist.

## Phase 5.3 decision recorded

During 5.3, Live DB inspection showed current-year RCV max sequence `420148`, `0` duplicate Receipt Number groups, and no `receipt_number_counter` table. The existing RCV generator was therefore retained, and centralization was deferred instead of introducing a partial RCV-only solution.

## Approval gate

This document is a deferred design checkpoint only. Implementing the centralized numbering engine, changing existing prefixes/formats, changing gap policy, or migrating existing counters requires a separate explicit owner approval.

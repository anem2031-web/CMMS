# Root Cause Analysis: Stale FK Submission (`siteId=300001`, `sectionId=90001`)

## Executive Summary
During the master-data cleanup, legacy IDs `300001` (site) and `90001` (section) were deleted from the database. However, these IDs continued to be submitted during Asset updates, causing Foreign Key (FK) constraint violations. The investigation confirmed that no hardcoded IDs existed in the codebase. The issue was purely a **frontend controlled-state lifecycle bug** in the Radix UI Select component synchronization within `Assets.tsx`.

## Technical Root Cause
The failure occurred when editing an existing asset that still held the legacy `siteId` and `sectionId` in its database record:

1. **State Initialization (`openEdit`)**: When a user clicked "Edit" on an affected asset, the `openEdit()` function directly populated the React form state (`form.siteId`, `form.sectionId`) with the asset's stored DB values (`300001`, `90001`).
2. **Visual Desync**: The form rendered Radix `<Select>` components bound to this state. Because `300001` no longer existed in the live `sites` array, the Select component could not find a matching `<SelectItem>`. Consequently, it visually rendered the `placeholder` (e.g., "None" or blank), creating the illusion that no site was selected.
3. **Stale Submission**: Despite the visual placeholder, the underlying React `form` state still retained the string `"300001"`. When the user submitted the form without explicitly changing the site dropdown, `handleSubmit()` evaluated `form.siteId ? Number(form.siteId) : undefined`, converting the stale string back to the invalid integer `300001` and sending it to the mutation.

## The Fix
A two-layer defensive fix was applied to `client/src/pages/Assets.tsx` (Commit: `2ada7e1`):

1. **Layer 1: Initialization Sanitization**
   Inside `openEdit()`, the stored `siteId` and `sectionId` are now cross-referenced against the live `sites` and `sections` lists retrieved from the backend. If a stored ID is not found in the live lists (i.e., it was deleted), it is immediately discarded and the form state is initialized to `""`. This ensures the stale ID never enters the form state.

2. **Layer 2: Pre-Submit Guard**
   Inside `handleSubmit()`, a final validation checks if the current `form.siteId` and `form.sectionId` exist in the live lists. If an invalid ID somehow survives to this point, the submission is blocked, the field is cleared, and an Arabic error toast (`الموقع المحدد لم يعد متاحاً...`) alerts the user to re-select a valid option.

## Verification Checklist
- [x] TypeScript build passes (`tsc --noEmit` exits 0).
- [x] Codebase verified clean of hardcoded `300001`/`90001` IDs.
- [x] Fix committed and pushed to `main`.
- [x] Railway deployment triggered and healthy.

*Diagnostic `console.log` statements were temporarily retained in the commit for live production tracing if needed, and should be stripped in the next routine cleanup phase.*

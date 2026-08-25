# CMMS — Catalog Item Code Hyphen Policy

**Date:** 2026-08-25  
**Status:** APPROVED / IMPLEMENTED  
**Scope:** Catalog Item code generation and validation only

## Approved policy

New Catalog Item codes use the category code followed by a hyphen and a numeric sequence:

```text
<category-code>-<sequence>
```

Examples:

```text
11-001
11-002
111-0006
```

The default sequence width for a category with no recognized historical item code is three digits (`001`). If an existing category already uses a recognized wider suffix, the generator preserves that active width while adding/keeping the hyphen.

## Historical-data rule

Existing Catalog Item codes are **not** renumbered or rewritten. Historical codes without a hyphen, such as `11001`, remain unchanged.

When allocating the next automatic code, the generator reads both:

- historical no-hyphen codes, e.g. `11001`;
- hyphenated codes, e.g. `11-001` or `11-0001`.

This prevents the sequence from restarting simply because the display format changed.

## Create behavior

- Automatic creation is server-authoritative.
- The backend locks the selected category while allocating the next code inside the create transaction.
- The automatic code uses the hyphenated format.
- A manually entered new code must use the selected category prefix plus a hyphen and numeric suffix.
- Duplicate item codes are rejected.

## Update behavior

- An unchanged historical code is allowed when editing other item fields.
- If the user changes the item code, the new value must follow the approved hyphenated format for that item's category.
- No historical renumbering is performed automatically.

## Candidate approval behavior

Catalog Item creation from the Candidate Review flow uses the same shared server generator, so its automatic code follows the same hyphenated policy.

## Database impact

No Schema change, Migration, SQL command, Live DB data rewrite, or historical renumbering is required for this change.

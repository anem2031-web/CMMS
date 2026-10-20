# CMMSFINAL development rules

Read `CLAUDE.md` and `docs/PENDING_TASKS.md` before changing this project. Preserve
the existing role permissions and workflow unless the user explicitly changes them.
Work only in this checkout. Never connect to or change a database without the
user's specific authorization; supply any required SQL for manual execution.

## Authorization and list performance

These requirements apply to every new role, permission, API and list endpoint:

1. Use the central capability guard and the existing record/assignment/workflow
   guard. Hidden buttons or sidebar entries are not authorization. A new RPC must
   have an explicit reviewed role grant where a role allowlist applies.
2. For a read list, gather distinct parent IDs first and batch-load the required
   scope. Use `readScopeChunks` / `groupReadRows`,
   `createPurchaseOrderReadGuard`, `loadDocumentListPort`, and
   `loadTicketReadScope` as appropriate. Keep each record's permission decision
   independent. Load **all** submission members when checking an aggregate PDF,
   including members hidden from the displayed list.
3. Do not call a single-record database reader/authorization loader from a list
   loop. `Promise.all` alone does not remove N+1 queries. Bound large ID lists
   (currently 500 IDs per chunk). Preserve missing-parent denials and propagate
   infrastructure failures rather than treating them as ordinary denials.
4. Scope any memoization to the current RPC and authenticated actor. Never cache
   authorization/approval decisions globally or reuse a read snapshot for a
   subsequent write or download. Recheck current identity, active status, resource
   scope and workflow stage at the actual operation boundary.
5. Preserve response shape, ordering, creator/assignee scope, exact approval actor,
   and existing UI behavior. Do not redesign financial or stock writers while
   optimizing a read. Database filtering/pagination must precede large-list
   enrichment when introducing a new paginated endpoint.
6. Before completing a permission/read-scope change, run isolated regression tests
   proving allow/deny parity for affected and unaffected roles, mixed own/foreign
   IDs, missing parents, direct API calls, and independent consecutive requests.
   Add a query-count test with repeated parent IDs and a large list; query count
   should grow by bounded chunks, not by displayed rows. Verify writes/downloads
   still perform fresh checks. Run `node tools/read-scope-perf/run.mjs` for the
   shared read-scope regression suite; it must never load a live DB/environment.

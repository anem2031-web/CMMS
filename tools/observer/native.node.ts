import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { transformSync } from "esbuild";
import { z } from "zod";
import {
  router,
  publicProcedure,
  protectedProcedure,
  adminProcedure,
} from "../../server/_core/trpc";
import {
  observerRpcAllowed,
  redactObserverValue,
  isObserver,
} from "../../shared/observer-policy";
import { OBSERVER_NATIVE_READ_PATHS } from "../../shared/observer-native-reads";
import { observerViewUser } from "../../shared/observer-view";
import {
  runObserverRead,
  isObserverReadScope,
  observerReadActorRole,
  guardObserverSqlClient,
  assertObserverSqlRead,
} from "../../server/_core/authz/observer-read-scope";
import { assertObserverRpc } from "../../server/_core/authz/observer-guard";
import { APP_ROLE, canRoleAccessPath } from "../../shared/roles";
import { resolveResponse } from "@trpc/server/http";
import { MySql2Session } from "drizzle-orm/mysql2/session";
import { sql } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { pmv2ExecutionTeamCondition } from "../../server/pmv2/security/execution-access";
import { canManageTicketTeams } from "../../shared/maintenance-team-tickets/team-management";
import { canReadTicketTeamExecution } from "../../shared/maintenance-team-tickets/execution-permissions";
const user = {
  id: 99,
  role: "observer",
  isActive: 1,
  name: "المراقب",
  passwordHash: "secret",
};
const context = (u: any = user) =>
  ({
    user: u,
    req: { body: { role: "owner" }, headers: { "x-role": "admin" } },
    res: { clearCookie() {} },
  }) as any;

test("native admin-visible reads pass original query guards with the original actor retained", async () => {
  let received: any;
  const api = router({
    users: router({
      list: adminProcedure.query(({ ctx }) => {
        received = ctx;
        return [{ id: 9, name: "existing", passwordHash: "hidden" }];
      }),
    }),
    auth: router({ me: publicProcedure.query(({ ctx }) => ctx.user) }),
  });
  const ctx = context(),
    caller = api.createCaller(ctx);
  assert.deepEqual(await caller.users.list(), [{ id: 9, name: "existing" }]);
  assert.equal(received.user.role, "admin");
  assert.equal(received.user.id, 99);
  assert.equal(received.authenticatedUser, user);
  assert.equal(ctx.user.role, "observer");
  const me = await caller.auth.me();
  assert.equal(me.role, "observer");
  assert.equal((me as any).passwordHash, undefined);
});
test("all native queries are explicitly registered; exports and unknown reads are denied", () => {
  const catalog = JSON.parse(
    fs.readFileSync(
      "tools/observer/artifacts/correction/procedures.json",
      "utf8"
    )
  );
  assert.ok(OBSERVER_NATIVE_READ_PATHS.length > 280);
  for (const path of OBSERVER_NATIVE_READ_PATHS)
    assert.ok(
      catalog.some((p: any) => p.path === path && p.type === "query"),
      path
    );
  for (const p of catalog) {
    if (p.type === "query" && p.path !== "warehouseReceipts.getForPrint")
      assert.equal(
        observerRpcAllowed("observer", p.type, p.path),
        true,
        p.path
      );
    else if (
      p.type === "mutation" &&
      !["auth.logout", "nfc.scanTag"].includes(p.path)
    )
      assert.equal(
        observerRpcAllowed("observer", p.type, p.path),
        false,
        p.path
      );
  }
  for (const path of [
    "future.newRead",
    "observer.readPage",
    "warehouseReceipts.getForPrint",
    "catalog.importExport.exportExcel",
    "users.delete",
  ])
    assert.equal(observerRpcAllowed("observer", "query", path), false);
});
test("mutations/exports/subscriptions cannot run through any base procedure or forged role", async () => {
  let writes = 0;
  const api = router({
    auth: router({ logout: publicProcedure.mutation(() => true) }),
    pub: publicProcedure.input(z.any()).mutation(() => ++writes),
    prot: protectedProcedure.mutation(() => ++writes),
    adm: adminProcedure.mutation(() => ++writes),
    users: router({ list: adminProcedure.mutation(() => ++writes) }),
  });
  const caller = api.createCaller(context());
  await assert.rejects(caller.pub({ role: "admin", userId: 1 }));
  await assert.rejects(caller.prot());
  await assert.rejects(caller.adm());
  await assert.rejects(caller.users.list());
  assert.equal(writes, 0);
  assert.equal(await caller.auth.logout(), true);
  assert.throws(() => assertObserverRpc(user, "subscription", "users.list"));
  assert.throws(() =>
    assertObserverRpc({ ...user, isActive: 0 }, "query", "users.list")
  );
});
test("an inner caller retains the authenticated observer and cannot elevate a write", async () => {
  let writes = 0;
  let api: any;
  api = router({
    write: protectedProcedure.mutation(() => ++writes),
    users: router({
      list: adminProcedure.query(async ({ ctx }) => {
        await assert.rejects(api.createCaller(ctx).write());
        return [ctx.authenticatedUser?.role];
      }),
    }),
  });
  assert.deepEqual(await api.createCaller(context()).users.list(), [
    "observer",
  ]);
  assert.equal(writes, 0);
});
test("observer SQL boundary stops raw and generated DML before the driver; permits read transactions", async () => {
  const calls: any[] = [];
  const raw = {
    query: (q: any, ...a: any[]) => {
      calls.push(q);
      return Promise.resolve([[], []]);
    },
    execute: (q: any) => {
      calls.push(q);
      return Promise.resolve([[], []]);
    },
    getConnection: async () => raw,
    release() {},
  };
  const guarded = guardObserverSqlClient(raw);
  await runObserverRead(99, async () => {
    await guarded.query({ sql: "SELECT id FROM users WHERE id=?" }, [99]);
    for (const q of [
      "begin",
      "SELECT COUNT(*) FROM tickets",
      "commit",
      "savepoint sp1",
      "release savepoint sp1",
      "rollback",
    ])
      await guarded.execute(q);
    for (const q of [
      "INSERT INTO users(id) VALUES(1)",
      "UPDATE tickets SET status=?",
      "DELETE FROM users",
      "SELECT id FROM users FOR UPDATE",
      'SELECT 1 INTO OUTFILE "/tmp/leak"',
      'SELECT 1; UPDATE users SET role="admin"',
      "CALL write_it()",
      "WITH a AS (SELECT 1) DELETE FROM users",
      'SELECT GET_LOCK("a",1)',
      "/*! SELECT 1 */",
      "SET @id=1",
    ])
      assert.throws(() => guarded.query(q), q);
    const connection = await guarded.getConnection();
    assert.throws(() => connection.execute("DROP TABLE users"));
  });
  assert.equal(calls.length, 7);
  await guarded.execute("UPDATE users SET name=?");
  assert.equal(calls.length, 8);
  assert.equal(isObserverReadScope(), false);
});
test("an allowed query cannot write and fails before the write reaches SQL", async () => {
  let writeCalls = 0;
  const client = guardObserverSqlClient({ execute: async () => ++writeCalls });
  const api = router({
    users: router({
      list: protectedProcedure.query(() =>
        client.execute('UPDATE users SET role="admin"')
      ),
    }),
  });
  await assert.rejects(api.createCaller(context()).users.list());
  assert.equal(writeCalls, 0);
});
test("actual Drizzle read transactions use the guarded connection and cannot execute DML", async () => {
  const calls: string[] = [];
  let releases = 0;
  const connection = {
    query: async (q: any) => {
      calls.push(q.sql ?? q);
      return [[], []];
    },
    release: () => releases++,
  };
  const pool = {
    getConnection: async () => connection,
    query: connection.query,
  };
  const session = new MySql2Session(
    guardObserverSqlClient(pool) as any,
    new MySqlDialect(),
    undefined,
    { mode: "default" }
  );
  await runObserverRead(99, () =>
    session.transaction(async tx => {
      await tx.execute(sql`SELECT id FROM users`);
    })
  );
  assert.deepEqual(calls, ["begin", "SELECT id FROM users", "commit"]);
  assert.equal(releases, 1);
  await assert.rejects(
    runObserverRead(99, () =>
      session.transaction(async tx => {
        await tx.execute(sql`UPDATE users SET name='invalid'`);
      })
    )
  );
  assert.equal(releases, 2);
  assert.ok(!calls.some(q => q.startsWith("UPDATE")));
  assert.equal(calls.at(-1), "rollback");
});
test("concurrent observer/normal requests do not share scope or change another role", async () => {
  let unblock!: () => void;
  const hold = new Promise<void>(r => (unblock = r));
  const read = runObserverRead(99, async () => {
    await hold;
    assert.equal(observerReadActorRole(99, "observer"), "admin");
    assert.throws(() => assertObserverSqlRead("DELETE FROM tickets"));
  });
  assert.equal(isObserverReadScope(), false);
  assert.equal(observerReadActorRole(99, "observer"), "observer");
  assertObserverSqlRead("DELETE FROM tickets");
  unblock();
  await read;
});
test("every original role keeps its query/mutation result, identity and administrator-only behavior", async () => {
  const api = router({
    query: protectedProcedure.query(({ ctx }) => ctx.user),
    write: protectedProcedure.mutation(({ ctx }) => ctx.user.role),
    adm: adminProcedure.query(() => true),
  });
  for (const role of Object.values(APP_ROLE).filter(r => r !== "observer")) {
    const u = { ...user, role };
    const caller = api.createCaller(context(u));
    assert.equal(await caller.query(), u);
    assert.equal(await caller.write(), role);
    if (role === "admin") assert.equal(await caller.adm(), true);
    else await assert.rejects(caller.adm());
    assert.equal(observerViewUser(u), u);
    assert.equal(observerReadActorRole(u.id, role), role);
  }
  const presented = observerViewUser(user)!;
  assert.equal(presented.role, "admin");
  assert.equal(presented.id, 99);
  assert.equal(user.role, "observer");
  assert.equal(observerViewUser(null), null);
});
test("read projection only changes PMV2 SQL visibility inside its authenticated read scope", () => {
  const dialect = new MySqlDialect();
  const before = dialect.sqlToQuery(pmv2ExecutionTeamCondition(99, 7)!);
  assert.ok(!before.params.includes("observer"));
  const read = runObserverRead(99, () =>
    dialect.sqlToQuery(pmv2ExecutionTeamCondition(99, 7)!)
  );
  assert.ok(read.params.includes("observer"));
  assert.deepEqual(
    dialect.sqlToQuery(pmv2ExecutionTeamCondition(99, 7)!),
    before
  );
  assert.equal(
    runObserverRead(99, () => observerReadActorRole(88, "observer")),
    "observer"
  );
});
test("JSON fields retain their original type; credentials and backup export URLs are redacted", () => {
  const data: any = redactObserverValue(
    {
      note: '{"name":"visible","passwordHash":"hidden"}',
      trackingToken: "business-lot-tag",
      fileUrl: "private",
      secret: "hidden",
    },
    0,
    true
  );
  assert.equal(typeof data.note, "string");
  assert.deepEqual(JSON.parse(data.note), { name: "visible" });
  assert.equal(data.trackingToken, "business-lot-tag");
  assert.equal(data.fileUrl, undefined);
  assert.equal(data.secret, undefined);
});
test("actual in-memory HTTP and batched requests cannot spoof operation type or authenticated role", async () => {
  let writes = 0;
  const api = router({
    write: protectedProcedure.input(z.any()).mutation(() => ++writes),
    auth: router({ logout: publicProcedure.mutation(() => true) }),
  });
  const response = await resolveResponse({
    router: api,
    path: "write",
    req: new Request("http://isolated.invalid/api/trpc/write?type=query", {
      method: "POST",
      headers: { "content-type": "application/json", "x-role": "admin" },
      body: JSON.stringify({ json: { role: "owner" } }),
    }),
    createContext: async () => context(),
    error: null,
  });
  assert.equal(response.status, 403);
  const result = await resolveResponse({
    router: api,
    path: "auth.logout,write",
    req: new Request(
      "http://isolated.invalid/api/trpc/auth.logout,write?batch=1",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          0: { json: null },
          1: { json: { role: "admin" } },
        }),
      }
    ),
    createContext: async () => context(),
    error: null,
  });
  assert.ok(((await result.json()) as any[])[1].error);
  assert.equal(writes, 0);
});
test("actual protected REST middleware rejects observer before upload/export handler", async () => {
  const file = "server/_core/index.ts",
    source = fs.readFileSync(file, "utf8"),
    ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const node = ast.statements.find(
    n => ts.isFunctionDeclaration(n) && n.name?.text === "requireAuthMiddleware"
  )!;
  const js = transformSync(node.getText(ast), {
    loader: "ts",
    format: "cjs",
  }).code;
  const { observerHttpAllowed } = await import("../../shared/observer-policy");
  let next = 0,
    status = 0;
  const guard = new Function(
    "sdk",
    "isSessionAuthenticationError",
    "observerHttpAllowed",
    `${js};return requireAuthMiddleware;`
  )(
    { authenticateRequest: async () => user },
    () => false,
    observerHttpAllowed
  );
  await guard(
    {},
    {
      status: (s: number) => {
        status = s;
        return { json() {} };
      },
    },
    () => next++
  );
  assert.equal(status, 403);
  assert.equal(next, 0);
});
test("all original path decisions remain unchanged and observer has the same route scope as admin", () => {
  const old = fs.readFileSync(
    "tools/observer/artifacts/before/shared__roles.ts.before",
    "utf8"
  );
  const js = transformSync(old, { loader: "ts", format: "cjs" }).code;
  const helpers = { canManageTicketTeams, canReadTicketTeamExecution };
  // CJS transpilation assigns module.exports; export getters are on that object.
  const mod: any = { exports: {} };
  new Function("require", "module", "exports", js)(
    (name: string) => helpers,
    mod,
    mod.exports
  );
  for (const path of [
    "/",
    "/tickets",
    "/users",
    "/inventory",
    "/construction",
    "/catalog",
    "/scheduled-maintenance/my-tasks",
    "/maintenance-team-tickets",
    "/unknown",
  ]) {
    assert.equal(
      canRoleAccessPath("observer", path),
      canRoleAccessPath("admin", path)
    );
    for (const role of Object.values(APP_ROLE).filter(r => r !== "observer"))
      assert.equal(
        canRoleAccessPath(role, path),
        mod.exports.canRoleAccessPath(role, path),
        `${role}:${path}`
      );
  }
});

import { useEffect, useRef, useState } from "react";
import { createDemo } from "../../../../../server/maintenance-team-tickets/testing/fixture";
import type {
  Assignment,
  Command,
  Snapshot,
} from "../../../../../shared/maintenance-team-tickets/model";
import { TeamsManagementView } from "../TeamsManagementView";
import { TechnicianTicketsPage } from "../TechnicianTicketsPage";
import { WarehouseMaterialsPage } from "../WarehouseMaterialsPage";
import { ManagerReviewPage } from "../ManagerReviewPage";

async function initialize() {
  const d = createDemo();
  const s = await d.store.read();
  for (const ticket of s.tickets.slice(0, 2)) {
    const { closed: _c, assignmentMode: _m, ...ref } = ticket;
    await d.service.assign(1, { ...ref, teamId: 21 });
  }
  return d;
}
// Only this preview entry imports the explicit fake environment.
export function Preview() {
  const [demo, setDemo] = useState<Awaited<
    ReturnType<typeof initialize>
  > | null>(null);
  const [state, setState] = useState<Snapshot | null>(null);
  const [actorId, setActor] = useState(3);
  const [page, setPage] = useState("tickets");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const retries = useRef(new Map<string, Command>());
  const reading = useRef(0);
  useEffect(() => {
    let current = true;
    void initialize().then(d => {
      if (current) setDemo(d);
    });
    return () => {
      current = false;
    };
  }, []);
  useEffect(() => {
    if (!demo) return;
    const read = ++reading.current;
    void demo.service
      .read(actorId)
      .then(s => {
        if (read === reading.current) setState(s);
      })
      .catch(e => {
        if (read === reading.current) setError(String(e.message));
      });
  }, [demo, actorId]);
  if (!demo || !state)
    return <div className="mtt-app mtt-empty">تحميل بيانات المعاينة…</div>;
  const actor = state.users.find(u => u.id === actorId)!;
  const manager = [
    "maintenance_manager",
    "general_maintenance_manager",
    "owner",
    "admin",
  ].includes(actor.role);
  const warehouse = ["warehouse", "owner", "admin"].includes(actor.role);
  const run = async (work: () => Promise<unknown>, quiet = false) => {
    if (busy) return false;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await work();
      setState(await demo.service.read(actorId));
      if (!quiet) setMessage("تم تسجيل الإجراء");
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر الإجراء");
      setState(await demo.service.read(actorId));
      return false;
    } finally {
      setBusy(false);
    }
  };
  const command = (a: Assignment, payload: unknown) => {
    const identity = JSON.stringify({
      actorId,
      assignmentId: a.id,
      revision: a.revision,
      payload,
    });
    if (!retries.current.has(identity))
      retries.current.set(identity, {
        assignmentId: a.id,
        expectedRevision: a.revision,
        operationKey: crypto.randomUUID(),
      });
    return retries.current.get(identity)!;
  };
  const props = { api: demo.service, actorId, state, busy, run, command };
  return (
    <div
      className={
        page === "teams" && manager
          ? "min-h-screen bg-background font-sans text-foreground"
          : "mtt-app"
      }
      dir="rtl"
    >
      <div className="mtt-preview-banner">
        <strong>معاينة مستقلة · بيانات تجريبية</strong>
        <span>الإجراءات هنا لا تؤثر على النظام العامل.</span>
        <button
          className="mtt-link"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void initialize()
              .then(d => {
                setDemo(d);
                retries.current.clear();
                setError("");
                setMessage("");
              })
              .finally(() => setBusy(false));
          }}
        >
          إعادة بيانات التجربة
        </button>
      </div>
      <div className="mtt-shell">
        <aside className="mtt-sidebar">
          <div className="mtt-logo">
            الصيانة<span>فرق التذاكر</span>
          </div>
          <label>
            الدور في المعاينة
            <select
              disabled={busy}
              value={actorId}
              onChange={e => {
                const id = Number(e.target.value);
                setState(null);
                setActor(id);
                setPage(
                  id === 1 ? "teams" : id === 2 ? "warehouse" : "tickets"
                );
                setError("");
                setMessage("");
              }}
            >
              {state.users
                .filter(u => [1, 2, 3, 4, 5].includes(u.id))
                .map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
            </select>
          </label>
          <nav aria-label="صفحات المعاينة">
            {manager && (
              <>
                <span className="mtt-nav-label">الإدارة</span>
                <button disabled className="mtt-nav-disabled">
                  الأصول
                </button>
                <button
                  className={page === "teams" ? "mtt-nav-active" : ""}
                  onClick={() => setPage("teams")}
                >
                  فرق الصيانة
                </button>
                <button
                  className={page === "review" ? "mtt-nav-active" : ""}
                  onClick={() => setPage("review")}
                >
                  مراجعة نتائج الفريق
                </button>
              </>
            )}
            {actor.role === "technician" && (
              <button
                className="mtt-nav-active"
                onClick={() => setPage("tickets")}
              >
                تذاكر الصيانة
              </button>
            )}
            {warehouse && (
              <button
                className="mtt-nav-active"
                onClick={() => setPage("warehouse")}
              >
                مواد تذاكر الصيانة
              </button>
            )}
          </nav>
          <div className="mtt-sidebar-note">
            مهام تذاكر الصيانة
            <br />
            مستقلة عن مهام PMV2
          </div>
        </aside>
        <main className="mtt-main" aria-busy={busy}>
          {error && (
            <div role="alert" className="mtt-alert">
              {error}
            </div>
          )}
          {message && (
            <div role="status" className="mtt-success">
              {message}
            </div>
          )}
          {page === "teams" && manager && (
            <TeamsManagementView
              data={{
                teams: state.teams,
                memberships: state.memberships,
                technicians: state.users,
                // Warehouse 10 is the main warehouse in this explicit fake fixture only.
                warehouses: state.warehouses.map(w => ({
                  ...w,
                  type: w.id === 10 ? "main" : "branch",
                })),
              }}
              busy={busy}
              onCreate={input =>
                run(() =>
                  demo.teamManagement.create(
                    { id: actorId, role: actor.role, active: actor.active },
                    input
                  )
                )
              }
              onSave={input =>
                run(() =>
                  demo.teamManagement.save(
                    { id: actorId, role: actor.role, active: actor.active },
                    input
                  )
                )
              }
              onActive={input =>
                run(() =>
                  demo.teamManagement.setActive(
                    { id: actorId, role: actor.role, active: actor.active },
                    input
                  )
                )
              }
            />
          )}
          {page === "review" && manager && <ManagerReviewPage {...props} />}
          {page === "warehouse" && warehouse && (
            <WarehouseMaterialsPage {...props} />
          )}
          {page === "tickets" && actor.role === "technician" && (
            <TechnicianTicketsPage {...props} />
          )}
        </main>
      </div>
    </div>
  );
}

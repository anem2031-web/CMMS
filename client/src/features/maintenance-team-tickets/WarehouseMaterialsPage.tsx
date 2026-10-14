import { useState } from "react";
import {
  issued,
  remainingReturn,
  stageLabels,
} from "../../../../shared/maintenance-team-tickets/model";
import type { ViewProps } from "./types";

export function WarehouseMaterialsPage(p: ViewProps) {
  const [resolved, setResolved] = useState<Record<number, number>>({});
  const [reason, setReason] = useState<Record<number, string>>({});
  const [returnQty, setReturnQty] = useState<Record<string, number>>({});
  const needs = p.state.needs.filter(
    n =>
      p.state.assignments.some(
        a => a.id === n.assignmentId && a.stage === "waiting_material"
      ) && issued(p.state, n.id) < n.requested
  );
  const returns = p.state.needs.filter(n => remainingReturn(p.state, n.id) > 0);
  return (
    <section>
      <div className="mtt-heading">
        <div>
          <h1>مواد تذاكر الصيانة</h1>
          <p>توفير الاحتياج ومتابعة المرتجع الفعلي.</p>
        </div>
      </div>
      <h2>طلبات المواد</h2>
      {!needs.length && (
        <div className="mtt-empty">لا توجد طلبات مواد بانتظار التوفير.</div>
      )}
      <div className="mtt-grid">
        {needs.map(n => {
          const a = p.state.assignments.find(a => a.id === n.assignmentId)!;
          return (
            <article className="mtt-panel" key={n.id}>
              <span className="mtt-reference">{a.ticketNumber}</span>
              <h2>{n.name}</h2>
              <p>
                {n.requested} {n.unit} ·{" "}
                {p.state.teams.find(t => t.id === a.teamId)?.name}
              </p>
              {n.catalogItemId === null ? (
                <form
                  onSubmit={e => {
                    e.preventDefault();
                    void p.run(() =>
                      p.api.resolveMaterial(
                        p.actorId,
                        p.command(a, {
                          resolve: n.id,
                          id: resolved[n.id],
                          reason: reason[n.id],
                        }),
                        n.id,
                        resolved[n.id],
                        reason[n.id] ?? ""
                      )
                    );
                  }}
                >
                  <label>
                    مطابقة بصنف الكتالوج
                    <select
                      required
                      value={resolved[n.id] ?? 0}
                      onChange={e =>
                        setResolved({
                          ...resolved,
                          [n.id]: Number(e.target.value),
                        })
                      }
                    >
                      <option disabled value={0}>
                        اختر الصنف
                      </option>
                      {p.state.catalog
                        .filter(c => c.active)
                        .map(c => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    سبب المطابقة
                    <input
                      required
                      maxLength={4000}
                      value={reason[n.id] ?? ""}
                      onChange={e =>
                        setReason({ ...reason, [n.id]: e.target.value })
                      }
                    />
                  </label>
                  <button disabled={p.busy || !resolved[n.id]}>
                    تحديد المادة
                  </button>
                </form>
              ) : (
                <div className="mtt-row">
                  <button
                    disabled={p.busy}
                    onClick={() =>
                      void p.run(() =>
                        p.api.provideMaterial(
                          p.actorId,
                          p.command(a, { transfer: n.id }),
                          n.id,
                          "transfer"
                        )
                      )
                    }
                  >
                    تحويل من الرئيسي
                  </button>
                  <button
                    className="mtt-secondary"
                    disabled={p.busy}
                    onClick={() =>
                      void p.run(() =>
                        p.api.provideMaterial(
                          p.actorId,
                          p.command(a, { purchase: n.id }),
                          n.id,
                          "purchase"
                        )
                      )
                    }
                  >
                    طلب شراء للنقص
                  </button>
                </div>
              )}
              {p.state.supplies
                .filter(x => x.needId === n.id)
                .map(x => (
                  <div key={x.id} className="mtt-material">
                    <span>
                      {x.sourceNumber} — {x.quantity} {n.unit} ·{" "}
                      {x.status === "pending"
                        ? "بانتظار دورة الشراء"
                        : "وصل المستودع"}
                    </span>
                    {x.kind === "purchase" && x.status === "pending" && (
                      <button
                        className="mtt-secondary"
                        disabled={p.busy}
                        onClick={() =>
                          void p.run(() =>
                            p.api.receivePurchase(
                              p.actorId,
                              p.command(a, { receivePurchase: x.id }),
                              x.id
                            )
                          )
                        }
                      >
                        محاكاة اعتماد الشراء واستلامه
                      </button>
                    )}
                  </div>
                ))}
            </article>
          );
        })}
      </div>
      <h2>مرتجع بانتظار الاستلام</h2>
      {!returns.length && (
        <div className="mtt-empty">لا توجد كميات مرتجع معلقة.</div>
      )}
      <div className="mtt-grid">
        {returns.map(n => {
          const a = p.state.assignments.find(a => a.id === n.assignmentId)!;
          const links = p.state.deliveries.filter(d => d.needId === n.id);
          const lots = new Map<number, number>();
          for (const d of links)
            if (d.quantity > d.returned)
              lots.set(
                d.lotId,
                (lots.get(d.lotId) ?? 0) + d.quantity - d.returned
              );
          const returned = links.reduce((sum, d) => sum + d.returned, 0);
          const allocations =
            lots.size === 1
              ? undefined
              : [...lots]
                  .map(([lotId]) => ({
                    lotId,
                    quantity: returnQty[`${n.id}:${lotId}`] ?? 0,
                  }))
                  .filter(x => x.quantity > 0);
          return (
            <article className="mtt-panel" key={n.id}>
              <span className="mtt-reference">{a.ticketNumber}</span>
              <h2>{n.name}</h2>
              <p>
                المصروف {issued(p.state, n.id)} {n.unit} · المستخدم {n.used}{" "}
                {n.unit} · المرتجع المستلم {returned} {n.unit} · المتبقي{" "}
                {remainingReturn(p.state, n.id)} {n.unit}
              </p>
              {links.map(d => (
                <p key={d.id}>
                  السند الأصلي: {d.deliveryNumber} · الدفعة #{d.lotId} ·
                  المستلم:{" "}
                  {p.state.users.find(u => u.id === d.receivedById)?.name}
                </p>
              ))}
              {lots.size === 1 ? (
                <p>المرتجع من الدفعة الأصلية #{[...lots.keys()][0]}</p>
              ) : (
                <>
                  <p>وزّع كامل المرتجع على الدفعات الأصلية.</p>
                  {[...lots].map(([lotId, available]) => (
                    <label key={lotId}>
                      كمية المرتجع من الدفعة #{lotId} — الحد الأقصى {available}{" "}
                      {n.unit}
                      <input
                        type="number"
                        min={0}
                        max={available}
                        step={1}
                        value={returnQty[`${n.id}:${lotId}`] ?? ""}
                        onChange={e =>
                          setReturnQty({
                            ...returnQty,
                            [`${n.id}:${lotId}`]: Number(e.target.value),
                          })
                        }
                      />
                    </label>
                  ))}
                </>
              )}
              <button
                disabled={
                  p.busy ||
                  (allocations !== undefined &&
                    allocations.reduce((sum, x) => sum + x.quantity, 0) !==
                      remainingReturn(p.state, n.id))
                }
                onClick={() =>
                  void p.run(() =>
                    p.api.confirmReturn(
                      p.actorId,
                      p.command(a, { return: n.id, allocations }),
                      n.id,
                      allocations
                    )
                  )
                }
              >
                تأكيد استلام المرتجع
              </button>
            </article>
          );
        })}
      </div>
      <h2>إعادة أصل الصيانة الخارجية</h2>
      <div className="mtt-grid">
        {p.state.assignments
          .filter(a => a.stage === "external_in_progress")
          .map(a => (
            <article className="mtt-panel" key={a.id}>
              <span className="mtt-reference">{a.ticketNumber}</span>
              <h2>{a.title}</h2>
              <p>{stageLabels[a.stage]}</p>
              <label>
                المستلم الفعلي
                <select id={`recipient-${a.id}`} defaultValue={0}>
                  <option disabled value={0}>
                    اختر فني الفريق
                  </option>
                  {p.state.users
                    .filter(
                      u =>
                        u.active &&
                        p.state.memberships.some(
                          m =>
                            m.teamId === a.teamId &&
                            m.userId === u.id &&
                            m.active
                        )
                    )
                    .map(u => (
                      <option value={u.id} key={u.id}>
                        {u.name}
                      </option>
                    ))}
                </select>
              </label>
              <button
                disabled={p.busy}
                onClick={() => {
                  const recipient = Number(
                    (
                      document.getElementById(
                        `recipient-${a.id}`
                      ) as HTMLSelectElement
                    ).value
                  );
                  void p.run(() =>
                    p.api.review(
                      p.actorId,
                      p.command(a, { externalHandover: recipient }),
                      "external_handover",
                      "محاكاة اكتمال دورة الصيانة الخارجية وتسليم الأصل",
                      recipient
                    )
                  );
                }}
              >
                محاكاة اكتمال دورة C وتسليم الأصل
              </button>
            </article>
          ))}
      </div>
    </section>
  );
}

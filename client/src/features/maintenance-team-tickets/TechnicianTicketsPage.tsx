import { useState } from "react";
import {
  isRequiredNow,
  outcomeLabels,
  remainingReturn,
  stageLabels,
  issued,
  type Assignment,
  type Outcome,
  type NeedInput,
} from "../../../../shared/maintenance-team-tickets/model";
import type { ViewProps } from "./types";

function TicketCard(p: ViewProps & { assignment: Assignment }) {
  const a = p.assignment;
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [note, setNote] = useState("");
  const [other, setOther] = useState("");
  const [used, setUsed] = useState<Record<number, number>>({});
  const [catalogId, setCatalog] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("قطعة");
  const [quantity, setQuantity] = useState(1);
  const [cart, setCart] = useState<NeedInput[]>([]);
  const [preview, setPreview] = useState<Awaited<
    ReturnType<ViewProps["api"]["previewMaterials"]>
  > | null>(null);
  const [receipt, setReceipt] = useState<{
    needId: number;
    name: string;
    unit: string;
    quantity: number;
    revision: number;
    warehouseName: string;
  } | null>(null);
  const needs = p.state.needs.filter(
    n => n.assignmentId === a.id && n.round === a.materialRound
  );
  const material = () => ({
    ...(catalogId ? { catalogItemId: catalogId } : { name }),
    unit,
    quantity,
  });
  const add = () => {
    const input = material();
    if (
      !Number.isSafeInteger(quantity) ||
      quantity < 1 ||
      catalogId === null ||
      !unit.trim() ||
      (!catalogId && !name.trim()) ||
      cart.length >= 20
    )
      return;
    if (
      cart.some(x =>
        catalogId
          ? x.catalogItemId === catalogId
          : !x.catalogItemId && x.name?.trim() === name.trim()
      )
    )
      return;
    setCart([...cart, input]);
    setPreview(null);
    setName("");
    setQuantity(1);
    setCatalog(null);
  };
  const sendRequest = async (confirmedCatalogIds: number[]) => {
    if (!preview) return;
    const payload = { outcome: "needs_material", cart, confirmedCatalogIds };
    if (
      await p.run(() =>
        p.api.requestMaterials(
          p.actorId,
          p.command({ ...a, revision: preview.revision }, payload),
          cart,
          confirmedCatalogIds
        )
      )
    ) {
      setOutcome(null);
      setCart([]);
      setPreview(null);
    }
  };
  const send = async () => {
    if (!outcome) return;
    if (outcome === "needs_material") {
      if (!cart.length) return;
      await p.run(async () => {
        setPreview(await p.api.previewMaterials(p.actorId, a.id, cart));
      }, true);
    } else {
      const input = {
        note,
        otherMaterials: outcome === "fixed" ? other : undefined,
        usages:
          outcome === "fixed"
            ? needs.map(n => ({
                catalogItemId: n.catalogItemId!,
                used: used[n.id] ?? issued(p.state, n.id),
              }))
            : [],
      };
      if (
        await p.run(() =>
          p.api.submitOutcome(
            p.actorId,
            p.command(a, { outcome, input }),
            outcome,
            input
          )
        )
      ) {
        setOutcome(null);
        setNote("");
        setOther("");
      }
    }
  };
  return (
    <article className="mtt-panel mtt-ticket">
      <div className="mtt-row">
        <span className="mtt-reference">{a.ticketNumber}</span>
        <span className="mtt-badge">{stageLabels[a.stage]}</span>
      </div>
      <h2>{a.title}</h2>
      <p>{p.state.teams.find(t => t.id === a.teamId)?.name}</p>
      {isRequiredNow(a.stage) && (
        <>
          <div className="mtt-options">
            {(Object.keys(outcomeLabels) as Outcome[]).map(o => (
              <button
                className={outcome === o ? "mtt-selected" : "mtt-secondary"}
                key={o}
                disabled={
                  p.busy ||
                  (o === "ok" &&
                    (needs.length > 0 || a.stage === "reinstall_required")) ||
                  (o === "needs_material" && needs.length > 0)
                }
                onClick={() => setOutcome(o)}
              >
                {outcomeLabels[o]}
              </button>
            ))}
          </div>
          {outcome && (
            <form
              className="mtt-form"
              onSubmit={e => {
                e.preventDefault();
                void send();
              }}
            >
              {outcome === "needs_material" ? (
                <>
                  <div className="mtt-row">
                    <label>
                      المادة
                      <select
                        value={catalogId ?? ""}
                        onChange={e => {
                          const id = Number(e.target.value);
                          setCatalog(id);
                          setUnit(
                            p.state.catalog.find(c => c.id === id)?.unit ??
                              "قطعة"
                          );
                        }}
                      >
                        <option disabled value="">
                          اختر المادة
                        </option>
                        <option value={0}>مادة غير مدرجة</option>
                        {p.state.catalog
                          .filter(c => c.active)
                          .map(c => (
                            <option value={c.id} key={c.id}>
                              {c.name}
                            </option>
                          ))}
                      </select>
                    </label>
                    {catalogId === 0 && (
                      <label>
                        وصف المادة
                        <input
                          maxLength={250}
                          value={name}
                          onChange={e => setName(e.target.value)}
                        />
                      </label>
                    )}
                    <label>
                      الكمية
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={quantity}
                        onChange={e => setQuantity(Number(e.target.value))}
                      />
                    </label>
                    <label>
                      الوحدة
                      <input
                        maxLength={50}
                        readOnly={Boolean(catalogId)}
                        value={unit}
                        onChange={e => setUnit(e.target.value)}
                      />
                    </label>
                    <button
                      type="button"
                      className="mtt-secondary"
                      disabled={
                        p.busy ||
                        catalogId === null ||
                        quantity < 1 ||
                        (!catalogId && !name.trim())
                      }
                      onClick={add}
                    >
                      أضف للطلب
                    </button>
                  </div>
                  {cart.map((n, i) => (
                    <div className="mtt-row mtt-material" key={i}>
                      <span>
                        {p.state.catalog.find(c => c.id === n.catalogItemId)
                          ?.name ?? n.name}{" "}
                        — {n.quantity} {n.unit}
                      </span>
                      <button
                        type="button"
                        className="mtt-link"
                        disabled={p.busy}
                        onClick={() => {
                          setCart(cart.filter((_, index) => index !== i));
                          setPreview(null);
                        }}
                      >
                        حذف
                      </button>
                    </div>
                  ))}
                  <p>
                    راجع المتوفر والنقص، ثم أكد استلام المواد المتوفرة من مستودع
                    الفريق.
                  </p>
                  {preview && (
                    <div className="mtt-notice">
                      <strong>المستودع: {preview.warehouseName}</strong>
                      {preview.rows.map((n, i) => (
                        <p key={i}>
                          {n.name} — المطلوب {n.quantity} {n.unit} · المتوفر{" "}
                          {n.available ?? "غير محدد"} · النقص {n.shortage}
                        </p>
                      ))}
                      {preview.rows.some(
                        n => n.catalogItemId && n.shortage === 0
                      ) ? (
                        <>
                          <p>
                            هل تؤكد استلام كامل الكمية للأصناف المتوفرة؟ سينشأ
                            سند صرف باسمك. الأصناف الناقصة تبقى بانتظار التوفير.
                          </p>
                          <button
                            type="button"
                            disabled={p.busy || preview.revision !== a.revision}
                            onClick={() =>
                              void sendRequest(
                                preview.rows
                                  .filter(
                                    n => n.catalogItemId && n.shortage === 0
                                  )
                                  .map(n => n.catalogItemId!)
                              )
                            }
                          >
                            تأكيد الاستلام وإرسال الطلب
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          disabled={p.busy || preview.revision !== a.revision}
                          onClick={() => void sendRequest([])}
                        >
                          إرسال طلب النقص
                        </button>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <label>
                    {outcome === "fixed"
                      ? "ما الذي تم إصلاحه؟"
                      : outcome === "blocked"
                        ? "سبب العائق"
                        : outcome === "external"
                          ? "ما المطلوب من الصيانة الخارجية؟"
                          : "ملاحظات الفحص — اختياري"}
                    <textarea
                      required={outcome !== "ok"}
                      maxLength={4000}
                      value={note}
                      onChange={e => setNote(e.target.value)}
                    />
                  </label>
                  {outcome === "fixed" && (
                    <>
                      {needs.map(n => (
                        <label key={n.id}>
                          {n.name} — المطلوب {n.requested} {n.unit} · المصروف{" "}
                          {issued(p.state, n.id)} {n.unit} · المستخدم فعليًا
                          <input
                            type="number"
                            min={0}
                            max={issued(p.state, n.id)}
                            step={1}
                            value={used[n.id] ?? issued(p.state, n.id)}
                            onChange={e =>
                              setUsed({
                                ...used,
                                [n.id]: Number(e.target.value),
                              })
                            }
                          />
                        </label>
                      ))}
                      <label>
                        تفاصيل مواد أخرى استخدمتها — إن وجدت
                        <textarea
                          maxLength={4000}
                          value={other}
                          onChange={e => setOther(e.target.value)}
                        />
                      </label>
                      <p>
                        الكمية غير المستخدمة تصبح مرتجعًا بانتظار استلام
                        المستودع.
                      </p>
                    </>
                  )}
                </>
              )}
              <div className="mtt-row">
                <button
                  disabled={
                    p.busy || (outcome === "needs_material" && !cart.length)
                  }
                >
                  {outcome === "needs_material"
                    ? "مراجعة المتوفر والنقص"
                    : `إرسال ${outcomeLabels[outcome]}`}
                </button>
                <button
                  type="button"
                  className="mtt-secondary"
                  disabled={p.busy}
                  onClick={() => {
                    setOutcome(null);
                    setPreview(null);
                  }}
                >
                  إلغاء
                </button>
              </div>
            </form>
          )}
        </>
      )}
      {needs.map(n => (
        <div className="mtt-material" key={n.id}>
          <strong>{n.name}</strong>
          <p>
            المطلوب {n.requested} {n.unit} · المستلم {issued(p.state, n.id)}{" "}
            {n.unit}
          </p>
          {n.originalName !== n.name && <p>الوصف الأصلي: {n.originalName}</p>}
          {a.stage === "waiting_material" &&
            n.catalogItemId !== null &&
            issued(p.state, n.id) < n.requested && (
              <button
                disabled={p.busy}
                onClick={() =>
                  void p.run(async () => {
                    const result = await p.api.previewMaterials(
                      p.actorId,
                      a.id,
                      [
                        {
                          catalogItemId: n.catalogItemId!,
                          unit: n.unit,
                          quantity: n.requested - issued(p.state, n.id),
                        },
                      ]
                    );
                    if (result.rows[0].shortage > 0)
                      throw new Error("الرصيد غير كافٍ لكامل الاحتياج");
                    setReceipt({
                      needId: n.id,
                      name: n.name,
                      unit: n.unit,
                      quantity: result.rows[0].quantity,
                      revision: result.revision,
                      warehouseName: result.warehouseName,
                    });
                  }, true)
                }
              >
                استلام من مستودع الفريق
              </button>
            )}
        </div>
      ))}
      {receipt && (
        <div
          className="mtt-notice"
          role="dialog"
          aria-label="تأكيد استلام المواد"
        >
          <p>
            تأكيد استلام {receipt.quantity} {receipt.unit} من {receipt.name} —{" "}
            {receipt.warehouseName}. سينشأ سند صرف باسمك.
          </p>
          <button
            disabled={p.busy || receipt.revision !== a.revision}
            onClick={() =>
              void p
                .run(() =>
                  p.api.receiveMaterial(
                    p.actorId,
                    p.command(
                      { ...a, revision: receipt.revision },
                      { receive: receipt.needId }
                    ),
                    receipt.needId
                  )
                )
                .then(ok => {
                  if (ok) setReceipt(null);
                })
            }
          >
            تأكيد الاستلام
          </button>
          <button
            className="mtt-secondary"
            disabled={p.busy}
            onClick={() => setReceipt(null)}
          >
            إلغاء الاستلام
          </button>
        </div>
      )}
      {p.state.needs
        .filter(n => n.assignmentId === a.id)
        .some(n => remainingReturn(p.state, n.id) > 0) && (
        <p className="mtt-notice">
          متبقي مرتجع:{" "}
          {p.state.needs
            .filter(n => n.assignmentId === a.id)
            .reduce((sum, n) => sum + remainingReturn(p.state, n.id), 0)}{" "}
          — بانتظار استلام المستودع.
        </p>
      )}
      {p.state.actions
        .filter(x => x.assignmentId === a.id)
        .slice(-3)
        .map(x => (
          <div className="mtt-history" key={x.id}>
            <span>{p.state.users.find(u => u.id === x.actorId)?.name}</span>
            <p>{x.note}</p>
          </div>
        ))}
    </article>
  );
}
export function TechnicianTicketsPage(p: ViewProps) {
  const [tab, setTab] = useState("required");
  const visible = p.state.assignments.filter(a =>
    tab === "required"
      ? isRequiredNow(a.stage)
      : tab === "waiting"
        ? !isRequiredNow(a.stage) && a.stage !== "closed"
        : a.stage === "closed"
  );
  return (
    <section>
      <div className="mtt-heading">
        <div>
          <h1>تذاكر الصيانة</h1>
          <p>تذاكر مسندة إلى فريقك. يستطيع أي عضو نشط تنفيذ الإجراء.</p>
        </div>
      </div>
      <div className="mtt-tabs" role="tablist" aria-label="حالة تذاكر الفريق">
        {[
          ["required", "مطلوب الآن"],
          ["waiting", "متابعة وانتظار"],
          ["completed", "مكتملة"],
        ].map(([id, label]) => (
          <button
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? "mtt-selected" : "mtt-secondary"}
            key={id}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {!visible.length && (
        <div className="mtt-empty">لا توجد تذاكر في هذه القائمة.</div>
      )}
      <div className="mtt-grid">
        {visible.map(a => (
          <TicketCard key={a.id} {...p} assignment={a} />
        ))}
      </div>
    </section>
  );
}

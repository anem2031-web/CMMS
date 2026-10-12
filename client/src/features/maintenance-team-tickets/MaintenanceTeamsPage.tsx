import { useState } from "react";
import type { ViewProps } from "./types";

export function MaintenanceTeamsPage(p: ViewProps) {
  const [name, setName] = useState("");
  const [warehouseId, setWarehouse] = useState(20);
  const [teamId, setTeam] = useState(21);
  const [ticketItemId, setTicket] = useState(0);
  const available = p.state.tickets.filter(
    t => !t.closed && t.assignmentMode === "unassigned"
  );
  const create = async () => {
    if (await p.run(() => p.api.createTeam(p.actorId, { name, warehouseId })))
      setName("");
  };
  return (
    <section>
      <div className="mtt-heading">
        <div>
          <h1>فرق الصيانة</h1>
          <p>أضف الفرق واربط الفنيين والمستودع بكل فريق.</p>
        </div>
        <span className="mtt-badge">{p.state.teams.length} فرق</span>
      </div>
      <form
        className="mtt-panel mtt-row"
        onSubmit={e => {
          e.preventDefault();
          void create();
        }}
      >
        <label>
          اسم الفريق
          <input
            required
            maxLength={100}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="مثال: فريق التكييف"
          />
        </label>
        <label>
          المستودع المرتبط
          <select
            value={warehouseId}
            onChange={e => setWarehouse(Number(e.target.value))}
          >
            {p.state.warehouses
              .filter(w => w.active)
              .map(w => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
          </select>
        </label>
        <button disabled={p.busy} type="submit">
          إضافة فريق
        </button>
      </form>
      <div className="mtt-grid">
        {p.state.teams.map(t => (
          <article className="mtt-panel" key={t.id}>
            <div className="mtt-row">
              <h2>{t.name}</h2>
              <span className="mtt-badge">{t.active ? "نشط" : "معطل"}</span>
            </div>
            <p>{p.state.warehouses.find(w => w.id === t.warehouseId)?.name}</p>
            <fieldset disabled={p.busy || !t.active}>
              <legend>الفنيون المرتبطون</legend>
              {p.state.users
                .filter(u => u.role === "technician" && u.active)
                .map(u => (
                  <label className="mtt-check" key={u.id}>
                    <input
                      type="checkbox"
                      checked={p.state.memberships.some(
                        m => m.teamId === t.id && m.userId === u.id && m.active
                      )}
                      onChange={e =>
                        void p.run(() =>
                          p.api.setMembership(
                            p.actorId,
                            t.id,
                            u.id,
                            e.target.checked
                          )
                        )
                      }
                    />
                    {u.name}
                  </label>
                ))}
            </fieldset>
            <button
              className="mtt-secondary"
              disabled={p.busy}
              onClick={() =>
                void p.run(() =>
                  p.api.setTeamActive(p.actorId, t.id, !t.active)
                )
              }
            >
              {t.active ? "تعطيل الفريق" : "تفعيل الفريق"}
            </button>
          </article>
        ))}
      </div>
      <form
        className="mtt-panel"
        onSubmit={async e => {
          e.preventDefault();
          const t = available.find(t => t.ticketItemId === ticketItemId);
          if (!t) return;
          const { closed: _closed, assignmentMode: _mode, ...ticket } = t;
          if (await p.run(() => p.api.assign(p.actorId, { ...ticket, teamId })))
            setTicket(0);
        }}
      >
        <h2>إسناد تذكرة تجريبية حسب الفريق</h2>
        <div className="mtt-row">
          <label>
            التذكرة
            <select
              required
              value={ticketItemId}
              onChange={e => setTicket(Number(e.target.value))}
            >
              <option value={0} disabled>
                اختر التذكرة
              </option>
              {available.map(t => (
                <option value={t.ticketItemId} key={t.ticketItemId}>
                  {t.ticketNumber} — {t.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            فريق الصيانة
            <select
              value={teamId}
              onChange={e => setTeam(Number(e.target.value))}
            >
              {p.state.teams
                .filter(t => t.active)
                .map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={
              p.busy || !available.some(t => t.ticketItemId === ticketItemId)
            }
          >
            إسناد للفريق
          </button>
        </div>
      </form>
    </section>
  );
}

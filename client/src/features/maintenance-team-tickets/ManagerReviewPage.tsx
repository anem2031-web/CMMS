import { useState } from "react";
import {
  outcomeLabels,
  stageLabels,
} from "../../../../shared/maintenance-team-tickets/model";
import type { ViewProps } from "./types";
export function ManagerReviewPage(p: ViewProps) {
  const [notes, setNotes] = useState<Record<number, string>>({});
  const waiting = p.state.assignments.filter(a =>
    ["blocked", "external_requested", "awaiting_review"].includes(a.stage)
  );
  return (
    <section>
      <div className="mtt-heading">
        <div>
          <h1>مراجعة نتائج الفريق</h1>
          <p>راجع العائق أو الطلب الخارجي أو نتيجة التنفيذ.</p>
        </div>
      </div>
      {!waiting.length && (
        <div className="mtt-empty">لا توجد نتائج بانتظارك.</div>
      )}
      <div className="mtt-grid">
        {waiting.map(a => (
          <article className="mtt-panel" key={a.id}>
            <div className="mtt-row">
              <span className="mtt-reference">{a.ticketNumber}</span>
              <span className="mtt-badge">{stageLabels[a.stage]}</span>
            </div>
            <h2>{a.title}</h2>
            <p>{a.outcome && outcomeLabels[a.outcome]}</p>
            <div className="mtt-history">
              {p.state.actions
                .filter(
                  x =>
                    x.assignmentId === a.id &&
                    ["ok", "fixed", "blocked", "external"].includes(x.kind)
                )
                .slice(-1)
                .map(x => (
                  <p key={x.id}>
                    {x.note}
                    <br />
                    الفني: {p.state.users.find(u => u.id === x.actorId)?.name}
                  </p>
                ))}
            </div>
            <label>
              ملاحظات المسؤول
              <textarea
                maxLength={4000}
                value={notes[a.id] ?? ""}
                onChange={e => setNotes({ ...notes, [a.id]: e.target.value })}
              />
            </label>
            <div className="mtt-row">
              <button
                className="mtt-secondary"
                disabled={p.busy || !notes[a.id]?.trim()}
                onClick={() =>
                  void p.run(() =>
                    p.api.review(
                      p.actorId,
                      p.command(a, { returnToTeam: notes[a.id] }),
                      "return_to_team",
                      notes[a.id]
                    )
                  )
                }
              >
                إعادة للفريق
              </button>
              {a.stage === "awaiting_review" && (
                <button
                  disabled={p.busy || !notes[a.id]?.trim()}
                  onClick={() =>
                    void p.run(() =>
                      p.api.review(
                        p.actorId,
                        p.command(a, { approve: notes[a.id] }),
                        "approve_result",
                        notes[a.id]
                      )
                    )
                  }
                >
                  اعتماد نتيجة الفريق
                </button>
              )}
              {a.stage === "external_requested" && (
                <button
                  disabled={p.busy || !notes[a.id]?.trim()}
                  onClick={() =>
                    void p.run(() =>
                      p.api.review(
                        p.actorId,
                        p.command(a, { approveExternal: notes[a.id] }),
                        "approve_external",
                        notes[a.id]
                      )
                    )
                  }
                >
                  اعتماد الطلب الخارجي
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

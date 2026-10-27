import type { Action, Snapshot } from "../../shared/maintenance-team-tickets/model";
import { sessionKinds, TICKET_EXECUTION_PROTOCOL } from "../../shared/maintenance-team-tickets/execution-session";
import { materialActionMessage } from "../../shared/maintenance-team-tickets/material-routing";

export const ACTION_TRANSLATION_ENTITY = "TICKET_TEAM_ACTION";
export function actionTranslationText(action: Pick<Action, "kind" | "note">): string {
  if (sessionKinds.has(action.kind) || action.kind === TICKET_EXECUTION_PROTOCOL) return "";
  return materialActionMessage(action.note).trim();
}

/** Called only after commit, with database-generated action IDs. */
export async function queueActionTranslations(actions: Action[]): Promise<void> {
  const { queueTranslation } = await import("../services/translation/translationEngine");
  const { detectLanguage } = await import("../services/translation/translation");
  for (const action of actions) {
    const text = actionTranslationText(action);
    if (!text) continue;
    await queueTranslation({ entityType: ACTION_TRANSLATION_ENTITY, entityId: action.id,
      fields: [{ fieldName: "note", text }], sourceLanguage: await detectLanguage(text), userId: action.actorId });
  }
}

type Reader = (type: string, ids: number[], language: "ar" | "en" | "ur", fields: string[]) => Promise<Record<number, Record<string, { text: string | null; status: string }>>>;
/** Enrich only the snapshot already scoped by the execution service; never load other actions. */
export async function localizeActionSnapshot(state: Snapshot, language?: "ar" | "en" | "ur", reader?: Reader): Promise<Snapshot> {
  if (!language) return state;
  const ids = [...new Set(state.actions.filter(a => actionTranslationText(a)).map(a => a.id))];
  if (!ids.length) return state;
  const read = reader ?? (await import("../services/translation/translationEngine")).getBatchTranslations;
  const notes = new Map<number, string>();
  for (let offset = 0; offset < ids.length; offset += 500) {
    const rows = await read(ACTION_TRANSLATION_ENTITY, ids.slice(offset, offset + 500), language, ["note"]);
    for (const id of ids.slice(offset, offset + 500)) {
      const note = rows[id]?.note;
      if (note?.text && ["completed", "approved"].includes(note.status)) notes.set(id, note.text);
    }
  }
  return { ...state, actions: state.actions.map(a => ({ ...a, translatedNote: notes.get(a.id) })) };
}

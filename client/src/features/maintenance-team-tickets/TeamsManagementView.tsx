import { useState } from "react";
import {
  teamManagementSnapshot,
  type TeamManagementData,
  type TeamDraft,
  type SaveTeamInput,
  type TeamManagementSnapshot,
} from "../../../../shared/maintenance-team-tickets/team-management";

const copies = {
  ar: {
    title: "فرق الصيانة",
    help: "إدارة فرق تذاكر الصيانة وربط الفنيين بالمستودعات الفرعية القائمة.",
    name: "اسم الفريق",
    warehouse: "المستودع المرتبط",
    choose: "اختر المستودع الفرعي",
    add: "إضافة فريق",
    members: "الفنيون المرتبطون",
    active: "نشط",
    inactive: "معطل",
    activate: "تفعيل الفريق",
    deactivate: "تعطيل الفريق",
    empty: "لا توجد فرق صيانة بعد.",
    noWarehouses: "لا توجد مستودعات فرعية نشطة للاختيار.",
    noTechnicians: "لا يوجد فنيون داخليون نشطون للاختيار.",
    unavailable: "غير نشط أو غير متاح",
    search: "بحث عن فني",
    save: "حفظ",
    saveChanges: "حفظ التعديلات",
    cancel: "إلغاء",
    edit: "تعديل الفريق",
    addMembers: "إضافة فنيين",
    noMembers: "لا يوجد فنيون مرتبطون",
    memberCount: "فني",
    activateFirst: "فعّل الفريق قبل تعديل الفنيين",
    details: "عرض التفاصيل",
    newTeam: "فريق جديد",
  },
  en: {
    title: "Maintenance Teams",
    help: "Manage maintenance ticket teams with existing technicians and branch warehouses.",
    name: "Team name",
    warehouse: "Linked warehouse",
    choose: "Choose a branch warehouse",
    add: "Add team",
    members: "Linked technicians",
    active: "Active",
    inactive: "Inactive",
    activate: "Activate team",
    deactivate: "Deactivate team",
    empty: "No maintenance teams yet.",
    noWarehouses: "No active branch warehouses available.",
    noTechnicians: "No active internal technicians available.",
    unavailable: "Inactive or unavailable",
    search: "Search technicians",
    save: "Save",
    saveChanges: "Save changes",
    cancel: "Cancel",
    edit: "Edit team",
    addMembers: "Add technicians",
    noMembers: "No linked technicians",
    memberCount: "technicians",
    activateFirst: "Activate the team before editing technicians",
    details: "View details",
    newTeam: "New team",
  },
  ur: {
    title: "مرمت کی ٹیمیں",
    help: "مرمت کے ٹکٹس کی ٹیموں کو موجودہ ٹیکنیشینز اور ذیلی گوداموں سے منسلک کریں۔",
    name: "ٹیم کا نام",
    warehouse: "منسلک گودام",
    choose: "ذیلی گودام منتخب کریں",
    add: "ٹیم شامل کریں",
    members: "منسلک ٹیکنیشینز",
    active: "فعال",
    inactive: "غیر فعال",
    activate: "ٹیم فعال کریں",
    deactivate: "ٹیم غیر فعال کریں",
    empty: "ابھی کوئی مرمت کی ٹیم نہیں۔",
    noWarehouses: "کوئی فعال ذیلی گودام دستیاب نہیں۔",
    noTechnicians: "کوئی فعال داخلی ٹیکنیشین دستیاب نہیں۔",
    unavailable: "غیر فعال یا دستیاب نہیں",
    search: "ٹیکنیشین تلاش کریں",
    save: "محفوظ کریں",
    saveChanges: "تبدیلیاں محفوظ کریں",
    cancel: "منسوخ",
    edit: "ٹیم میں ترمیم",
    addMembers: "ٹیکنیشین شامل کریں",
    noMembers: "کوئی منسلک ٹیکنیشین نہیں",
    memberCount: "ٹیکنیشین",
    activateFirst: "ٹیکنیشین تبدیل کرنے سے پہلے ٹیم فعال کریں",
    details: "تفصیلات دیکھیں",
    newTeam: "نئی ٹیم",
  },
};
type Copy = typeof copies.ar;
// Use the application's theme tokens and control dimensions; inherit its font and dark mode.
const buttonClass =
  "inline-flex h-9 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50";
const primaryButtonClass =
  buttonClass + " bg-primary text-primary-foreground hover:bg-primary/90";
const outlineButtonClass =
  buttonClass + " border border-input bg-transparent shadow-xs hover:bg-accent";
const fieldClass =
  "h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50";
export interface TeamsManagementViewProps {
  data: TeamManagementData;
  language?: string;
  busy: boolean;
  onCreate(input: TeamDraft): Promise<boolean>;
  onSave(input: SaveTeamInput): Promise<boolean>;
  onActive(input: { teamId: number; active: boolean }): Promise<unknown>;
}
function warehouseName(
  data: TeamManagementData,
  id: number,
  language?: string
) {
  const w = data.warehouses.find(w => w.id === id);
  return w ? (language === "en" && w.nameEn ? w.nameEn : w.name) : "#" + id;
}
function TeamEditor(p: {
  data: TeamManagementData;
  initial: TeamDraft;
  editing: boolean;
  active: boolean;
  busy: boolean;
  copy: Copy;
  language?: string;
  onSubmit(input: TeamDraft): Promise<boolean>;
  onCancel(): void;
}) {
  const [name, setName] = useState(p.initial.name);
  const [warehouseId, setWarehouse] = useState(
    p.initial.warehouseId ? String(p.initial.warehouseId) : ""
  );
  const [members, setMembers] = useState([...p.initial.memberIds]);
  const [search, setSearch] = useState("");
  const warehouses = p.data.warehouses.filter(
    w => w.active && w.type === "branch"
  );
  const candidates = p.data.technicians.filter(
    u =>
      (u.active && u.role === "technician") ||
      p.initial.memberIds.includes(u.id)
  );
  for (const id of p.initial.memberIds)
    if (!candidates.some(u => u.id === id))
      candidates.push({
        id,
        name: "#" + id,
        role: "unavailable",
        active: false,
      });
  const validWarehouse =
    warehouses.some(w => w.id === Number(warehouseId)) ||
    (p.editing && Number(warehouseId) === p.initial.warehouseId);
  return (
    <form
      className="space-y-4 rounded-xl border bg-card p-6 text-card-foreground shadow-sm"
      onSubmit={e => {
        e.preventDefault();
        if (!p.busy && name.trim() && validWarehouse)
          void p.onSubmit({
            name: name.trim(),
            warehouseId: Number(warehouseId),
            memberIds: members,
          });
      }}
    >
      <h2 className="text-base font-semibold">
        {p.editing ? p.copy.edit : p.copy.newTeam}
      </h2>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm font-medium">
          {p.copy.name}
          <input
            className={fieldClass}
            required
            maxLength={100}
            disabled={p.busy}
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium">
          {p.copy.warehouse}
          <select
            className={fieldClass}
            required
            disabled={p.busy}
            value={warehouseId}
            onChange={e => setWarehouse(e.target.value)}
          >
            <option value="" disabled>
              {p.copy.choose}
            </option>
            {p.editing &&
              !warehouses.some(w => w.id === p.initial.warehouseId) && (
                <option value={p.initial.warehouseId} disabled>
                  {warehouseName(p.data, p.initial.warehouseId, p.language)} (
                  {p.copy.unavailable})
                </option>
              )}
            {warehouses.map(w => (
              <option key={w.id} value={w.id}>
                {warehouseName(p.data, w.id, p.language)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {!warehouses.length && (
        <p className="text-sm text-muted-foreground">{p.copy.noWarehouses}</p>
      )}
      <fieldset className="space-y-3" disabled={p.busy || !p.active}>
        <legend className="mb-2 text-sm font-semibold">{p.copy.members}</legend>
        <label className="flex flex-col gap-2 text-sm font-medium">
          {p.copy.search}
          <input
            className={fieldClass}
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </label>
        {!candidates.length && (
          <p className="text-sm text-muted-foreground">
            {p.copy.noTechnicians}
          </p>
        )}
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {candidates
            .filter(u =>
              u.name
                .toLocaleLowerCase()
                .includes(search.trim().toLocaleLowerCase())
            )
            .map(u => (
              <label
                className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
                key={u.id}
              >
                <input
                  className="size-4 shrink-0 rounded border-input accent-primary disabled:opacity-50"
                  type="checkbox"
                  checked={members.includes(u.id)}
                  disabled={
                    !p.initial.memberIds.includes(u.id) &&
                    (!u.active || u.role !== "technician")
                  }
                  onChange={e =>
                    setMembers(current =>
                      e.target.checked
                        ? [...current, u.id]
                        : current.filter(id => id !== u.id)
                    )
                  }
                />
                {u.name}
                {!u.active || u.role !== "technician"
                  ? " (" + p.copy.unavailable + ")"
                  : ""}
              </label>
            ))}
        </div>
      </fieldset>
      {!p.active && (
        <p className="text-sm text-muted-foreground">{p.copy.activateFirst}</p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          className={primaryButtonClass}
          type="submit"
          disabled={p.busy || !name.trim() || !validWarehouse}
        >
          {p.editing ? p.copy.saveChanges : p.copy.save}
        </button>
        <button
          type="button"
          className={outlineButtonClass}
          disabled={p.busy}
          onClick={p.onCancel}
        >
          {p.copy.cancel}
        </button>
      </div>
    </form>
  );
}
/** Checkbox edits are local drafts; only Save submits the complete team once. */
export function TeamsManagementView(p: TeamsManagementViewProps) {
  const copy =
    copies[p.language === "en" ? "en" : p.language === "ur" ? "ur" : "ar"];
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<{
    teamId: number;
    expected: TeamManagementSnapshot;
  } | null>(null);
  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{copy.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{copy.help}</p>
        </div>
        <span className="rounded-full bg-secondary px-3 py-1 text-sm font-medium text-secondary-foreground">
          {p.data.teams.length}
        </span>
      </div>
      <button
        className={primaryButtonClass}
        type="button"
        disabled={p.busy || adding || !!editing}
        onClick={() => setAdding(true)}
      >
        {copy.add}
      </button>
      {adding && (
        <TeamEditor
          data={p.data}
          initial={{ name: "", warehouseId: 0, memberIds: [] }}
          editing={false}
          active={true}
          busy={p.busy}
          copy={copy}
          language={p.language}
          onCancel={() => setAdding(false)}
          onSubmit={async input => {
            const saved = await p.onCreate(input);
            if (saved) setAdding(false);
            return saved;
          }}
        />
      )}
      {!p.data.teams.length && (
        <div className="rounded-xl border border-dashed bg-card p-12 text-center text-sm text-muted-foreground">
          {copy.empty}
        </div>
      )}
      <div className="space-y-3">
        {p.data.teams.map(t => {
          const linked = p.data.memberships.filter(
            m => m.teamId === t.id && m.active
          );
          return (
            <details
              className="group rounded-xl border bg-card text-card-foreground shadow-sm"
              key={t.id}
            >
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 rounded-xl px-6 py-4 outline-none hover:bg-muted/30 focus-visible:ring-[3px] focus-visible:ring-ring/50 group-open:rounded-b-none group-open:border-b">
                <strong className="min-w-0 flex-1 text-sm font-semibold">
                  {t.name}
                </strong>
                <span
                  className={
                    "rounded-full px-2.5 py-0.5 text-xs font-medium " +
                    (t.active
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground")
                  }
                >
                  {t.active ? copy.active : copy.inactive}
                </span>
                <span className="text-xs text-muted-foreground">
                  {linked.length} {copy.memberCount}
                </span>
                <span className="text-xs text-muted-foreground">
                  {copy.details}
                </span>
              </summary>
              <div className="space-y-4 px-6 py-4">
                <p className="text-sm text-muted-foreground">
                  {copy.warehouse}:{" "}
                  {warehouseName(p.data, t.warehouseId, p.language)}
                </p>
                <h3 className="text-sm font-semibold">{copy.members}</h3>
                {!linked.length ? (
                  <p className="text-sm text-muted-foreground">
                    {copy.noMembers}
                  </p>
                ) : (
                  <ul className="list-inside list-disc space-y-1 text-sm">
                    {linked.map(m => {
                      const u = p.data.technicians.find(u => u.id === m.userId);
                      return (
                        <li key={m.userId}>
                          {u?.name ?? "#" + m.userId}
                          {!u?.active || u.role !== "technician"
                            ? " (" + copy.unavailable + ")"
                            : ""}
                        </li>
                      );
                    })}
                  </ul>
                )}
                {editing?.teamId === t.id ? (
                  <TeamEditor
                    key={t.id}
                    data={p.data}
                    initial={editing.expected}
                    editing={true}
                    active={editing.expected.active}
                    busy={p.busy}
                    copy={copy}
                    language={p.language}
                    onCancel={() => setEditing(null)}
                    onSubmit={async input => {
                      const saved = await p.onSave({
                        ...input,
                        teamId: t.id,
                        expected: editing.expected,
                      });
                      if (saved) setEditing(null);
                      return saved;
                    }}
                  />
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <button
                      className={outlineButtonClass}
                      type="button"
                      disabled={p.busy || adding || !!editing}
                      onClick={() =>
                        setEditing({
                          teamId: t.id,
                          expected: teamManagementSnapshot(p.data, t.id),
                        })
                      }
                    >
                      {copy.edit}
                    </button>
                    <button
                      type="button"
                      className={outlineButtonClass}
                      disabled={p.busy || adding || !!editing || !t.active}
                      onClick={() =>
                        setEditing({
                          teamId: t.id,
                          expected: teamManagementSnapshot(p.data, t.id),
                        })
                      }
                    >
                      {copy.addMembers}
                    </button>
                    <button
                      type="button"
                      className={outlineButtonClass}
                      disabled={p.busy || adding || !!editing}
                      onClick={() =>
                        void p.onActive({ teamId: t.id, active: !t.active })
                      }
                    >
                      {t.active ? copy.deactivate : copy.activate}
                    </button>
                  </div>
                )}
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}

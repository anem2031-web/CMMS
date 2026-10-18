const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})/;
const DAY_MS = 24 * 60 * 60 * 1000;

function dateOnlyParts(value: string | Date | null | undefined) {
  if (!value) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return {
      year: value.getFullYear(),
      month: value.getMonth() + 1,
      day: value.getDate(),
    };
  }

  const text = String(value);
  const match = text.match(DATE_ONLY_RE);
  if (!match) return null;

  // DATE columns arrive as YYYY-MM-DD and must remain timezone-neutral.
  if (text.length === 10) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const test = new Date(Date.UTC(year, month - 1, day));
    if (
      test.getUTCFullYear() !== year ||
      test.getUTCMonth() !== month - 1 ||
      test.getUTCDate() !== day
    ) return null;
    return { year, month, day };
  }

  // TIMESTAMP values use the viewer's local calendar day, matching what is shown in the UI.
  const timestamp = new Date(text);
  if (Number.isNaN(timestamp.getTime())) return null;
  return {
    year: timestamp.getFullYear(),
    month: timestamp.getMonth() + 1,
    day: timestamp.getDate(),
  };
}

export function getDefaultRequiredDate(baseDate = new Date(), days = 4): string {
  const date = new Date(baseDate);
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getAvailableCalendarDays(
  requiredDate: string | null | undefined,
  delegateAssignedAt: string | Date | null | undefined,
): number | null {
  const required = dateOnlyParts(requiredDate);
  const assigned = dateOnlyParts(delegateAssignedAt);
  if (!required || !assigned) return null;

  const requiredUtc = Date.UTC(required.year, required.month - 1, required.day);
  const assignedUtc = Date.UTC(assigned.year, assigned.month - 1, assigned.day);
  return Math.round((requiredUtc - assignedUtc) / DAY_MS);
}

export function getOverdueCalendarDays(
  requiredDate: string | null | undefined,
  today = new Date(),
): number | null {
  const required = dateOnlyParts(requiredDate);
  if (!required || Number.isNaN(today.getTime())) return null;

  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const requiredUtc = Date.UTC(required.year, required.month - 1, required.day);
  return Math.floor((todayUtc - requiredUtc) / DAY_MS);
}

export function formatDateOnly(value: string | Date | null | undefined, locale: string): string {
  const parts = dateOnlyParts(value);
  if (!parts) return "—";
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(date);
}

export function formatOverdueDuration(days: number, language: string): string {
  const safeDays = Math.max(0, Math.floor(days));
  if (language === "ar") {
    if (safeDays === 1) return "متأخر يوم";
    if (safeDays === 2) return "متأخر يومين";
    return `متأخر ${safeDays} أيام`;
  }
  if (language === "ur") return `${safeDays} دن تاخیر`;
  return `${safeDays} day${safeDays === 1 ? "" : "s"} late`;
}

/** Positive days remain; zero is due today; negative days are overdue. */
export function formatRemainingPurchaseDuration(days: number | null, language: string): string {
  if (days == null) return "—";
  if (days < 0) return formatOverdueDuration(Math.abs(days), language);
  if (language === "ar") {
    if (days === 0) return "مطلوب اليوم";
    if (days === 1) return "متبقي يوم";
    if (days === 2) return "متبقي يومان";
    return `متبقي ${days} أيام`;
  }
  if (language === "ur") return days === 0 ? "آج درکار ہے" : `${days} دن باقی ہیں`;
  return days === 0 ? "Due today" : `${days} day${days === 1 ? "" : "s"} remaining`;
}

export function formatAvailableDuration(days: number | null, language: string): string {
  if (days == null) return "—";

  if (language === "ar") {
    if (days < 0) {
      const late = Math.abs(days);
      if (late === 1) return "انتهى الموعد قبل الاستلام بيوم واحد";
      if (late === 2) return "انتهى الموعد قبل الاستلام بيومين";
      return `انتهى الموعد قبل الاستلام بـ ${late} أيام`;
    }
    if (days === 0) return "نفس اليوم";
    if (days === 1) return "يوم واحد";
    if (days === 2) return "يومان";
    return `${days} أيام`;
  }

  if (language === "ur") {
    if (days < 0) return `وصول سے ${Math.abs(days)} دن پہلے ضرورت کی تاریخ گزر چکی تھی`;
    if (days === 0) return "اسی دن";
    return `${days} دن`;
  }

  if (days < 0) return `Due date passed ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} before assignment`;
  if (days === 0) return "Same day";
  return `${days} day${days === 1 ? "" : "s"}`;
}

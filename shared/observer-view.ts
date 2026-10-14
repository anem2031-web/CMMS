import { isObserver } from "./observer-policy";
/** Presentation scope only; the session/cache continues to hold role=observer. */
export function observerViewUser<T extends { role: string }>(
  user: T | null | undefined
) {
  return user && isObserver(user.role)
    ? { ...user, role: "admin" as const }
    : (user ?? null);
}

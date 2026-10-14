import { OBSERVER_NATIVE_READ_PATHS } from "./observer-native-reads";
/** A distinct authenticated role with admin visibility only for reviewed reads. */
export const OBSERVER_ROLE = "observer";
export const isObserver = (role?: string | null) => role === OBSERVER_ROLE;
export const OBSERVER_READ_RPC_PATHS = OBSERVER_NATIVE_READ_PATHS;
export function observerRpcAllowed(
  role: string | null | undefined,
  type: string,
  path: string
): boolean {
  if (!isObserver(role)) return true;
  return (
    (type === "query" &&
      (OBSERVER_READ_RPC_PATHS as readonly string[]).includes(path)) ||
    (type === "mutation" && (path === "auth.logout" || path === "nfc.scanTag"))
  );
}
/** File generation/upload REST endpoints remain denied to the observer. */
export function observerHttpAllowed(role?: string | null): boolean {
  return !isObserver(role);
}
const secretKey =
  /password|secret|token|apikey|privatekey|credential|backupcodes|openid|signature|filekey|filepath|authorization|cookie|bearer|nonce/i;
export const observerFieldAllowed = (key: string) => key === "trackingToken" || !secretKey.test(key);
/** Also remove nested credentials from existing audit JSON, without altering stored records. */
export function redactObserverValue(value: unknown, depth = 0, hideBackupUrl = false): unknown {
  if (depth > 12) return "[محتوى متداخل محجوب]";
  if (value == null || typeof value !== "object") {
    if (typeof value === "string" && /^[\s]*[\[{]/.test(value)) {
      try {
        return JSON.stringify(redactObserverValue(JSON.parse(value), depth + 1, hideBackupUrl));
      } catch {
        return "[محتوى غير صالح للعرض]";
      }
    }
    return value;
  }
  if (value instanceof Date) return value;
  if (Array.isArray(value))
    return value.map(v => redactObserverValue(v, depth + 1, hideBackupUrl));
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => observerFieldAllowed(key) && !(hideBackupUrl && /^fileUrl$/i.test(key)))
      .map(([key, v]) => [key, redactObserverValue(v, depth + 1, hideBackupUrl)])
  );
}

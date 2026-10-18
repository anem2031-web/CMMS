/** Authentication secrets never belong in a browser response, including auth.me. */
const PRIVATE_USER_FIELDS = new Set(["passwordHash", "twoFactorSecret", "backupCodes"]);

export function redactUserSecrets<T>(value: T): T {
  if (value == null || typeof value !== "object" || value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(redactUserSecrets) as T;
  if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !PRIVATE_USER_FIELDS.has(key))
    .map(([key, child]) => [key, redactUserSecrets(child)])) as T;
}

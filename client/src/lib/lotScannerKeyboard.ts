/** HID scanner positions are stable when the active Windows keyboard layout changes. */
export function lotScannerPhysicalKey(event: { code: string; shiftKey: boolean }) {
  if (/^Key[A-Z]$/.test(event.code)) return event.shiftKey ? event.code.slice(3) : event.code.slice(3).toLowerCase();
  if (/^Digit[0-9]$/.test(event.code) && !event.shiftKey) return event.code.slice(5);
  if (/^Numpad[0-9]$/.test(event.code)) return event.code.slice(6);
  if (event.code === "Minus" && !event.shiftKey || event.code === "NumpadSubtract") return "-";
  return null;
}
export function resolveLotScannerInput(raw: string, physical: string) {
  const value = raw.trim();
  // Never reinterpret ordinary barcodes, pasted values, or a valid Latin token.
  if (!/[\u0600-\u06ff]/.test(value)) return value;
  if (/^(?:CMMS-LOT-[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}|LOT-\d{4}-[a-z\d]+)$/i.test(physical)) return physical;
  return value;
}

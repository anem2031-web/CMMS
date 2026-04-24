import type { CookieOptions, Request } from "express";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isIpAddress(host: string) {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes(":");
}

function isSecureRequest(req: Request) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto)
    ? forwardedProto
    : forwardedProto.split(",");
  return protoList.some(proto => proto.trim().toLowerCase() === "https");
}

function isLocalhost(hostname: string): boolean {
  return LOCAL_HOSTS.has(hostname) || isIpAddress(hostname);
}

// M-02 FIX: sameSite = "strict" في الإنتاج لمنع CSRF
// domain محدد بـ .tolanwork.sbs في الإنتاج
export function getSessionCookieOptions(
  req: Request
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  const hostname = req.hostname;
  const isLocal = isLocalhost(hostname);
  const isSecure = isSecureRequest(req);

  // في بيئة التطوير المحلية: sameSite=none للسماح بالـ cross-origin
  // في الإنتاج: sameSite=strict لمنع CSRF
  const sameSite: CookieOptions["sameSite"] = isLocal ? "none" : "strict";

  // تحديد domain فقط في الإنتاج لمنع تسريب الـ cookie لنطاقات أخرى
  let domain: string | undefined = undefined;
  if (!isLocal && hostname && !hostname.startsWith(".")) {
    // استخراج النطاق الجذري (مثال: tolanwork.sbs من sub.tolanwork.sbs)
    const parts = hostname.split(".");
    if (parts.length >= 2) {
      domain = `.${parts.slice(-2).join(".")}`;
    }
  }

  return {
    httpOnly: true,
    path: "/",
    sameSite,
    secure: isSecure,
    ...(domain ? { domain } : {}),
  };
}

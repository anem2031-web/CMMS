import { TRPCError } from "@trpc/server";
import { ENV } from "./env";

export type NotificationPayload = {
  title: string;
  content: string;
};

const TITLE_MAX_LENGTH = 1200;
const CONTENT_MAX_LENGTH = 20000;

const trimValue = (value: string): string => value.trim();
const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const buildEndpointUrl = (baseUrl: string): string => {
  const normalizedBase = baseUrl.endsWith("/")
    ? baseUrl
    : `${baseUrl}/`;
  return new URL(
    "webdevtoken.v1.WebDevService/SendNotification",
    normalizedBase
  ).toString();
};

const validatePayload = (input: NotificationPayload): NotificationPayload => {
  if (!isNonEmptyString(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required.",
    });
  }
  if (!isNonEmptyString(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required.",
    });
  }

  const title = trimValue(input.title);
  const content = trimValue(input.content);

  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`,
    });
  }

  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`,
    });
  }

  return { title, content };
};

// هذه الخدمة خاصة بتنبيه "مالك" مشروع Manus عند حدوث أخطاء نظام — منفصلة تماماً
// عن نظام إشعارات المستخدمين الداخلي (البلاغات/طلبات الشراء). في بيئة تشغيل ذاتية
// (self-hosted) عادة لا يوجد مفتاح صالح لهذه الخدمة، وبما أنها تُستدعى من عدة
// مهام دورية (jobs)، كانت رسالة الفشل تتكرر في كل تشغيل. نطبع كل رسالة مرة واحدة
// فقط لكل نوع فشل طوال عمر العملية (process) بدل تكرارها في كل استدعاء.
const warnedOnce = new Set<string>();
const warnOnce = (key: string, ...args: unknown[]) => {
  if (warnedOnce.has(key)) return;
  warnedOnce.add(key);
  console.warn(...args, "(لن تتكرر هذه الرسالة مجدداً في هذه الجلسة)");
};

/**
 * Dispatches a project-owner notification through the Manus Notification Service.
 * Returns `true` if the request was accepted, `false` when the upstream service
 * cannot be reached (callers can fall back to email/slack). Validation errors
 * bubble up as TRPC errors so callers can fix the payload.
 */
export async function notifyOwner(
  payload: NotificationPayload
): Promise<boolean> {
  const { title, content } = validatePayload(payload);

  if (!ENV.forgeApiUrl) {
    warnOnce("no-url", "[Notifications] Notification service unavailable — owner notifications skipped (URL not configured).");
    return false;
  }

  if (!ENV.forgeApiKey) {
    warnOnce("no-key", "[Notifications] Notification service unavailable — owner notifications skipped (API key not configured).");
    return false;
  }

  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1",
      },
      body: JSON.stringify({ title, content }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      warnOnce(
        `http-${response.status}`,
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${
          detail ? `: ${detail}` : ""
        }`
      );
      return false;
    }

    return true;
  } catch (error) {
    warnOnce("network-error", "[Notification] Error calling notification service:", error);
    return false;
  }
}

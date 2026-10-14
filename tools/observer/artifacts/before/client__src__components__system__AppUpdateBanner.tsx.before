import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

const UPDATE_STATE_KEY = "cmms-pwa-update-state-v1";
const DEFER_MS = 10 * 60 * 1000;
const CHECK_INTERVAL_MS = 60 * 1000;
const AUDIT_WAIT_MS = 2500;

const CURRENT_BUILD_ID = typeof __APP_BUILD_ID__ === "string" ? __APP_BUILD_ID__ : "unknown";

type DeferredUpdateState = {
  currentBuildId: string;
  targetBuildId: string;
  forceAfter: number;
};

type VersionPayload = {
  buildId?: string;
};

const COPY = {
  ar: {
    title: "يتوفر تحديث جديد للنظام",
    body: "تم نشر نسخة أحدث من البرنامج.",
    updateNow: "تحديث الآن",
    later: "لاحقًا",
    updating: "جاري تحديث النظام...",
    waitingForConnection: "التحديث إلزامي وسيتم تلقائيًا عند عودة الاتصال.",
  },
  en: {
    title: "A new system update is available",
    body: "A newer version of the application has been deployed.",
    updateNow: "Update now",
    later: "Later",
    updating: "Updating the system...",
    waitingForConnection: "The update is required and will run automatically when the connection returns.",
  },
  ur: {
    title: "سسٹم کی نئی اپ ڈیٹ دستیاب ہے",
    body: "ایپلیکیشن کا نیا ورژن جاری کر دیا گیا ہے۔",
    updateNow: "ابھی اپ ڈیٹ کریں",
    later: "بعد میں",
    updating: "سسٹم اپ ڈیٹ ہو رہا ہے...",
    waitingForConnection: "اپ ڈیٹ لازمی ہے اور انٹرنیٹ بحال ہوتے ہی خودکار طور پر ہو جائے گی۔",
  },
} as const;

function readDeferredState(): DeferredUpdateState | null {
  try {
    const raw = localStorage.getItem(UPDATE_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DeferredUpdateState>;
    if (
      typeof parsed.currentBuildId !== "string" ||
      typeof parsed.targetBuildId !== "string" ||
      typeof parsed.forceAfter !== "number"
    ) {
      localStorage.removeItem(UPDATE_STATE_KEY);
      return null;
    }
    return parsed as DeferredUpdateState;
  } catch {
    localStorage.removeItem(UPDATE_STATE_KEY);
    return null;
  }
}

function writeDeferredState(state: DeferredUpdateState) {
  localStorage.setItem(UPDATE_STATE_KEY, JSON.stringify(state));
}

function clearDeferredState() {
  localStorage.removeItem(UPDATE_STATE_KEY);
}

async function fetchServerBuildId(): Promise<string | null> {
  try {
    const response = await fetch(`/build-version.json?t=${Date.now()}`, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" },
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as VersionPayload;
    return typeof payload.buildId === "string" && payload.buildId.length > 0
      ? payload.buildId
      : null;
  } catch {
    return null;
  }
}

async function refreshServiceWorkerRegistration() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    await registration?.update();
  } catch {
    // A failed SW update must not prevent the page from reloading to the new build.
  }
}

export default function AppUpdateBanner() {
  const { user, loading } = useAuth();
  const { language } = useLanguage();
  const auditMutation = trpc.audit.recordPwaUpdateDecision.useMutation();
  const [targetBuildId, setTargetBuildId] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [forcedOffline, setForcedOffline] = useState(false);
  const forceTimerRef = useRef<number | null>(null);
  const forcingRef = useRef(false);
  const targetBuildRef = useRef<string | null>(null);

  const copy = COPY[language];

  useEffect(() => {
    targetBuildRef.current = targetBuildId;
  }, [targetBuildId]);

  const clearForceTimer = useCallback(() => {
    if (forceTimerRef.current !== null) {
      window.clearTimeout(forceTimerRef.current);
      forceTimerRef.current = null;
    }
  }, []);

  const auditWithBoundedWait = useCallback(
    async (
      action: "pwa_update_now" | "pwa_update_deferred" | "pwa_update_forced",
      toBuildId: string,
      deferredUntil?: string,
    ) => {
      if (!user) return;
      try {
        await Promise.race([
          auditMutation.mutateAsync({
            action,
            fromBuildId: CURRENT_BUILD_ID,
            toBuildId,
            deferredUntil,
          }),
          new Promise<void>((resolve) => window.setTimeout(resolve, AUDIT_WAIT_MS)),
        ]);
      } catch {
        // Updating the app must not be blocked if audit logging is temporarily unavailable.
      }
    },
    [auditMutation, user],
  );

  const performUpdate = useCallback(
    async (mode: "pwa_update_now" | "pwa_update_forced", requestedBuildId?: string | null) => {
      if (forcingRef.current) return;

      if (!navigator.onLine) {
        if (mode === "pwa_update_forced") {
          forcingRef.current = true;
          setForcedOffline(true);
          setVisible(true);
        }
        return;
      }

      forcingRef.current = true;
      setForcedOffline(false);
      setIsUpdating(true);
      setVisible(true);
      clearForceTimer();

      const latestBuildId = (await fetchServerBuildId()) || requestedBuildId || targetBuildRef.current;
      if (latestBuildId) {
        await auditWithBoundedWait(mode, latestBuildId);
      }

      clearDeferredState();
      await refreshServiceWorkerRegistration();
      window.location.reload();
    },
    [auditWithBoundedWait, clearForceTimer],
  );

  const scheduleForcedUpdate = useCallback(
    (forceAfter: number, buildId: string) => {
      clearForceTimer();
      const remaining = Math.max(0, forceAfter - Date.now());
      forceTimerRef.current = window.setTimeout(() => {
        void performUpdate("pwa_update_forced", buildId);
      }, remaining);
    },
    [clearForceTimer, performUpdate],
  );

  const checkForUpdate = useCallback(async () => {
    if (import.meta.env.DEV || loading || !user || forcingRef.current) return;

    const serverBuildId = await fetchServerBuildId();
    if (!serverBuildId) return;

    if (serverBuildId === CURRENT_BUILD_ID) {
      clearDeferredState();
      clearForceTimer();
      setTargetBuildId(null);
      setVisible(false);
      return;
    }

    setTargetBuildId(serverBuildId);
    const deferredState = readDeferredState();

    if (deferredState?.currentBuildId === CURRENT_BUILD_ID) {
      if (Date.now() >= deferredState.forceAfter) {
        void performUpdate("pwa_update_forced", serverBuildId);
        return;
      }

      // One defer is allowed for the currently running build. A newer deployment
      // during the same 10-minute window does not reset the user's deadline.
      if (deferredState.targetBuildId !== serverBuildId) {
        writeDeferredState({ ...deferredState, targetBuildId: serverBuildId });
      }
      setVisible(false);
      scheduleForcedUpdate(deferredState.forceAfter, serverBuildId);
      return;
    }

    if (deferredState) clearDeferredState();
    setVisible(true);
  }, [clearForceTimer, loading, performUpdate, scheduleForcedUpdate, user]);

  useEffect(() => {
    if (import.meta.env.DEV || loading || !user) return;

    void checkForUpdate();
    const intervalId = window.setInterval(() => void checkForUpdate(), CHECK_INTERVAL_MS);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") void checkForUpdate();
    };
    const handleOnline = () => {
      if (forcedOffline) {
        forcingRef.current = false;
        void performUpdate("pwa_update_forced", targetBuildRef.current);
      } else {
        void checkForUpdate();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("online", handleOnline);

    return () => {
      window.clearInterval(intervalId);
      clearForceTimer();
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("online", handleOnline);
    };
  }, [checkForUpdate, clearForceTimer, forcedOffline, loading, performUpdate, user]);

  const handleLater = useCallback(async () => {
    if (!targetBuildId || isUpdating || forcedOffline) return;

    const forceAfter = Date.now() + DEFER_MS;
    writeDeferredState({
      currentBuildId: CURRENT_BUILD_ID,
      targetBuildId,
      forceAfter,
    });
    setVisible(false);
    scheduleForcedUpdate(forceAfter, targetBuildId);

    await auditWithBoundedWait(
      "pwa_update_deferred",
      targetBuildId,
      new Date(forceAfter).toISOString(),
    );
  }, [auditWithBoundedWait, forcedOffline, isUpdating, scheduleForcedUpdate, targetBuildId]);

  const handleUpdateNow = useCallback(() => {
    if (!targetBuildId || isUpdating) return;
    void performUpdate("pwa_update_now", targetBuildId);
  }, [isUpdating, performUpdate, targetBuildId]);

  if (!user || !visible || !targetBuildId) return null;

  return (
    <div
      className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-2xl rounded-xl border bg-background/95 p-4 shadow-xl backdrop-blur supports-[backdrop-filter]:bg-background/90"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="mt-0.5 rounded-full bg-primary/10 p-2 text-primary">
            <RefreshCw className={`h-5 w-5 ${isUpdating ? "animate-spin" : ""}`} />
          </div>
          <div className="min-w-0">
            <div className="font-semibold">{copy.title}</div>
            <div className="text-sm text-muted-foreground">
              {forcedOffline ? copy.waitingForConnection : isUpdating ? copy.updating : copy.body}
            </div>
          </div>
        </div>

        {!isUpdating && !forcedOffline && (
          <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
            <Button variant="outline" size="sm" onClick={handleLater}>
              {copy.later}
            </Button>
            <Button size="sm" onClick={handleUpdateNow}>
              {copy.updateNow}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

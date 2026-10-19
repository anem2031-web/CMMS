/** Fresh reads on return from a linked ticket/PO, without background polling. */
export const IMPROVEMENT_QUERY_OPTIONS = {
  refetchOnMount: "always",
  refetchOnWindowFocus: "always",
  retry: false,
} as const;

export const IMPROVEMENT_UI_LABELS = {
  ar: {
    retry: "إعادة المحاولة",
    loading: "جارٍ التحميل…",
    loadError: "تعذر تحميل البيانات. أعد المحاولة.",
    refreshError: "تم الحفظ، لكن تعذر تحديث العرض. أعد المحاولة.",
    uploadWaiting: "انتظر اكتمال رفع الصور قبل الحفظ.",
    uploadFailed: "تعذر رفع بعض الصور. أعد رفعها أو احذفها قبل الحفظ.",
    savedAttachmentsPending:
      "حُفظت الفكرة، لكن تعذر ربط بعض الصور. أعد محاولة ربط الصور؛ لن تُنشأ فكرة أخرى.",
    retryAttachments: "إعادة ربط الصور المتبقية",
    saving: "جارٍ الحفظ…",
    unknownStatus: "حالة غير معروفة",
    automaticProgress: "نسبة الإنجاز من مستندات التنفيذ",
  },
  en: {
    retry: "Retry",
    loading: "Loading…",
    loadError: "Could not load the data. Please retry.",
    refreshError: "Saved, but the view could not refresh. Please retry.",
    uploadWaiting: "Wait for the images to finish uploading before saving.",
    uploadFailed:
      "Some images failed to upload. Retry or remove them before saving.",
    savedAttachmentsPending:
      "The idea was saved, but some images could not be linked. Retry the remaining images; another idea will not be created.",
    retryAttachments: "Retry remaining images",
    saving: "Saving…",
    unknownStatus: "Unknown status",
    automaticProgress: "Progress from execution documents",
  },
  ur: {
    retry: "دوبارہ کوشش کریں",
    loading: "لوڈ ہو رہا ہے…",
    loadError: "معلومات لوڈ نہیں ہو سکیں۔ دوبارہ کوشش کریں۔",
    refreshError: "محفوظ ہوگیا، مگر منظر تازہ نہیں ہوسکا۔ دوبارہ کوشش کریں۔",
    uploadWaiting: "محفوظ کرنے سے پہلے تصاویر کا اپ لوڈ مکمل ہونے دیں۔",
    uploadFailed:
      "کچھ تصاویر اپ لوڈ نہیں ہوئیں۔ دوبارہ اپ لوڈ کریں یا محفوظ کرنے سے پہلے ہٹائیں۔",
    savedAttachmentsPending:
      "خیال محفوظ ہوگیا، مگر کچھ تصاویر منسلک نہیں ہوئیں۔ باقی تصاویر دوبارہ منسلک کریں؛ نیا خیال نہیں بنے گا۔",
    retryAttachments: "باقی تصاویر دوبارہ منسلک کریں",
    saving: "محفوظ ہو رہا ہے…",
    unknownStatus: "نامعلوم حالت",
    automaticProgress: "عملدرآمد دستاویزات سے پیش رفت",
  },
} as const;

type ImprovementCache = {
  improvementIdeas: { invalidate: () => Promise<unknown> };
  attachments: {
    list: {
      invalidate: (input: {
        entityType: string;
        entityId: number;
      }) => Promise<unknown>;
    };
  };
};

/** A cache refresh failure must never turn an already committed save into a failed save. */
export async function refreshImprovementViews(
  utils: ImprovementCache,
  ideaId?: number
): Promise<boolean> {
  const reads = [
    Promise.resolve().then(() => utils.improvementIdeas.invalidate()),
  ];
  if (ideaId !== undefined)
    reads.push(
      Promise.resolve().then(() =>
        utils.attachments.list.invalidate({
          entityType: "improvement_idea",
          entityId: ideaId,
        })
      )
    );
  return (await Promise.allSettled(reads)).every(
    result => result.status === "fulfilled"
  );
}

type CreatedIdea = { id: number; requestNumber: string };
export type ImprovementSaveSession<Attachment> = {
  created: CreatedIdea | null;
  remaining: Attachment[];
  saving: boolean;
};
export function newImprovementSaveSession<
  Attachment,
>(): ImprovementSaveSession<Attachment> {
  return { created: null, remaining: [], saving: false };
}

/** Preserve the committed idea ID before attaching files; retries never create another idea. */
export async function saveIdeaWithAttachments<Input, Attachment>(
  session: ImprovementSaveSession<Attachment>,
  input: Input,
  attachments: Attachment[],
  ports: {
    create: (input: Input) => Promise<CreatedIdea>;
    attach: (ideaId: number, attachment: Attachment) => Promise<unknown>;
  }
): Promise<"busy" | "complete" | "partial"> {
  if (session.saving) return "busy";
  session.saving = true;
  try {
    if (!session.created) {
      session.created = await ports.create(input);
      session.remaining = [...attachments];
    }
    const failed: Attachment[] = [];
    for (const attachment of session.remaining) {
      try {
        await ports.attach(session.created.id, attachment);
      } catch {
        failed.push(attachment);
      }
    }
    session.remaining = failed;
    return failed.length ? "partial" : "complete";
  } finally {
    session.saving = false;
  }
}

export function improvementDocumentStatus(
  labels: Record<string, string>,
  status: string | null | undefined,
  unknown: string
): string {
  return status ? labels[status] || unknown : "—";
}

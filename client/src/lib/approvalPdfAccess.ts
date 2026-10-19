export type ApprovalPdfPermission = {
  pdfAllowed?: boolean;
  pdfBlockedReason?: string | null;
};

/** Server-issued permission for this exact document scope, never a header-status guess. */
export function canOpenApprovalPdf(role: string | null | undefined, permission?: ApprovalPdfPermission | null) {
  if (role === "observer") return false;
  if (role === "accountant" || role === "senior_management") return permission?.pdfAllowed === true;
  return permission?.pdfAllowed !== false;
}

export function approvalPdfNotice(language = "ar") {
  if (language === "en") return "Review the transaction data here. PDF viewing and download are available after your approval.";
  if (language === "ur") return "یہاں معاملے کی معلومات کا جائزہ لیں۔ آپ کی منظوری کے بعد PDF دیکھنا اور ڈاؤن لوڈ کرنا دستیاب ہوگا۔";
  return "يمكنك مراجعة بيانات المعاملة هنا. يُتاح عرض PDF وتنزيله بعد اعتمادك.";
}

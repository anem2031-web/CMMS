/** Server embeds the frozen signature as image bytes for browser print and PDF.
 * Reject arbitrary URLs/markup; an absent or unreadable signature stays blank.
 */
export function documentSignatureHtml(dataUrl: string | null | undefined): string {
  if (!dataUrl || !/^data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=\r\n]+$/i.test(dataUrl)) return "";
  return `<div class="document-signature"><img src="${dataUrl}" alt="" style="display:block;margin:6px auto 0;max-width:140px;height:58px;object-fit:contain" /></div>`;
}

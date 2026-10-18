/** Download the server's frozen document without embedding it in a CSP-blocked frame. */
export function downloadPricingBundlePdf(document: { name: string; content: string }) {
  const bytes = Uint8Array.from(atob(document.content), char => char.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download = document.name;
  anchor.hidden = true;
  try {
    window.document.body.appendChild(anchor);
    anchor.click();
  } finally {
    anchor.remove();
    // Allow the browser to start the download before releasing the Blob URL.
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}

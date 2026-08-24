interface DownloadReportFileOptions {
  endpoint: string;
  fallbackFilename: string;
  params?: Record<string, string | number | boolean | null | undefined>;
}

function buildReportUrl(endpoint: string, params?: DownloadReportFileOptions["params"]) {
  const url = new URL(endpoint, window.location.origin);
  for (const [key, value] of Object.entries(params || {})) {
    if (value === undefined || value === null || value === "") continue;
    url.searchParams.set(key, String(value));
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

function filenameFromDisposition(disposition: string | null) {
  if (!disposition) return null;
  const utf8 = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8?.[1]) {
    try { return decodeURIComponent(utf8[1]); } catch { return utf8[1]; }
  }
  const plain = disposition.match(/filename="?([^";]+)"?/i);
  return plain?.[1] || null;
}

/**
 * Shared downloader for Phase 6 report export endpoints.
 * Report-specific endpoints remain responsible for authorization and for honoring filters.
 */
export async function downloadReportFile({ endpoint, fallbackFilename, params }: DownloadReportFileOptions) {
  const response = await fetch(buildReportUrl(endpoint, params), {
    method: "GET",
    credentials: "include",
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || `Report export failed (${response.status})`);
  }

  const blob = await response.blob();
  const filename = filenameFromDisposition(response.headers.get("content-disposition")) || fallbackFilename;
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

/** Opens an authenticated same-origin print endpoint in a new tab/window. */
export function openReportPrintView(endpoint: string, params?: DownloadReportFileOptions["params"]) {
  window.open(buildReportUrl(endpoint, params), "_blank", "noopener,noreferrer");
}

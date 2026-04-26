/**
 * Converts any iDrive/S3 URL or file key into a proxied /api/media URL
 * that is served through our own server (avoids iDrive redirect issues).
 */
export function mediaUrl(urlOrKey: string | null | undefined): string {
  if (!urlOrKey) return "";

  // Already a proxy URL — return as-is
  if (urlOrKey.startsWith("/api/media")) return urlOrKey;

  // If it's a full S3/iDrive URL, extract the key after the bucket name
  const s3Match = urlOrKey.match(/idrivee2\.com\/[^/]+\/(.+)$/);
  if (s3Match) {
    return `/api/media?key=${encodeURIComponent(s3Match[1])}`;
  }

  // If it already looks like a path key (e.g. "cmms/uploads/xxx.webp")
  if (urlOrKey.startsWith("cmms/") || urlOrKey.startsWith("uploads/")) {
    return `/api/media?key=${encodeURIComponent(urlOrKey)}`;
  }

  // Bare filename key (legacy: stored without path prefix)
  if (!urlOrKey.startsWith("http") && !urlOrKey.startsWith("/")) {
    return `/api/media?key=${encodeURIComponent(`cmms/uploads/${urlOrKey}`)}`;
  }

  // Fallback: return original URL
  return urlOrKey;
}

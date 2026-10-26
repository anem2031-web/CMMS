export type DatabaseSslMode = "verify" | "disable";

/**
 * Keep TLS policy out of DATABASE_URL. mysql2 treats a JSON value in the
 * `ssl` query parameter as a named SSL profile, so legacy URL parameters are
 * removed and the verified TLS object is supplied explicitly instead.
 */
export function databaseConnectionOptions(rawUrl: string, sslMode: DatabaseSslMode) {
  const url = new URL(rawUrl);
  url.searchParams.delete("ssl");
  url.searchParams.delete("ssl-mode");
  url.searchParams.delete("sslmode");

  return {
    uri: url.toString(),
    ssl: sslMode === "disable"
      ? undefined
      : { rejectUnauthorized: true, minVersion: "TLSv1.2" as const },
  };
}

export function assertDatabaseSslPolicy(sslMode: DatabaseSslMode, nodeEnv: string) {
  if (nodeEnv === "production" && sslMode === "disable") {
    throw new Error("DATABASE_SSL_MODE=disable is forbidden in production");
  }
}

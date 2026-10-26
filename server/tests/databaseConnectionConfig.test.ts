import { describe, expect, it } from "vitest";
import {
  assertDatabaseSslPolicy,
  databaseConnectionOptions,
} from "../_core/db/connection-config";
import fs from "node:fs";
import path from "node:path";

describe("database connection TLS policy", () => {
  it("uses verified TLS and removes legacy URL SSL parameters", () => {
    const result = databaseConnectionOptions(
      'mysql://user:pass@example.test:4000/cmms?ssl={"rejectUnauthorized":true}&x=1',
      "verify",
    );
    expect(result.uri).toContain("x=1");
    expect(result.uri).not.toContain("ssl=");
    expect(result.ssl).toEqual({ rejectUnauthorized: true, minVersion: "TLSv1.2" });
  });

  it("allows an explicit unencrypted local mode but forbids it in production", () => {
    expect(databaseConnectionOptions("mysql://user:pass@localhost:3306/cmms", "disable").ssl).toBeUndefined();
    expect(() => assertDatabaseSslPolicy("disable", "production")).toThrow(/forbidden/);
    expect(() => assertDatabaseSslPolicy("verify", "production")).not.toThrow();
  });

  it("verifies a real connection before publishing readiness and gates background jobs", () => {
    const dbClient = fs.readFileSync(path.resolve("server/_core/db/client.ts"), "utf8");
    const serverEntry = fs.readFileSync(path.resolve("server/_core/index.ts"), "utf8");

    expect(dbClient).toContain('await candidatePool.query("SELECT 1")');
    expect(dbClient.indexOf('await candidatePool.query("SELECT 1")'))
      .toBeLessThan(dbClient.indexOf("_pool = candidatePool"));
    expect(serverEntry).toContain("void startBackgroundJobsWhenDatabaseReady()");
    expect(serverEntry).toContain("if (backgroundJobsStarted) return");
    expect(serverEntry).toContain("scheduleBackgroundJobs()");
  });
});

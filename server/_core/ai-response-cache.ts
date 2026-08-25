import { createHash } from "node:crypto";
import { and, eq, gt, sql } from "drizzle-orm";
import { aiResponseCache } from "../../drizzle/schema";
import { getDb } from "./db";

const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const inFlight = new Map<string, Promise<unknown>>();
const memoryCache = new Map<string, { value: unknown; expiresAt: number }>();
let warnedCacheUnavailable = false;

export type AiCacheSource = "memory_cache" | "persistent_cache" | "inflight_dedupe" | "producer";

export interface AiCachedResult<T> {
  value: T;
  source: AiCacheSource;
  cacheKey: string;
}

function stableSerialize(value: unknown): string {
  if (value === undefined) return "__undefined__";
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "__undefined__";
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map(key => `${JSON.stringify(key)}:${stableSerialize(record[key])}`)
    .join(",")}}`;
}

export function buildAiResponseCacheKey(params: {
  feature: string;
  operation: string;
  cacheVersion: string;
  input: unknown;
}): string {
  return createHash("sha256")
    .update(stableSerialize(params))
    .digest("hex");
}

function mysqlTimestamp(date: Date): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function cacheTableUnavailable(error: unknown): boolean {
  const err = error as any;
  return err?.code === "ER_NO_SUCH_TABLE" || /ai_response_cache/i.test(String(err?.message || ""));
}

async function readPersistentCache<T>(cacheKey: string): Promise<T | null> {
  try {
    const db = await getDb();
    if (!db) return null;

    const rows = await db
      .select({
        responsePayload: aiResponseCache.responsePayload,
        expiresAt: aiResponseCache.expiresAt,
      })
      .from(aiResponseCache)
      .where(and(
        eq(aiResponseCache.cacheKey, cacheKey),
        gt(aiResponseCache.expiresAt, sql`CURRENT_TIMESTAMP`),
      ))
      .limit(1);

    const row = rows[0] as any;
    if (!row) return null;

    // Cache accounting is intentionally best-effort. A failed counter update must
    // never turn a valid cached AI result into a user-facing failure.
    void db
      .update(aiResponseCache)
      .set({
        hitCount: sql`${aiResponseCache.hitCount} + 1`,
        lastHitAt: mysqlTimestamp(new Date()),
      } as any)
      .where(eq(aiResponseCache.cacheKey, cacheKey))
      .catch(() => undefined);

    return row.responsePayload as T;
  } catch (error) {
    if (cacheTableUnavailable(error)) {
      if (!warnedCacheUnavailable) {
        warnedCacheUnavailable = true;
        console.warn("[AI Cache] ai_response_cache is unavailable; continuing without persistent cache");
      }
      return null;
    }
    console.warn("[AI Cache] Persistent cache read failed; continuing without cache", error);
    return null;
  }
}

async function writePersistentCache(params: {
  cacheKey: string;
  feature: string;
  operation: string;
  cacheVersion: string;
  value: unknown;
  ttlMs: number;
}): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;

    const expiresAt = mysqlTimestamp(new Date(Date.now() + params.ttlMs));
    await db
      .insert(aiResponseCache)
      .values({
        cacheKey: params.cacheKey,
        feature: params.feature,
        operation: params.operation,
        cacheVersion: params.cacheVersion,
        responsePayload: params.value as any,
        hitCount: 0,
        expiresAt,
      } as any)
      .onDuplicateKeyUpdate({
        set: {
          feature: params.feature,
          operation: params.operation,
          cacheVersion: params.cacheVersion,
          responsePayload: params.value as any,
          expiresAt,
          updatedAt: mysqlTimestamp(new Date()),
        } as any,
      });
  } catch (error) {
    if (cacheTableUnavailable(error)) return;
    console.warn("[AI Cache] Persistent cache write failed; AI result will still be returned", error);
  }
}

/**
 * Persistent + in-flight cache wrapper for deterministic AI prompts.
 *
 * The caller controls cacheVersion. Bump it whenever the prompt contract or
 * parsing semantics change. Exact input is hashed, so catalog candidate changes
 * naturally invalidate rerank entries without a broad cache purge.
 */
export async function withAiResponseCache<T>(params: {
  feature: string;
  operation: string;
  cacheVersion: string;
  input: unknown;
  producer: () => Promise<T>;
  ttlMs?: number;
}): Promise<AiCachedResult<T>> {
  const cacheKey = buildAiResponseCacheKey({
    feature: params.feature,
    operation: params.operation,
    cacheVersion: params.cacheVersion,
    input: params.input,
  });
  const memory = memoryCache.get(cacheKey);
  if (memory) {
    if (memory.expiresAt > Date.now()) {
      return { value: memory.value as T, source: "memory_cache", cacheKey };
    }
    memoryCache.delete(cacheKey);
  }

  const cached = await readPersistentCache<T>(cacheKey);
  if (cached !== null) {
    return { value: cached, source: "persistent_cache", cacheKey };
  }

  const existing = inFlight.get(cacheKey) as Promise<T> | undefined;
  if (existing) {
    return { value: await existing, source: "inflight_dedupe", cacheKey };
  }

  const promise = (async () => {
    const value = await params.producer();
    const ttlMs = params.ttlMs ?? DEFAULT_TTL_MS;
    memoryCache.set(cacheKey, { value, expiresAt: Date.now() + ttlMs });
    await writePersistentCache({
      cacheKey,
      feature: params.feature,
      operation: params.operation,
      cacheVersion: params.cacheVersion,
      value,
      ttlMs,
    });
    return value;
  })();

  inFlight.set(cacheKey, promise);
  try {
    return { value: await promise, source: "producer", cacheKey };
  } finally {
    if (inFlight.get(cacheKey) === promise) inFlight.delete(cacheKey);
  }
}

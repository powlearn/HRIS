/**
 * In-memory sliding-window rate limiter.
 *
 * Suitable for a single Node instance (development, small deployments). For
 * horizontally scaled deployments, swap the `store` for Redis/Upstash keyed by
 * the same identifiers — the interface is intentionally small.
 */
type Bucket = { timestamps: number[] };

const store = new Map<string, Bucket>();
let lastSweep = Date.now();

export type RateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
};

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  if (now - lastSweep > 60_000) {
    for (const [k, bucket] of store.entries()) {
      if (bucket.timestamps.every((t) => now - t > windowMs)) store.delete(k);
    }
    lastSweep = now;
  }
  const bucket = store.get(key) ?? { timestamps: [] };
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);
  const success = bucket.timestamps.length < limit;
  if (success) bucket.timestamps.push(now);
  store.set(key, bucket);
  const oldest = bucket.timestamps[0] ?? now;
  const resetAt = oldest + windowMs;
  return {
    success,
    limit,
    remaining: Math.max(0, limit - bucket.timestamps.length),
    resetAt,
    retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1000)),
  };
}

export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return headers.get("x-real-ip") ?? "unknown";
}

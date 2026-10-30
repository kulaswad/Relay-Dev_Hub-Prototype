interface RateLimitState {
  timestamps: number[];
}

const windowStore = new Map<string, RateLimitState>();

// Periodic cleanup of stale keys every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    windowStore.forEach((state, key) => {
      state.timestamps = state.timestamps.filter((ts: number) => now - ts < 60_000);
      if (state.timestamps.length === 0) {
        windowStore.delete(key);
      }
    });
  }, 300_000).unref?.();
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp in seconds
  retryAfter?: number; // Seconds to wait
}

export function checkRateLimit(
  keyId: string,
  limitPerMin: number = 60
): RateLimitResult {
  const now = Date.now();
  const windowMs = 60_000;
  const windowStart = now - windowMs;

  let state = windowStore.get(keyId);
  if (!state) {
    state = { timestamps: [] };
    windowStore.set(keyId, state);
  }

  // Filter timestamps within sliding window
  state.timestamps = state.timestamps.filter((ts) => ts > windowStart);

  const count = state.timestamps.length;
  const remaining = Math.max(0, limitPerMin - count);
  const oldestTimestamp = state.timestamps[0] || now;
  const resetEpochSeconds = Math.ceil((oldestTimestamp + windowMs) / 1000);

  if (count >= limitPerMin) {
    const retryAfterMs = oldestTimestamp + windowMs - now;
    const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));

    return {
      allowed: false,
      limit: limitPerMin,
      remaining: 0,
      reset: resetEpochSeconds,
      retryAfter: retryAfterSeconds,
    };
  }

  // Record this request
  state.timestamps.push(now);

  return {
    allowed: true,
    limit: limitPerMin,
    remaining: Math.max(0, limitPerMin - (count + 1)),
    reset: resetEpochSeconds,
  };
}

export function resetRateLimitForTesting(keyId?: string) {
  if (keyId) {
    windowStore.delete(keyId);
  } else {
    windowStore.clear();
  }
}

export function getRateLimitStatus(keyId: string, limitPerMin: number = 60): { count: number; limit: number; remaining: number; reset: number } {
  const now = Date.now();
  const windowMs = 60_000;
  const windowStart = now - windowMs;
  const state = windowStore.get(keyId);
  const activeTimestamps = state ? state.timestamps.filter((ts) => ts > windowStart) : [];
  return {
    count: activeTimestamps.length,
    limit: limitPerMin,
    remaining: Math.max(0, limitPerMin - activeTimestamps.length),
    reset: activeTimestamps[0] ? Math.ceil((activeTimestamps[0] + windowMs) / 1000) : Math.ceil((now + windowMs) / 1000),
  };
}

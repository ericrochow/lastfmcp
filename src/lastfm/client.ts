import { config } from "../config.js";
import { cacheGet, cacheSet, makeCacheKey, TTL } from "../cache.js";
import type { LastFmErrorResponse } from "./types.js";

export class LastFmError extends Error {
  constructor(
    public readonly code: number,
    message: string
  ) {
    super(`Last.fm error ${code}: ${message}`);
    this.name = "LastFmError";
  }
}

// TTL selection by method prefix
function ttlForMethod(method: string): number {
  if (method.startsWith("user.getRecentTracks")) return TTL.RECENT_TRACKS;
  if (method.startsWith("user.")) return TTL.TOP_USER;
  return TTL.ARTIST_TAG;
}

// Rate-limit queue: serialize requests with 200ms spacing
let queue: Promise<void> = Promise.resolve();

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const result = queue.then(fn);
  // Advance the queue by 200ms after each dispatch, swallowing errors
  queue = result.then(
    () => new Promise((r) => setTimeout(r, 200)),
    () => new Promise((r) => setTimeout(r, 200))
  );
  return result;
}

async function fetchOnce<T>(method: string, params: Record<string, string>): Promise<T> {
  const url = new URL(config.baseUrl);
  url.searchParams.set("method", method);
  url.searchParams.set("api_key", config.apiKey);
  url.searchParams.set("format", "json");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const response = await fetch(url.toString(), {
    headers: { "User-Agent": "lastfmcp/0.1.0 (github.com/lastfmcp/lastfmcp)" },
  });

  if (!response.ok) {
    throw new LastFmError(response.status, `HTTP ${response.status}`);
  }

  const body = (await response.json()) as T | LastFmErrorResponse;

  if (typeof body === "object" && body !== null && "error" in body) {
    const err = body as LastFmErrorResponse;
    throw new LastFmError(err.error, err.message);
  }

  return body as T;
}

export async function lastfmGet<T>(
  method: string,
  params: Record<string, string>
): Promise<T> {
  const key = makeCacheKey(method, params);
  const cached = cacheGet<T>(key);
  if (cached !== undefined) return cached;

  const result = await enqueue(async () => {
    try {
      return await fetchOnce<T>(method, params);
    } catch (err) {
      // Retry once on rate limit (error 29)
      if (err instanceof LastFmError && err.code === 29) {
        await new Promise((r) => setTimeout(r, 1000));
        return fetchOnce<T>(method, params);
      }
      throw err;
    }
  });

  cacheSet(key, result, ttlForMethod(method));
  return result;
}

// Normalize arrays: Last.fm returns a single object when there's only one result
export function toArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

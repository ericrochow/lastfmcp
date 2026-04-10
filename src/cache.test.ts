import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cacheGet, cacheSet, makeCacheKey, TTL } from "./cache.js";

beforeEach(() => {
  // Reset module state between tests by clearing the store via expired entries
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("makeCacheKey", () => {
  it("formats key with method and sorted params", () => {
    const key = makeCacheKey("user.getTopArtists", { user: "rj", period: "1month", limit: "10" });
    expect(key).toBe("lastfm:user.getTopArtists:limit=10:period=1month:user=rj");
  });

  it("sorts params alphabetically regardless of insertion order", () => {
    const a = makeCacheKey("m", { z: "1", a: "2", m: "3" });
    const b = makeCacheKey("m", { a: "2", m: "3", z: "1" });
    expect(a).toBe(b);
  });

  it("handles empty params", () => {
    expect(makeCacheKey("tag.getInfo", {})).toBe("lastfm:tag.getInfo:");
  });
});

describe("cacheGet / cacheSet", () => {
  it("returns undefined for a key that was never set", () => {
    expect(cacheGet("nonexistent")).toBeUndefined();
  });

  it("returns stored data before TTL expires", () => {
    cacheSet("k1", { x: 1 }, 5000);
    expect(cacheGet("k1")).toEqual({ x: 1 });
  });

  it("returns undefined after TTL expires", () => {
    cacheSet("k2", "hello", 1000);
    vi.advanceTimersByTime(1001);
    expect(cacheGet<string>("k2")).toBeUndefined();
  });

  it("returns fresh value after re-set", () => {
    cacheSet("k3", "old", 5000);
    cacheSet("k3", "new", 5000);
    expect(cacheGet<string>("k3")).toBe("new");
  });

  it("evicts expired entry from store on access", () => {
    cacheSet("k4", "data", 100);
    vi.advanceTimersByTime(200);
    expect(cacheGet("k4")).toBeUndefined();
    // Re-set with longer TTL — should be retrievable
    cacheSet("k4", "fresh", 5000);
    expect(cacheGet<string>("k4")).toBe("fresh");
  });
});

describe("TTL constants", () => {
  it("recent tracks TTL is 2 minutes", () => {
    expect(TTL.RECENT_TRACKS).toBe(2 * 60 * 1000);
  });

  it("top user TTL is 10 minutes", () => {
    expect(TTL.TOP_USER).toBe(10 * 60 * 1000);
  });

  it("artist/tag TTL is 60 minutes", () => {
    expect(TTL.ARTIST_TAG).toBe(60 * 60 * 1000);
  });
});

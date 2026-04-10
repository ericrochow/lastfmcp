import { describe, it, expect, vi, beforeAll, afterAll, afterEach, beforeEach } from "vitest";

vi.mock("../config.js", () => ({
  config: {
    apiKey: "test-key",
    defaultUser: "testuser",
    baseUrl: "https://ws.audioscrobbler.com/2.0/",
  },
}));

vi.mock("../cache.js", () => ({
  cacheGet: vi.fn().mockReturnValue(undefined),
  cacheSet: vi.fn(),
  makeCacheKey: vi.fn().mockReturnValue("test-cache-key"),
  TTL: { RECENT_TRACKS: 120000, TOP_USER: 600000, ARTIST_TAG: 3600000 },
}));

import { lastfmGet, toArray, LastFmError } from "./client.js";
import { cacheGet, cacheSet } from "../cache.js";

const mockCacheGet = vi.mocked(cacheGet);
const mockCacheSet = vi.mocked(cacheSet);

// Use fake timers for the entire file so the module-level rate-limit queue
// (which uses setTimeout) doesn't bleed real delays between tests.
beforeAll(() => vi.useFakeTimers());
afterAll(() => vi.useRealTimers());

// After each test, drain any pending 200ms queue delay so the next test starts clean.
afterEach(async () => {
  await vi.runAllTimersAsync();
});

function mockFetch(body: unknown, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    })
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCacheGet.mockReturnValue(undefined);
});

describe("toArray", () => {
  it("returns empty array for undefined", () => {
    expect(toArray(undefined)).toEqual([]);
  });

  it("wraps a single object in an array", () => {
    expect(toArray({ name: "Radiohead" })).toEqual([{ name: "Radiohead" }]);
  });

  it("returns an existing array as-is", () => {
    const arr = [{ name: "A" }, { name: "B" }];
    expect(toArray(arr)).toBe(arr);
  });
});

describe("lastfmGet", () => {
  it("returns parsed response on success", async () => {
    mockFetch({ artists: ["Radiohead"] });
    const promise = lastfmGet("artist.getSimilar", { artist: "Radiohead" });
    await vi.runAllTimersAsync();
    expect(await promise).toEqual({ artists: ["Radiohead"] });
  });

  it("returns cached value without fetching", async () => {
    mockCacheGet.mockReturnValue({ cached: true });
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const result = await lastfmGet("user.getTopArtists", { user: "rj" });
    expect(result).toEqual({ cached: true });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("stores result in cache after fetch", async () => {
    mockFetch({ data: 42 });
    const promise = lastfmGet("user.getTopArtists", { user: "rj" });
    await vi.runAllTimersAsync();
    await promise;
    expect(mockCacheSet).toHaveBeenCalledWith("test-cache-key", { data: 42 }, expect.any(Number));
  });

  it("throws LastFmError for Last.fm error body", async () => {
    mockFetch({ error: 6, message: "Artist not found" });
    const promise = lastfmGet("artist.getInfo", { artist: "???" });
    // Attach rejection handler BEFORE advancing timers to avoid unhandled-rejection warning
    const expectation = expect(promise).rejects.toThrow("Last.fm error 6: Artist not found");
    await vi.runAllTimersAsync();
    await expectation;
  });

  it("throws LastFmError for HTTP error", async () => {
    mockFetch({}, 500);
    const promise = lastfmGet("artist.getInfo", { artist: "test" });
    const expectation = expect(promise).rejects.toThrow("Last.fm error 500");
    await vi.runAllTimersAsync();
    await expectation;
  });

  it("retries once on rate limit error (code 29)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ error: 29, message: "Rate limit exceeded" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ name: "Radiohead" }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const promise = lastfmGet("artist.getInfo", { artist: "Radiohead" });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ name: "Radiohead" });
  });

  it("does not retry on non-rate-limit errors", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ error: 6, message: "Artist not found" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const promise = lastfmGet("artist.getInfo", { artist: "???" });
    const expectation = expect(promise).rejects.toThrow("Last.fm error 6");
    await vi.runAllTimersAsync();
    await expectation;
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("includes api_key, format=json, and method in request URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ ok: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const promise = lastfmGet("artist.getInfo", { artist: "Radiohead" });
    await vi.runAllTimersAsync();
    await promise;

    const calledUrl: string = fetchMock.mock.calls[0][0];
    expect(calledUrl).toContain("api_key=test-key");
    expect(calledUrl).toContain("format=json");
    expect(calledUrl).toContain("method=artist.getInfo");
  });
});

describe("LastFmError", () => {
  it("includes code and message", () => {
    const err = new LastFmError(10, "Invalid API key");
    expect(err.code).toBe(10);
    expect(err.message).toBe("Last.fm error 10: Invalid API key");
    expect(err.name).toBe("LastFmError");
  });

  it("is instanceof Error", () => {
    expect(new LastFmError(6, "Not found")).toBeInstanceOf(Error);
  });
});

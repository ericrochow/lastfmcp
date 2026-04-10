import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lastfm/user.js", () => ({
  getTopArtists: vi.fn(),
  getTopTags: vi.fn(),
}));

vi.mock("../lastfm/artist.js", () => ({
  getSimilarArtists: vi.fn(),
  getArtistTopTags: vi.fn(),
}));

// defaultUser is empty so we can test both the "user provided" and "no user" paths.
vi.mock("../config.js", () => ({
  config: { apiKey: "test-key", defaultUser: "", baseUrl: "https://ws.audioscrobbler.com/2.0/" },
}));

import { getTopArtists, getTopTags } from "../lastfm/user.js";
import { getSimilarArtists, getArtistTopTags } from "../lastfm/artist.js";
import { registerRecommendationsTool } from "./recommendations.js";

const mockGetTopArtists = vi.mocked(getTopArtists);
const mockGetTopTags = vi.mocked(getTopTags);
const mockGetSimilarArtists = vi.mocked(getSimilarArtists);
const mockGetArtistTopTags = vi.mocked(getArtistTopTags);

function makeServer() {
  let handler: Function;
  const server = {
    registerTool: vi.fn((_name: string, _opts: unknown, h: Function) => { handler = h; }),
    getHandler: () => handler,
  };
  return server;
}

const defaultInput = {
  user: "testuser",
  period: "1month" as const,
  seed_artist_count: 2,
  similar_per_seed: 3,
  max_candidates: 10,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetTopArtists.mockResolvedValue({
    artists: [
      { rank: 1, name: "Radiohead", playcount: 500 },
      { rank: 2, name: "Portishead", playcount: 300 },
    ],
    total: 2,
  });
  mockGetTopTags.mockResolvedValue(["alternative rock", "electronic"]);
  mockGetSimilarArtists.mockImplementation(async (artist) => {
    if (artist === "Radiohead") return [{ name: "Thom Yorke", match: 0.9 }, { name: "Caribou", match: 0.7 }];
    if (artist === "Portishead") return [{ name: "Massive Attack", match: 0.85 }, { name: "Caribou", match: 0.6 }];
    return [];
  });
  mockGetArtistTopTags.mockResolvedValue(["electronic", "trip-hop"]);
});

describe("get_recommendations tool", () => {
  it("registers with the correct name", () => {
    const server = makeServer();
    registerRecommendationsTool(server as any);
    expect(server.registerTool).toHaveBeenCalledWith("get_recommendations", expect.any(Object), expect.any(Function));
  });

  it("returns candidates excluding known artists", async () => {
    const server = makeServer();
    registerRecommendationsTool(server as any);

    const result = await server.getHandler()({ ...defaultInput });
    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);

    const names = data.candidates.map((c: any) => c.name);
    expect(names).not.toContain("Radiohead");
    expect(names).not.toContain("Portishead");
    expect(names).toContain("Thom Yorke");
    expect(names).toContain("Massive Attack");
  });

  it("deduplicates candidates triggered by multiple seeds", async () => {
    const server = makeServer();
    registerRecommendationsTool(server as any);

    const result = await server.getHandler()({ ...defaultInput });
    const data = JSON.parse(result.content[0].text);

    const caribou = data.candidates.find((c: any) => c.name === "Caribou");
    expect(caribou).toBeDefined();
    // Triggered by both seeds, should have both in triggeredBy
    expect(caribou.triggeredBy).toContain("Radiohead");
    expect(caribou.triggeredBy).toContain("Portishead");
    // Max similarity from either seed
    expect(caribou.maxSimilarity).toBe(0.7);
  });

  it("keeps highest similarity when deduplicating", async () => {
    const server = makeServer();
    registerRecommendationsTool(server as any);

    const result = await server.getHandler()({ ...defaultInput });
    const data = JSON.parse(result.content[0].text);

    const thom = data.candidates.find((c: any) => c.name === "Thom Yorke");
    expect(thom.maxSimilarity).toBe(0.9);
  });

  it("sorts candidates by similarity descending", async () => {
    const server = makeServer();
    registerRecommendationsTool(server as any);

    const result = await server.getHandler()({ ...defaultInput });
    const data = JSON.parse(result.content[0].text);

    const similarities: number[] = data.candidates.map((c: any) => c.maxSimilarity);
    const sorted = [...similarities].sort((a, b) => b - a);
    expect(similarities).toEqual(sorted);
  });

  it("includes shared tags in candidate output", async () => {
    const server = makeServer();
    registerRecommendationsTool(server as any);

    const result = await server.getHandler()({ ...defaultInput });
    const data = JSON.parse(result.content[0].text);

    // All candidates should have sharedTags array
    for (const candidate of data.candidates) {
      expect(Array.isArray(candidate.sharedTags)).toBe(true);
    }
  });

  it("includes a note field instructing LLM to reason over results", async () => {
    const server = makeServer();
    registerRecommendationsTool(server as any);

    const result = await server.getHandler()({ ...defaultInput });
    const data = JSON.parse(result.content[0].text);
    expect(data.note).toBeTruthy();
  });

  it("uses provided user over default", async () => {
    const server = makeServer();
    registerRecommendationsTool(server as any);

    await server.getHandler()({ ...defaultInput, user: "alice" });
    expect(mockGetTopArtists).toHaveBeenCalledWith("alice", "1month", 2);
  });

  it("returns error when no user and no default configured", async () => {
    // defaultUser is "" per the module-level mock; explicitly omit user from input
    const server = makeServer();
    registerRecommendationsTool(server as any);

    const { user: _omit, ...inputWithoutUser } = defaultInput;
    const result = await server.getHandler()(inputWithoutUser);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("No username");
  });

  it("handles getSimilarArtists failure gracefully (skips seed)", async () => {
    const server = makeServer();
    registerRecommendationsTool(server as any);
    mockGetSimilarArtists.mockImplementation(async (artist) => {
      if (artist === "Radiohead") throw new Error("network error");
      return [{ name: "Massive Attack", match: 0.85 }];
    });

    const result = await server.getHandler()({ ...defaultInput });
    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    // Should still return candidates from the non-failing seed
    expect(data.candidates.some((c: any) => c.name === "Massive Attack")).toBe(true);
  });

  it("returns isError on top-level failure", async () => {
    const server = makeServer();
    registerRecommendationsTool(server as any);
    mockGetTopArtists.mockRejectedValue(new Error("Last.fm error 6: User not found"));

    const result = await server.getHandler()({ ...defaultInput });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("User not found");
  });
});

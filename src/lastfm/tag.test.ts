import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./client.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./client.js")>();
  return { ...actual, lastfmGet: vi.fn() };
});

import { lastfmGet } from "./client.js";
import { getTagInfo } from "./tag.js";

const mockLastfmGet = vi.mocked(lastfmGet);

beforeEach(() => vi.clearAllMocks());

const tagInfoResponse = {
  tag: {
    name: "post-rock",
    reach: "85000",
    taggings: "2300000",
    wiki: { summary: "Post-rock is a style of rock. <a href='x'>Read more on Wikipedia</a>" },
  },
};

const tagArtistsResponse = {
  topartists: {
    artist: [
      { name: "Explosions in the Sky", "@attr": { rank: "1" } },
      { name: "Godspeed You! Black Emperor", "@attr": { rank: "2" } },
    ],
    "@attr": { tag: "post-rock", total: "2" },
  },
};

describe("getTagInfo", () => {
  it("returns tag metadata with top artists", async () => {
    mockLastfmGet
      .mockResolvedValueOnce(tagInfoResponse)
      .mockResolvedValueOnce(tagArtistsResponse);

    const info = await getTagInfo("post-rock", true, 2);
    expect(info.tag).toBe("post-rock");
    expect(info.reach).toBe(85000);
    expect(info.taggings).toBe(2300000);
    expect(info.topArtists).toEqual([
      { rank: 1, name: "Explosions in the Sky" },
      { rank: 2, name: "Godspeed You! Black Emperor" },
    ]);
  });

  it("strips HTML from wiki summary", async () => {
    mockLastfmGet
      .mockResolvedValueOnce(tagInfoResponse)
      .mockResolvedValueOnce(tagArtistsResponse);

    const info = await getTagInfo("post-rock");
    expect(info.wikiSummary).not.toContain("<a");
    expect(info.wikiSummary).toContain("Post-rock is a style of rock.");
  });

  it("truncates wiki summary to 500 characters", async () => {
    const longSummary = "y".repeat(600);
    mockLastfmGet
      .mockResolvedValueOnce({ tag: { ...tagInfoResponse.tag, wiki: { summary: longSummary } } })
      .mockResolvedValueOnce(tagArtistsResponse);

    const info = await getTagInfo("post-rock");
    expect(info.wikiSummary.length).toBeLessThanOrEqual(500);
  });

  it("omits topArtists when include_top_artists is false", async () => {
    mockLastfmGet.mockResolvedValueOnce(tagInfoResponse);

    const info = await getTagInfo("post-rock", false);
    expect(info.topArtists).toBeUndefined();
    expect(mockLastfmGet).toHaveBeenCalledTimes(1);
  });

  it("handles missing wiki gracefully", async () => {
    mockLastfmGet
      .mockResolvedValueOnce({ tag: { name: "rare-tag", reach: "10", taggings: "100" } })
      .mockResolvedValueOnce({ topartists: { artist: [], "@attr": { tag: "rare-tag", total: "0" } } });

    const info = await getTagInfo("rare-tag");
    expect(info.wikiSummary).toBe("");
  });

  it("wraps single artist in array", async () => {
    mockLastfmGet
      .mockResolvedValueOnce(tagInfoResponse)
      .mockResolvedValueOnce({
        topartists: {
          artist: { name: "Mogwai", "@attr": { rank: "1" } },
          "@attr": { tag: "post-rock", total: "1" },
        },
      });

    const info = await getTagInfo("post-rock");
    expect(info.topArtists).toHaveLength(1);
    expect(info.topArtists![0].name).toBe("Mogwai");
  });
});

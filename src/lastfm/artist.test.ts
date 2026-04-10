import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./client.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./client.js")>();
  return { ...actual, lastfmGet: vi.fn() };
});

import { lastfmGet } from "./client.js";
import { getArtistInfo, getSimilarArtists, getArtistTopTags } from "./artist.js";

const mockLastfmGet = vi.mocked(lastfmGet);

const artistInfoResponse = {
  artist: {
    name: "Radiohead",
    stats: { listeners: "6200000", playcount: "450000000" },
    bio: {
      summary: "Radiohead are an English rock band. <a href='x'>Read more</a>",
      content: "Long content...",
    },
    tags: { tag: [{ name: "alternative rock" }, { name: "art rock" }] },
    similar: {
      artist: [
        { name: "Thom Yorke", match: "0.91" },
        { name: "Portishead", match: "0.78" },
      ],
    },
    url: "https://www.last.fm/music/Radiohead",
  },
};

beforeEach(() => vi.clearAllMocks());

describe("getArtistInfo", () => {
  it("maps all fields correctly", async () => {
    mockLastfmGet.mockResolvedValue(artistInfoResponse);

    const info = await getArtistInfo("Radiohead");
    expect(info.name).toBe("Radiohead");
    expect(info.listeners).toBe(6200000);
    expect(info.playcount).toBe(450000000);
    expect(info.topTags).toEqual(["alternative rock", "art rock"]);
    expect(info.similarArtists).toEqual([
      { name: "Thom Yorke", match: 0.91 },
      { name: "Portishead", match: 0.78 },
    ]);
    expect(info.url).toBe("https://www.last.fm/music/Radiohead");
  });

  it("strips HTML tags from bio summary", async () => {
    mockLastfmGet.mockResolvedValue(artistInfoResponse);
    const info = await getArtistInfo("Radiohead");
    expect(info.bioSummary).not.toContain("<a");
    expect(info.bioSummary).not.toContain("</a>");
    expect(info.bioSummary).toContain("Radiohead are an English rock band.");
  });

  it("truncates bio summary to 500 characters", async () => {
    const longBio = "x".repeat(600);
    mockLastfmGet.mockResolvedValue({
      artist: { ...artistInfoResponse.artist, bio: { summary: longBio, content: longBio } },
    });
    const info = await getArtistInfo("Radiohead");
    expect(info.bioSummary.length).toBeLessThanOrEqual(500);
  });

  it("returns empty similarArtists when include_similar is false", async () => {
    mockLastfmGet.mockResolvedValue(artistInfoResponse);
    const info = await getArtistInfo("Radiohead", false);
    expect(info.similarArtists).toEqual([]);
  });

  it("includes top tracks when include_top_tracks is true", async () => {
    mockLastfmGet
      .mockResolvedValueOnce(artistInfoResponse)
      .mockResolvedValueOnce({
        toptracks: {
          track: [{ name: "Paranoid Android", playcount: "5000", "@attr": { rank: "1" } }],
        },
      });

    const info = await getArtistInfo("Radiohead", true, true);
    expect(info.topTracks).toEqual(["Paranoid Android"]);
  });

  it("does not fetch top tracks when include_top_tracks is false", async () => {
    mockLastfmGet.mockResolvedValue(artistInfoResponse);
    await getArtistInfo("Radiohead", true, false);
    expect(mockLastfmGet).toHaveBeenCalledTimes(1);
  });

  it("uses fallback URL when url is missing from response", async () => {
    const noUrl = { artist: { ...artistInfoResponse.artist, url: undefined } };
    mockLastfmGet.mockResolvedValue(noUrl);
    const info = await getArtistInfo("Radiohead");
    expect(info.url).toContain("last.fm/music");
  });
});

describe("getSimilarArtists", () => {
  it("returns artists with parsed match scores", async () => {
    mockLastfmGet.mockResolvedValue({
      similarartists: {
        artist: [
          { name: "Thom Yorke", match: "0.91", url: "https://last.fm/music/Thom+Yorke" },
          { name: "Portishead", match: "0.78" },
        ],
        "@attr": { artist: "Radiohead" },
      },
    });

    const similar = await getSimilarArtists("Radiohead", 2);
    expect(similar).toHaveLength(2);
    expect(similar[0]).toEqual({ name: "Thom Yorke", match: 0.91 });
    expect(similar[1]).toEqual({ name: "Portishead", match: 0.78 });
  });

  it("wraps single similar artist in array", async () => {
    mockLastfmGet.mockResolvedValue({
      similarartists: {
        artist: { name: "Thom Yorke", match: "0.9" },
        "@attr": { artist: "Radiohead" },
      },
    });
    const similar = await getSimilarArtists("Radiohead");
    expect(similar).toHaveLength(1);
  });

  it("returns empty array when no similar artists", async () => {
    mockLastfmGet.mockResolvedValue({
      similarartists: { artist: [], "@attr": { artist: "obscure" } },
    });
    expect(await getSimilarArtists("obscure")).toEqual([]);
  });
});

describe("getArtistTopTags", () => {
  it("returns tag names lowercased", async () => {
    mockLastfmGet.mockResolvedValue({
      toptags: {
        tag: [{ name: "Art Rock", count: 10 }, { name: "Electronic", count: 8 }],
        "@attr": { artist: "Radiohead" },
      },
    });
    const tags = await getArtistTopTags("Radiohead");
    expect(tags).toEqual(["art rock", "electronic"]);
  });

  it("wraps single tag in array", async () => {
    mockLastfmGet.mockResolvedValue({
      toptags: { tag: { name: "Rock", count: 5 }, "@attr": { artist: "Radiohead" } },
    });
    expect(await getArtistTopTags("Radiohead")).toEqual(["rock"]);
  });
});

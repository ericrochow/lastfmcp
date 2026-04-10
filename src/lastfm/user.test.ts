import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./client.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./client.js")>();
  return { ...actual, lastfmGet: vi.fn() };
});

import { lastfmGet } from "./client.js";
import { getRecentTracks, getTopArtists, getTopTracks, getTopTags } from "./user.js";

const mockLastfmGet = vi.mocked(lastfmGet);

beforeEach(() => vi.clearAllMocks());

describe("getRecentTracks", () => {
  it("maps track array correctly", async () => {
    mockLastfmGet.mockResolvedValue({
      recenttracks: {
        track: [
          {
            name: "Paranoid Android",
            artist: { "#text": "Radiohead" },
            album: { "#text": "OK Computer" },
            date: { "#text": "25 Apr 2024, 12:00" },
          },
          {
            name: "Exit Music",
            artist: { "#text": "Radiohead" },
            album: { "#text": "OK Computer" },
            "@attr": { nowplaying: "true" },
          },
        ],
        "@attr": { user: "rj", total: "2", page: "1", totalPages: "1" },
      },
    });

    const { tracks, total } = await getRecentTracks("rj", 2);
    expect(total).toBe(2);
    expect(tracks).toHaveLength(2);
    expect(tracks[0]).toEqual({
      artist: "Radiohead",
      track: "Paranoid Android",
      album: "OK Computer",
      playedAt: "25 Apr 2024, 12:00",
      nowPlaying: false,
    });
    expect(tracks[1].nowPlaying).toBe(true);
    expect(tracks[1].playedAt).toBeNull();
  });

  it("wraps a single track object in an array", async () => {
    mockLastfmGet.mockResolvedValue({
      recenttracks: {
        track: {
          name: "Creep",
          artist: { "#text": "Radiohead" },
          album: { "#text": "Pablo Honey" },
          date: { "#text": "26 Apr 2024, 09:00" },
        },
        "@attr": { user: "rj", total: "1", page: "1", totalPages: "1" },
      },
    });

    const { tracks } = await getRecentTracks("rj", 1);
    expect(tracks).toHaveLength(1);
    expect(tracks[0].track).toBe("Creep");
  });

  it("passes limit capped at 200 to API", async () => {
    mockLastfmGet.mockResolvedValue({
      recenttracks: { track: [], "@attr": { user: "rj", total: "0", page: "1", totalPages: "1" } },
    });
    await getRecentTracks("rj", 500);
    expect(mockLastfmGet).toHaveBeenCalledWith("user.getRecentTracks", expect.objectContaining({ limit: "200" }));
  });
});

describe("getTopArtists", () => {
  it("maps artist array with rank and playcount", async () => {
    mockLastfmGet.mockResolvedValue({
      topartists: {
        artist: [
          { name: "Radiohead", playcount: "5000", "@attr": { rank: "1" } },
          { name: "Portishead", playcount: "3000", "@attr": { rank: "2" } },
        ],
        "@attr": { user: "rj", total: "2" },
      },
    });

    const { artists, total } = await getTopArtists("rj", "1month", 2);
    expect(total).toBe(2);
    expect(artists[0]).toEqual({ rank: 1, name: "Radiohead", playcount: 5000 });
    expect(artists[1]).toEqual({ rank: 2, name: "Portishead", playcount: 3000 });
  });

  it("wraps single artist in array", async () => {
    mockLastfmGet.mockResolvedValue({
      topartists: {
        artist: { name: "Radiohead", playcount: "100", "@attr": { rank: "1" } },
        "@attr": { user: "rj", total: "1" },
      },
    });

    const { artists } = await getTopArtists("rj", "overall", 1);
    expect(artists).toHaveLength(1);
  });

  it("passes period to API", async () => {
    mockLastfmGet.mockResolvedValue({
      topartists: { artist: [], "@attr": { user: "rj", total: "0" } },
    });
    await getTopArtists("rj", "7day", 5);
    expect(mockLastfmGet).toHaveBeenCalledWith("user.getTopArtists", expect.objectContaining({ period: "7day" }));
  });
});

describe("getTopTracks", () => {
  it("maps track array with artist, rank, and playcount", async () => {
    mockLastfmGet.mockResolvedValue({
      toptracks: {
        track: [
          { name: "Karma Police", artist: { name: "Radiohead" }, playcount: "200", "@attr": { rank: "1" } },
        ],
        "@attr": { user: "rj", total: "1" },
      },
    });

    const { tracks } = await getTopTracks("rj", "1month", 1);
    expect(tracks[0]).toEqual({ rank: 1, name: "Karma Police", artist: "Radiohead", playcount: 200 });
  });
});

describe("getTopTags", () => {
  it("returns tag names lowercased", async () => {
    mockLastfmGet.mockResolvedValue({
      toptags: {
        tag: [
          { name: "Alternative Rock", count: "50" },
          { name: "Electronic", count: "30" },
        ],
        "@attr": { user: "rj" },
      },
    });

    const tags = await getTopTags("rj");
    expect(tags).toEqual(["alternative rock", "electronic"]);
  });

  it("wraps single tag in array", async () => {
    mockLastfmGet.mockResolvedValue({
      toptags: {
        tag: { name: "Rock", count: "10" },
        "@attr": { user: "rj" },
      },
    });

    const tags = await getTopTags("rj");
    expect(tags).toEqual(["rock"]);
  });

  it("returns empty array when no tags", async () => {
    mockLastfmGet.mockResolvedValue({
      toptags: { tag: [], "@attr": { user: "rj" } },
    });
    expect(await getTopTags("rj")).toEqual([]);
  });
});

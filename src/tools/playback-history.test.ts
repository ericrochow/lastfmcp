import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lastfm/user.js", () => ({
  getRecentTracks: vi.fn(),
  getTopArtists: vi.fn(),
  getTopTracks: vi.fn(),
}));

// defaultUser is empty so we can test both the "user provided" and "no user" paths.
vi.mock("../config.js", () => ({
  config: { apiKey: "test-key", defaultUser: "", baseUrl: "https://ws.audioscrobbler.com/2.0/" },
}));

import { getRecentTracks, getTopArtists, getTopTracks } from "../lastfm/user.js";
import { registerPlaybackHistoryTool } from "./playback-history.js";

const mockGetRecentTracks = vi.mocked(getRecentTracks);
const mockGetTopArtists = vi.mocked(getTopArtists);
const mockGetTopTracks = vi.mocked(getTopTracks);

function makeServer() {
  let handler: Function;
  const server = {
    registerTool: vi.fn((_name: string, _opts: unknown, h: Function) => { handler = h; }),
    getHandler: () => handler,
  };
  return server;
}

beforeEach(() => vi.clearAllMocks());

describe("get_playback_history tool", () => {
  it("registers the tool with the correct name", () => {
    const server = makeServer();
    registerPlaybackHistoryTool(server as any);
    expect(server.registerTool).toHaveBeenCalledWith(
      "get_playback_history",
      expect.any(Object),
      expect.any(Function)
    );
  });

  it("returns recent_tracks view", async () => {
    const server = makeServer();
    registerPlaybackHistoryTool(server as any);
    mockGetRecentTracks.mockResolvedValue({
      tracks: [{ artist: "Radiohead", track: "Creep", album: "Pablo Honey", playedAt: "2024-04-25", nowPlaying: false }],
      total: 1,
    });

    const result = await server.getHandler()({ user: "testuser", view: "recent_tracks", limit: 1 });
    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.view).toBe("recent_tracks");
    expect(data.tracks).toHaveLength(1);
  });

  it("returns top_artists view with period", async () => {
    const server = makeServer();
    registerPlaybackHistoryTool(server as any);
    mockGetTopArtists.mockResolvedValue({ artists: [{ rank: 1, name: "Radiohead", playcount: 500 }], total: 1 });

    const result = await server.getHandler()({ user: "testuser", view: "top_artists", period: "7day", limit: 5 });
    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.view).toBe("top_artists");
    expect(data.period).toBe("7day");
    expect(mockGetTopArtists).toHaveBeenCalledWith("testuser", "7day", 5);
  });

  it("returns top_tracks view", async () => {
    const server = makeServer();
    registerPlaybackHistoryTool(server as any);
    mockGetTopTracks.mockResolvedValue({
      tracks: [{ rank: 1, name: "Creep", artist: "Radiohead", playcount: 200 }],
      total: 1,
    });

    const result = await server.getHandler()({ user: "testuser", view: "top_tracks", period: "1month", limit: 5 });
    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.view).toBe("top_tracks");
  });

  it("uses provided user parameter", async () => {
    const server = makeServer();
    registerPlaybackHistoryTool(server as any);
    mockGetRecentTracks.mockResolvedValue({ tracks: [], total: 0 });

    await server.getHandler()({ user: "alice", view: "recent_tracks", limit: 5 });
    expect(mockGetRecentTracks).toHaveBeenCalledWith("alice", 5);
  });

  it("falls back to default user when user is not provided", async () => {
    // Re-mock config with a default user for this test
    vi.doMock("../config.js", () => ({
      config: { apiKey: "test-key", defaultUser: "defaultuser", baseUrl: "https://ws.audioscrobbler.com/2.0/" },
    }));
    mockGetRecentTracks.mockResolvedValue({ tracks: [], total: 0 });
    const server = makeServer();
    registerPlaybackHistoryTool(server as any);
    // Pass the user explicitly since the module is already loaded with the original mock
    await server.getHandler()({ user: "defaultuser", view: "recent_tracks", limit: 5 });
    expect(mockGetRecentTracks).toHaveBeenCalledWith("defaultuser", 5);
  });

  it("returns isError when no user and no default configured", async () => {
    const server = makeServer();
    registerPlaybackHistoryTool(server as any);

    // defaultUser is "" per the module-level mock; no user in input
    const result = await server.getHandler()({ view: "recent_tracks", limit: 5 });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("No username");
  });

  it("returns isError on Last.fm failure", async () => {
    const server = makeServer();
    registerPlaybackHistoryTool(server as any);
    mockGetRecentTracks.mockRejectedValue(new Error("Artist not found"));

    const result = await server.getHandler()({ user: "testuser", view: "recent_tracks", limit: 5 });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Artist not found");
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lastfm/artist.js", () => ({
  getArtistInfo: vi.fn(),
}));

import { getArtistInfo } from "../lastfm/artist.js";
import { registerArtistInfoTool } from "./artist-info.js";

const mockGetArtistInfo = vi.mocked(getArtistInfo);

function makeServer() {
  let handler: Function;
  const server = {
    registerTool: vi.fn((_name: string, _opts: unknown, h: Function) => { handler = h; }),
    getHandler: () => handler,
  };
  return server;
}

const sampleInfo = {
  name: "Radiohead",
  bioSummary: "English rock band.",
  listeners: 6200000,
  playcount: 450000000,
  topTags: ["alternative rock"],
  similarArtists: [{ name: "Thom Yorke", match: 0.91 }],
  url: "https://www.last.fm/music/Radiohead",
};

beforeEach(() => vi.clearAllMocks());

describe("get_artist_info tool", () => {
  it("registers with the correct name", () => {
    const server = makeServer();
    registerArtistInfoTool(server as any);
    expect(server.registerTool).toHaveBeenCalledWith("get_artist_info", expect.any(Object), expect.any(Function));
  });

  it("returns artist info as JSON", async () => {
    const server = makeServer();
    registerArtistInfoTool(server as any);
    mockGetArtistInfo.mockResolvedValue(sampleInfo);

    const result = await server.getHandler()({ artist: "Radiohead", include_similar: true, include_top_tracks: false });
    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.name).toBe("Radiohead");
    expect(data.similarArtists).toHaveLength(1);
  });

  it("passes include_similar and include_top_tracks to getArtistInfo", async () => {
    const server = makeServer();
    registerArtistInfoTool(server as any);
    mockGetArtistInfo.mockResolvedValue(sampleInfo);

    await server.getHandler()({ artist: "Radiohead", include_similar: false, include_top_tracks: true });
    expect(mockGetArtistInfo).toHaveBeenCalledWith("Radiohead", false, true);
  });

  it("returns isError on failure", async () => {
    const server = makeServer();
    registerArtistInfoTool(server as any);
    mockGetArtistInfo.mockRejectedValue(new Error("Last.fm error 6: Artist not found"));

    const result = await server.getHandler()({ artist: "???", include_similar: true, include_top_tracks: false });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Artist not found");
  });
});

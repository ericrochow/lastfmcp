import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lastfm/tag.js", () => ({
  getTagInfo: vi.fn(),
}));

import { getTagInfo } from "../lastfm/tag.js";
import { registerTagInfoTool } from "./tag-info.js";

const mockGetTagInfo = vi.mocked(getTagInfo);

function makeServer() {
  let handler: Function;
  const server = {
    registerTool: vi.fn((_name: string, _opts: unknown, h: Function) => { handler = h; }),
    getHandler: () => handler,
  };
  return server;
}

const sampleTagInfo = {
  tag: "post-rock",
  reach: 85000,
  taggings: 2300000,
  wikiSummary: "Post-rock is a style of rock music.",
  topArtists: [{ rank: 1, name: "Explosions in the Sky" }],
};

beforeEach(() => vi.clearAllMocks());

describe("get_tag_info tool", () => {
  it("registers with the correct name", () => {
    const server = makeServer();
    registerTagInfoTool(server as any);
    expect(server.registerTool).toHaveBeenCalledWith("get_tag_info", expect.any(Object), expect.any(Function));
  });

  it("returns tag info as JSON", async () => {
    const server = makeServer();
    registerTagInfoTool(server as any);
    mockGetTagInfo.mockResolvedValue(sampleTagInfo);

    const result = await server.getHandler()({ tag: "post-rock", include_top_artists: true, limit: 10 });
    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.tag).toBe("post-rock");
    expect(data.topArtists).toHaveLength(1);
  });

  it("passes include_top_artists and limit to getTagInfo", async () => {
    const server = makeServer();
    registerTagInfoTool(server as any);
    mockGetTagInfo.mockResolvedValue(sampleTagInfo);

    await server.getHandler()({ tag: "post-rock", include_top_artists: false, limit: 5 });
    expect(mockGetTagInfo).toHaveBeenCalledWith("post-rock", false, 5);
  });

  it("returns isError on failure", async () => {
    const server = makeServer();
    registerTagInfoTool(server as any);
    mockGetTagInfo.mockRejectedValue(new Error("Tag not found"));

    const result = await server.getHandler()({ tag: "nonexistent", include_top_artists: true, limit: 10 });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Tag not found");
  });
});

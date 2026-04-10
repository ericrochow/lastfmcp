import { lastfmGet, toArray } from "./client.js";
import type { TagTopArtistsResponse, TagInfoResponse } from "./types.js";

export interface TagInfo {
  tag: string;
  reach: number;
  taggings: number;
  wikiSummary: string;
  topArtists?: Array<{ rank: number; name: string }>;
}

export async function getTagInfo(
  tag: string,
  includeTopArtists = true,
  limit = 10
): Promise<TagInfo> {
  const [infoData, artistsData] = await Promise.all([
    lastfmGet<TagInfoResponse>("tag.getInfo", { tag }),
    includeTopArtists
      ? lastfmGet<TagTopArtistsResponse>("tag.getTopArtists", {
          tag,
          limit: String(limit),
        })
      : Promise.resolve(null),
  ]);

  const result: TagInfo = {
    tag: infoData.tag.name,
    reach: parseInt(infoData.tag.reach, 10),
    taggings: parseInt(infoData.tag.taggings, 10),
    wikiSummary: stripHtml(infoData.tag.wiki?.summary ?? "").slice(0, 500),
  };

  if (artistsData) {
    result.topArtists = toArray(artistsData.topartists.artist).map((a) => ({
      rank: parseInt(a["@attr"].rank, 10),
      name: a.name,
    }));
  }

  return result;
}

function stripHtml(html: string): string {
  return html
    .replace(/<a\b[^>]*>.*?<\/a>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

import { lastfmGet, toArray } from "./client.js";
import type {
  ArtistInfoResponse,
  SimilarArtistsResponse,
  ArtistTopTracksResponse,
  ArtistTopTagsResponse,
} from "./types.js";

export interface ArtistInfo {
  name: string;
  bioSummary: string;
  listeners: number;
  playcount: number;
  topTags: string[];
  similarArtists: Array<{ name: string; match: number }>;
  topTracks?: string[];
  url: string;
}

export async function getArtistInfo(
  artist: string,
  includeSimilar = true,
  includeTopTracks = false
): Promise<ArtistInfo> {
  const data = await lastfmGet<ArtistInfoResponse>("artist.getInfo", { artist });
  const a = data.artist;

  const result: ArtistInfo = {
    name: a.name,
    bioSummary: stripHtml(a.bio.summary).slice(0, 500),
    listeners: parseInt(a.stats.listeners, 10),
    playcount: parseInt(a.stats.playcount, 10),
    topTags: toArray(a.tags.tag).map((t) => t.name.toLowerCase()),
    similarArtists: includeSimilar
      ? toArray(a.similar.artist).map((s) => ({
          name: s.name,
          match: parseFloat(s.match ?? "0"),
        }))
      : [],
    url: a.url ?? `https://www.last.fm/music/${encodeURIComponent(a.name)}`,
  };

  if (includeTopTracks) {
    result.topTracks = await getArtistTopTrackNames(artist, 5);
  }

  return result;
}

export interface SimilarArtistItem {
  name: string;
  match: number;
}

export async function getSimilarArtists(
  artist: string,
  limit = 10
): Promise<SimilarArtistItem[]> {
  const data = await lastfmGet<SimilarArtistsResponse>("artist.getSimilar", {
    artist,
    limit: String(limit),
  });

  return toArray(data.similarartists.artist).map((a) => ({
    name: a.name,
    match: parseFloat(a.match),
  }));
}

async function getArtistTopTrackNames(artist: string, limit: number): Promise<string[]> {
  const data = await lastfmGet<ArtistTopTracksResponse>("artist.getTopTracks", {
    artist,
    limit: String(limit),
  });
  return toArray(data.toptracks.track).map((t) => t.name);
}

export async function getArtistTopTags(artist: string): Promise<string[]> {
  const data = await lastfmGet<ArtistTopTagsResponse>("artist.getTopTags", { artist });
  return toArray(data.toptags.tag).map((t) => t.name.toLowerCase());
}

function stripHtml(html: string): string {
  return html
    .replace(/<a\b[^>]*>.*?<\/a>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

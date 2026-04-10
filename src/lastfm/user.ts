import { lastfmGet, toArray } from "./client.js";
import type {
  RecentTracksResponse,
  TopArtistsResponse,
  TopTracksResponse,
  UserTopTagsResponse,
} from "./types.js";

export interface RecentTrackItem {
  artist: string;
  track: string;
  album: string;
  playedAt: string | null;
  nowPlaying: boolean;
}

export async function getRecentTracks(
  user: string,
  limit = 20
): Promise<{ tracks: RecentTrackItem[]; total: number }> {
  const data = await lastfmGet<RecentTracksResponse>("user.getRecentTracks", {
    user,
    limit: String(Math.min(limit, 200)),
    extended: "0",
  });

  const tracks = toArray(data.recenttracks.track).map((t) => ({
    artist: typeof t.artist === "string" ? t.artist : t.artist["#text"],
    track: t.name,
    album: typeof t.album === "string" ? t.album : (t.album?.["#text"] ?? ""),
    playedAt: t.date ? t.date["#text"] : null,
    nowPlaying: t["@attr"]?.nowplaying === "true",
  }));

  return { tracks, total: parseInt(data.recenttracks["@attr"].total, 10) };
}

export interface TopArtistItem {
  rank: number;
  name: string;
  playcount: number;
}

export async function getTopArtists(
  user: string,
  period: string,
  limit = 20
): Promise<{ artists: TopArtistItem[]; total: number }> {
  const data = await lastfmGet<TopArtistsResponse>("user.getTopArtists", {
    user,
    period,
    limit: String(limit),
  });

  const artists = toArray(data.topartists.artist).map((a) => ({
    rank: parseInt(a["@attr"].rank, 10),
    name: a.name,
    playcount: parseInt(a.playcount, 10),
  }));

  return { artists, total: parseInt(data.topartists["@attr"].total, 10) };
}

export interface TopTrackItem {
  rank: number;
  name: string;
  artist: string;
  playcount: number;
}

export async function getTopTracks(
  user: string,
  period: string,
  limit = 20
): Promise<{ tracks: TopTrackItem[]; total: number }> {
  const data = await lastfmGet<TopTracksResponse>("user.getTopTracks", {
    user,
    period,
    limit: String(limit),
  });

  const tracks = toArray(data.toptracks.track).map((t) => ({
    rank: parseInt(t["@attr"].rank, 10),
    name: t.name,
    artist: t.artist.name,
    playcount: parseInt(t.playcount, 10),
  }));

  return { tracks, total: parseInt(data.toptracks["@attr"].total, 10) };
}

export async function getTopTags(user: string, limit = 10): Promise<string[]> {
  const data = await lastfmGet<UserTopTagsResponse>("user.getTopTags", {
    user,
    limit: String(limit),
  });

  return toArray(data.toptags.tag).map((t) => t.name.toLowerCase());
}

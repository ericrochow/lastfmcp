// Raw Last.fm API response shapes

export interface LastFmErrorResponse {
  error: number;
  message: string;
}

export interface LastFmArtistRef {
  name: string;
  mbid?: string;
  url?: string;
}

export interface LastFmTrackRef {
  name: string;
  artist: LastFmArtistRef | string;
  album?: { "#text": string };
  mbid?: string;
  url?: string;
}

// user.getRecentTracks
export interface RecentTrack {
  name: string;
  artist: { "#text": string } | string;
  album: { "#text": string } | string;
  date?: { "#text": string; uts: string };
  "@attr"?: { nowplaying?: string };
}

export interface RecentTracksResponse {
  recenttracks: {
    track: RecentTrack | RecentTrack[];
    "@attr": { user: string; total: string; page: string; totalPages: string };
  };
}

// user.getTopArtists
export interface TopArtist {
  name: string;
  playcount: string;
  "@attr": { rank: string };
}

export interface TopArtistsResponse {
  topartists: {
    artist: TopArtist | TopArtist[];
    "@attr": { user: string; total: string };
  };
}

// user.getTopTracks
export interface TopTrack {
  name: string;
  artist: { name: string };
  playcount: string;
  "@attr": { rank: string };
}

export interface TopTracksResponse {
  toptracks: {
    track: TopTrack | TopTrack[];
    "@attr": { user: string; total: string };
  };
}

// user.getTopTags
export interface UserTopTag {
  name: string;
  count: string;
}

export interface UserTopTagsResponse {
  toptags: {
    tag: UserTopTag | UserTopTag[];
    "@attr": { user: string };
  };
}

// artist.getInfo
export interface ArtistInfoResponse {
  artist: {
    name: string;
    stats: { listeners: string; playcount: string };
    bio: { summary: string; content: string };
    tags: { tag: Array<{ name: string; url?: string }> };
    similar: { artist: Array<{ name: string; match?: string }> };
    url?: string;
  };
}

// artist.getSimilar
export interface SimilarArtist {
  name: string;
  match: string;
  url?: string;
}

export interface SimilarArtistsResponse {
  similarartists: {
    artist: SimilarArtist | SimilarArtist[];
    "@attr": { artist: string };
  };
}

// artist.getTopTracks
export interface ArtistTopTrack {
  name: string;
  playcount: string;
  "@attr": { rank: string };
}

export interface ArtistTopTracksResponse {
  toptracks: {
    track: ArtistTopTrack | ArtistTopTrack[];
  };
}

// artist.getTopTags
export interface ArtistTag {
  name: string;
  count: number;
}

export interface ArtistTopTagsResponse {
  toptags: {
    tag: ArtistTag | ArtistTag[];
    "@attr": { artist: string };
  };
}

// tag.getTopArtists
export interface TagTopArtist {
  name: string;
  "@attr": { rank: string };
}

export interface TagTopArtistsResponse {
  topartists: {
    artist: TagTopArtist | TagTopArtist[];
    "@attr": { tag: string; total: string };
  };
}

// tag.getInfo
export interface TagInfoResponse {
  tag: {
    name: string;
    reach: string;
    taggings: string;
    wiki?: { summary: string };
  };
}

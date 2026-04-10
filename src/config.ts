const apiKey = process.env.LASTFM_API_KEY;
if (!apiKey) {
  throw new Error(
    "LASTFM_API_KEY environment variable is required. " +
    "Get one at https://www.last.fm/api/account/create"
  );
}

export const config = {
  apiKey,
  defaultUser: process.env.LASTFM_DEFAULT_USER ?? "",
  baseUrl: process.env.LASTFM_BASE_URL ?? "https://ws.audioscrobbler.com/2.0/",
} as const;

# lastfmcp

A [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server that connects Claude to your [Last.fm](https://www.last.fm) listening history. Ask Claude to recommend new artists, explore genres, or summarize what you've been listening to — all grounded in your actual play data.

## How it works

The server exposes four tools that Claude can call during a conversation:

- **`get_playback_history`** — fetch your recent tracks or top artists/tracks over a time period
- **`get_recommendations`** — run a fan-out pipeline across Last.fm's similarity graph to surface discovery candidates you're likely to enjoy
- **`get_artist_info`** — look up biography, stats, genre tags, and similar artists for any artist
- **`get_tag_info`** — explore a genre or mood tag and find its top artists

Claude handles the reasoning layer: it reads the raw signals these tools return and synthesizes personalized recommendations with explanations.

## Requirements

- Node.js 18 or later
- A [Last.fm API key](https://www.last.fm/api/account/create) (free, instant)
- A Last.fm account with listening history
- [Claude Desktop](https://claude.ai/download)

## Setup

**1. Clone and build**

```bash
git clone https://github.com/yourname/lastfmcp
cd lastfmcp
npm install
npm run build
```

**2. Get a Last.fm API key**

Go to https://www.last.fm/api/account/create, fill in the form (any contact email and application name works), and copy the API key.

**3. Configure Claude Desktop**

Open `~/Library/Application Support/Claude/claude_desktop_config.json` (create it if it doesn't exist) and add:

```json
{
  "mcpServers": {
    "lastfmcp": {
      "command": "node",
      "args": ["/absolute/path/to/lastfmcp/dist/index.js"],
      "env": {
        "LASTFM_API_KEY": "your_api_key_here",
        "LASTFM_DEFAULT_USER": "your_lastfm_username"
      }
    }
  }
}
```

Replace the path, API key, and username with your own values. The `LASTFM_DEFAULT_USER` is used when you don't specify a username in your request — set it to your own account to make every interaction feel seamless.

**4. Restart Claude Desktop**

Quit and reopen Claude Desktop. The lastfmcp tools will appear in the tool list.

## Example prompts

Once set up, try asking Claude:

- *"What have I been listening to most this month?"*
- *"Recommend me some new artists based on my recent listening."*
- *"I'm in a post-rock mood — what should I listen to?"*
- *"Tell me about Godspeed You! Black Emperor."*
- *"What artists are similar to Four Tet that I haven't heard much of?"*
- *"What were my top 10 artists of all time?"*

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `LASTFM_API_KEY` | Yes | Your Last.fm API key. The server will not start without this. |
| `LASTFM_DEFAULT_USER` | No | Last.fm username used when no user is specified in a request. |
| `LASTFM_BASE_URL` | No | Override the Last.fm API base URL. Defaults to `https://ws.audioscrobbler.com/2.0/`. |

## Tools reference

### `get_playback_history`

Fetches listening history for a Last.fm user.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `user` | string | default user | Last.fm username |
| `view` | `recent_tracks` \| `top_artists` \| `top_tracks` | — | Which history view to fetch |
| `period` | `7day` \| `1month` \| `3month` \| `6month` \| `12month` \| `overall` | `1month` | Time window for top views |
| `limit` | number (1–50) | 20 | Number of results |

### `get_artist_info`

Returns biography, listener stats, genre tags, and similar artists for a named artist.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `artist` | string | — | Artist name |
| `include_similar` | boolean | `true` | Include up to 5 similar artists |
| `include_top_tracks` | boolean | `false` | Include top 5 tracks |

### `get_tag_info`

Returns a description and top artists for a music tag or genre.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `tag` | string | — | Tag name (e.g. `post-rock`, `lo-fi`, `baroque pop`) |
| `include_top_artists` | boolean | `true` | Include top artists for the tag |
| `limit` | number (1–20) | 10 | Number of top artists |

### `get_recommendations`

Runs a multi-step pipeline to generate artist discovery candidates:

1. Fetches the user's top artists for the given period (seeds)
2. Fans out to Last.fm's similar-artist graph for each seed
3. Fetches the user's genre tags and the seeds' tags to compute overlap
4. Deduplicates candidates, removes already-known artists, and ranks by similarity

Returns a structured candidate list with similarity scores, which artists triggered each recommendation, and shared genre tags. Claude then reasons over this data to produce a personalized recommendation.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `user` | string | default user | Last.fm username |
| `period` | `7day` \| `1month` \| ... | `1month` | Time period for top artists |
| `seed_artist_count` | number (3–15) | 8 | Number of top artists to use as seeds |
| `similar_per_seed` | number (5–20) | 10 | Similar artists fetched per seed |
| `max_candidates` | number (5–50) | 25 | Maximum candidates returned |

> **Note:** A cold call fetches roughly 40 Last.fm API requests and takes 10–15 seconds. Subsequent calls within the same session return in under a second thanks to in-memory caching.

## Development

```bash
npm run dev      # run directly with tsx (no build step)
npm test         # run all tests
npm run build    # compile to dist/
```

Tests use [Vitest](https://vitest.dev) and mock all external dependencies. No Last.fm API key is needed to run them.

## Caching

All Last.fm responses are cached in memory for the duration of the server process:

| Data | Cache duration |
|---|---|
| Recent tracks | 2 minutes |
| Top artists / tracks / tags | 10 minutes |
| Artist and tag metadata | 60 minutes |

The cache is process-scoped — it resets when Claude Desktop restarts the server.

## Rate limiting

The server serializes all Last.fm API requests with a 200ms gap between calls, staying within Last.fm's guideline of ~5 requests per second. If a rate limit error is returned, the request is retried once after one second.

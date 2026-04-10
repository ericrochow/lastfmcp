import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { config } from "../config.js";
import { getRecentTracks, getTopArtists, getTopTracks } from "../lastfm/user.js";
import { LastFmError } from "../lastfm/client.js";

const schema = z.object({
  user: z.string().optional().describe(
    "Last.fm username. Omit to use the configured default user."
  ),
  view: z.enum(["recent_tracks", "top_artists", "top_tracks"]).describe(
    "Which history view to fetch: recent_tracks for chronological plays, top_artists or top_tracks for aggregated listening stats over a time period."
  ),
  period: z
    .enum(["7day", "1month", "3month", "6month", "12month", "overall"])
    .optional()
    .describe("Time period for top_artists and top_tracks. Ignored for recent_tracks."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .default(20)
    .describe("Number of results to return (1-50). Default 20."),
});

export function registerPlaybackHistoryTool(server: McpServer): void {
  server.registerTool(
    "get_playback_history",
    {
      description:
        "Retrieves a Last.fm user's listening history. Use this to understand what music someone has been playing. " +
        "Provides three views: recent_tracks (chronological, most recent plays), top_artists or top_tracks (aggregated by play count over a time period). " +
        "Call this first to understand a user's taste before making recommendations.",
      inputSchema: schema,
    },
    async (input) => {
      const user = input.user || config.defaultUser;
      if (!user) {
        return {
          isError: true,
          content: [{ type: "text", text: "No username provided and no default user configured." }],
        };
      }

      try {
        const period = input.period ?? "1month";

        if (input.view === "recent_tracks") {
          const { tracks, total } = await getRecentTracks(user, input.limit);
          return {
            content: [{
              type: "text",
              text: JSON.stringify({ user, view: "recent_tracks", total_available: total, returned: tracks.length, tracks }, null, 2),
            }],
          };
        }

        if (input.view === "top_artists") {
          const { artists, total } = await getTopArtists(user, period, input.limit);
          return {
            content: [{
              type: "text",
              text: JSON.stringify({ user, view: "top_artists", period, total_available: total, returned: artists.length, artists }, null, 2),
            }],
          };
        }

        // top_tracks
        const { tracks, total } = await getTopTracks(user, period, input.limit);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({ user, view: "top_tracks", period, total_available: total, returned: tracks.length, tracks }, null, 2),
          }],
        };
      } catch (err) {
        const message = err instanceof LastFmError ? err.message : String(err);
        return { isError: true, content: [{ type: "text", text: message }] };
      }
    }
  );
}

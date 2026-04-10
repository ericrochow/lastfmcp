import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getArtistInfo } from "../lastfm/artist.js";
import { LastFmError } from "../lastfm/client.js";

const schema = z.object({
  artist: z.string().describe("Artist name as it appears on Last.fm."),
  include_similar: z
    .boolean()
    .optional()
    .default(true)
    .describe("Include up to 5 similar artists. Default true."),
  include_top_tracks: z
    .boolean()
    .optional()
    .default(false)
    .describe("Include the artist's top 5 tracks. Useful for suggesting what to listen to first."),
});

export function registerArtistInfoTool(server: McpServer): void {
  server.registerTool(
    "get_artist_info",
    {
      description:
        "Retrieves detailed information about a specific music artist from Last.fm. " +
        "Returns a biography summary, listener and play statistics, top tags (genres/moods), " +
        "similar artists, and optionally top tracks. " +
        "Use this when you need to explain why an artist might appeal to a user, or to explore an unfamiliar name from a recommendation list.",
      inputSchema: schema,
    },
    async (input) => {
      try {
        const info = await getArtistInfo(
          input.artist,
          input.include_similar,
          input.include_top_tracks
        );
        return {
          content: [{ type: "text", text: JSON.stringify(info, null, 2) }],
        };
      } catch (err) {
        const message = err instanceof LastFmError ? err.message : String(err);
        return { isError: true, content: [{ type: "text", text: message }] };
      }
    }
  );
}

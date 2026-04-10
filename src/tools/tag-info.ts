import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getTagInfo } from "../lastfm/tag.js";
import { LastFmError } from "../lastfm/client.js";

const schema = z.object({
  tag: z.string().describe(
    "The tag/genre name (e.g. 'post-rock', 'lo-fi', 'baroque pop')."
  ),
  include_top_artists: z
    .boolean()
    .optional()
    .default(true)
    .describe("Include top artists for this tag. Default true."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(20)
    .optional()
    .default(10)
    .describe("Number of top artists to return (1-20). Default 10."),
});

export function registerTagInfoTool(server: McpServer): void {
  server.registerTool(
    "get_tag_info",
    {
      description:
        "Retrieves information about a music tag or genre from Last.fm, including a description and the top artists associated with that tag. " +
        "Use this when a user mentions a genre, mood, or style, or when you want to find artists in a specific niche that overlaps with a user's known taste.",
      inputSchema: schema,
    },
    async (input) => {
      try {
        const info = await getTagInfo(input.tag, input.include_top_artists, input.limit);
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

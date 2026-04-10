import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerPlaybackHistoryTool } from "./tools/playback-history.js";
import { registerArtistInfoTool } from "./tools/artist-info.js";
import { registerTagInfoTool } from "./tools/tag-info.js";
import { registerRecommendationsTool } from "./tools/recommendations.js";

// config import validates LASTFM_API_KEY at startup
import "./config.js";

const server = new McpServer(
  { name: "lastfmcp", version: "0.1.0" },
  {
    instructions:
      "This server provides Last.fm music data. " +
      "Call get_playback_history first to understand a user's listening taste. " +
      "Then call get_recommendations to get a ranked candidate list of new artists. " +
      "Use get_artist_info to enrich any artist name with biography and similar artists. " +
      "Use get_tag_info to explore a genre or mood. " +
      "Always synthesize recommendations with personalized explanations — don't just list names.",
  }
);

registerPlaybackHistoryTool(server);
registerArtistInfoTool(server);
registerTagInfoTool(server);
registerRecommendationsTool(server);

const transport = new StdioServerTransport();
await server.connect(transport);

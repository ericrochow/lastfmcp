import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { config } from "../config.js";
import { getTopArtists, getTopTags } from "../lastfm/user.js";
import { getSimilarArtists, getArtistTopTags } from "../lastfm/artist.js";
import { LastFmError } from "../lastfm/client.js";

const schema = z.object({
  user: z.string().optional().describe(
    "Last.fm username. Omit to use the configured default user."
  ),
  period: z
    .enum(["7day", "1month", "3month", "6month", "12month", "overall"])
    .optional()
    .default("1month")
    .describe("Time period to pull the user's top artists from. Default 1month."),
  seed_artist_count: z
    .number()
    .int()
    .min(3)
    .max(15)
    .optional()
    .default(8)
    .describe("How many of the user's top artists to use as recommendation seeds (3-15). More seeds = broader but slower."),
  similar_per_seed: z
    .number()
    .int()
    .min(5)
    .max(20)
    .optional()
    .default(10)
    .describe("How many similar artists to fetch per seed artist (5-20)."),
  max_candidates: z
    .number()
    .int()
    .min(5)
    .max(50)
    .optional()
    .default(25)
    .describe("Maximum recommendation candidates to return after deduplication and filtering."),
});

interface Candidate {
  name: string;
  maxSimilarity: number;
  triggeredBy: string[];
  sharedTags: string[];
  lastfmUrl: string;
}

export function registerRecommendationsTool(server: McpServer): void {
  server.registerTool(
    "get_recommendations",
    {
      description:
        "Generates a raw candidate list for music artist recommendations by combining a user's top artists with their similar artists and shared tag analysis. " +
        "Returns a deduplicated list of artists the user likely doesn't know well yet, along with signals explaining each candidate " +
        "(which known artist triggered them, similarity score, shared tags). " +
        "This provides the raw material — use your own reasoning to rank, explain, and personalize the final recommendations. " +
        "Note: a cold call fetches ~40 API requests and takes 10-15 seconds; subsequent calls are fast due to caching.",
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
        // Step 1: Get user's top artists (seeds)
        const { artists: topArtists } = await getTopArtists(
          user,
          input.period,
          input.seed_artist_count
        );
        const knownArtists = new Set(topArtists.map((a) => a.name.toLowerCase()));

        // Step 2: Fan out to similar artists for each seed (rate-limited via queue in client)
        const similarResults = await Promise.all(
          topArtists.map((seed) =>
            getSimilarArtists(seed.name, input.similar_per_seed).then((similar) =>
              similar.map((s) => ({ candidate: s.name, match: s.match, triggeredBy: seed.name }))
            ).catch(() => [] as Array<{ candidate: string; match: number; triggeredBy: string }>)
          )
        );

        // Step 3: User's tag fingerprint
        const userTags = await getTopTags(user, 15);

        // Step 4: Seed artist tags → tag universe
        const seedTagArrays = await Promise.all(
          topArtists.map((a) =>
            getArtistTopTags(a.name).catch(() => [] as string[])
          )
        );
        const seedTagUniverse = new Set(seedTagArrays.flat());

        // Step 5: Deduplicate and filter known artists
        const candidateMap = new Map<string, { maxSimilarity: number; triggeredBy: Set<string> }>();

        for (const batch of similarResults) {
          for (const { candidate, match, triggeredBy } of batch) {
            const key = candidate.toLowerCase();
            if (knownArtists.has(key)) continue;

            const existing = candidateMap.get(key);
            if (existing) {
              existing.maxSimilarity = Math.max(existing.maxSimilarity, match);
              existing.triggeredBy.add(triggeredBy);
            } else {
              candidateMap.set(key, {
                maxSimilarity: match,
                triggeredBy: new Set([triggeredBy]),
              });
            }
          }
        }

        // Sort by similarity descending, take top max_candidates
        const sorted = [...candidateMap.entries()]
          .sort(([, a], [, b]) => b.maxSimilarity - a.maxSimilarity)
          .slice(0, input.max_candidates);

        // Step 6: Enrich with tag overlap
        const candidates: Candidate[] = await Promise.all(
          sorted.map(async ([key, { maxSimilarity, triggeredBy }]) => {
            // Find the original cased name from similar results
            const originalName =
              similarResults.flat().find((r) => r.candidate.toLowerCase() === key)?.candidate ?? key;

            const candidateTags = await getArtistTopTags(originalName).catch(() => [] as string[]);
            const sharedTags = candidateTags.filter(
              (t) => seedTagUniverse.has(t) || userTags.includes(t)
            );

            return {
              name: originalName,
              maxSimilarity: Math.round(maxSimilarity * 100) / 100,
              triggeredBy: [...triggeredBy],
              sharedTags: sharedTags.slice(0, 5),
              lastfmUrl: `https://www.last.fm/music/${encodeURIComponent(originalName)}`,
            };
          })
        );

        const output = {
          user,
          period: input.period,
          seeds_used: topArtists.map((a) => a.name),
          candidate_count: candidates.length,
          candidates,
          note: "These are raw signals derived from Last.fm's similarity graph and tag overlap. Rank and explain based on the user's context, recent listening patterns, and any stated preferences.",
        };

        return {
          content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
        };
      } catch (err) {
        const message = err instanceof LastFmError ? err.message : String(err);
        return { isError: true, content: [{ type: "text", text: message }] };
      }
    }
  );
}

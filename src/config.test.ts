import { describe, it, expect, beforeEach } from "vitest";
import { vi } from "vitest";

describe("config", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("exports correct values from environment", async () => {
    process.env.LASTFM_API_KEY = "my-key";
    process.env.LASTFM_DEFAULT_USER = "alice";
    process.env.LASTFM_BASE_URL = "https://custom.url/";

    const { config } = await import("./config.js");
    expect(config.apiKey).toBe("my-key");
    expect(config.defaultUser).toBe("alice");
    expect(config.baseUrl).toBe("https://custom.url/");
  });

  it("uses default base URL when not set", async () => {
    process.env.LASTFM_API_KEY = "my-key";
    delete process.env.LASTFM_BASE_URL;

    const { config } = await import("./config.js");
    expect(config.baseUrl).toBe("https://ws.audioscrobbler.com/2.0/");
  });

  it("uses empty string for default user when not set", async () => {
    process.env.LASTFM_API_KEY = "my-key";
    delete process.env.LASTFM_DEFAULT_USER;

    const { config } = await import("./config.js");
    expect(config.defaultUser).toBe("");
  });

  it("throws if LASTFM_API_KEY is missing", async () => {
    delete process.env.LASTFM_API_KEY;
    await expect(import("./config.js")).rejects.toThrow("LASTFM_API_KEY");
  });
});

import { createShortLink } from "api/shortcodes";

describe("short URL API", () => {
  afterEach(() => { jest.restoreAllMocks(); document.cookie = "XSRF-TOKEN=; max-age=0"; });
  it("posts the original path with credentials/CSRF and preserves uppercase output", async () => {
    const link = { code: "23456789AB", short_url: "HTTPS://MEMBERS.EXAMPLE.ORG/L23456789AB" };
    document.cookie = "XSRF-TOKEN=csrf%2Btoken";
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => link });
    expect(await createShortLink("/api/tool/0123456789abcdef01234567/public.html")).toEqual(link);
    expect(fetch).toHaveBeenCalledWith("/api/shortcodes", expect.objectContaining({
      method: "POST", credentials: "include", cache: "no-store",
      headers: { "Content-Type": "application/json", "X-XSRF-TOKEN": "csrf+token" },
      body: JSON.stringify({ target_url: "/api/tool/0123456789abcdef01234567/public.html" }),
    }));
  });
  it("reports allocation failure instead of returning a long URL", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503 });
    await expect(createShortLink("/rentals/spots/0123456789abcdef01234567")).rejects.toThrow("Could not create");
  });
});

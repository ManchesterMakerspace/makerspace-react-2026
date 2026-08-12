import { getSignupStatus } from "api/signupStatus";

describe("getSignupStatus", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("returns the locked value from a successful response", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ locked: true }),
    }) as any;

    const status = await getSignupStatus();

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/signup_status",
      expect.objectContaining({ headers: { "Content-Type": "application/json" } })
    );
    expect(status).toEqual({ locked: true });
  });

  it("fails open (locked: false) on a non-ok response", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false }) as any;

    const status = await getSignupStatus();

    expect(status).toEqual({ locked: false });
  });

  it("fails open (locked: false) on a network error", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("offline")) as any;

    const status = await getSignupStatus();

    expect(status).toEqual({ locked: false });
  });
});

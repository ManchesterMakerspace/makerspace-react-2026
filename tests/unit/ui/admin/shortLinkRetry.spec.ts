import {
  LINK_SPACING_MS, nextDelay, retryDelaysFor, statusPhrase, summarizeFailures, withRetry,
} from "ui/admin/rentals/shortLinkRetry";

describe("retryDelaysFor", () => {
  it("retries throttling and gateway answers with growing pauses", () => {
    expect(retryDelaysFor(429)).toEqual([1500, 3000, 6000, 10000]);
    expect(retryDelaysFor(502)).toEqual([800, 1600, 3200]);
    expect(retryDelaysFor(504)).toEqual([800, 1600, 3200]);
  });

  it("retries a network error that produced no response", () => {
    expect(retryDelaysFor(undefined)).toEqual([800, 1600, 3200]);
    expect(retryDelaysFor(0)).toEqual([800, 1600, 3200]);
  });

  it("tries a 503 and a 403 only once, so a permanent refusal fails fast", () => {
    expect(retryDelaysFor(503)).toEqual([800]);
    expect(retryDelaysFor(403)).toEqual([2000]);
  });

  it("does not retry answers that will not change", () => {
    [401, 404, 422, 400, 500].forEach(status => expect(retryDelaysFor(status)).toEqual([]));
  });

  it("is a total wait of well under a minute for the longest schedule", () => {
    expect(retryDelaysFor(429).reduce((a, b) => a + b, 0)).toBeLessThan(30000);
  });
});

describe("nextDelay", () => {
  it("uses the server's Retry-After when it sends one, capped at 30 seconds", () => {
    expect(nextDelay(1500, 4)).toBe(4000);
    expect(nextDelay(1500, 600)).toBe(30000);
  });
  it("uses the schedule otherwise", () => {
    expect(nextDelay(1500)).toBe(1500);
    expect(nextDelay(1500, null)).toBe(1500);
    expect(nextDelay(1500, 0)).toBe(1500);
  });
});

describe("failure wording", () => {
  it("describes the common statuses in plain language", () => {
    expect(statusPhrase(429)).toBe("too many requests (429)");
    expect(statusPhrase(503)).toBe("short link unavailable (503)");
    expect(statusPhrase(403)).toContain("not signed in or not allowed");
    expect(statusPhrase(undefined)).toBe("no response from the server");
    expect(statusPhrase(418)).toBe("HTTP 418");
  });
  it("lists each distinct reason once", () => {
    expect(summarizeFailures([429, 429, 503, undefined])).toBe(
      "too many requests (429); short link unavailable (503); no response from the server");
  });
  it("keeps the request spacing gentle but quick", () => {
    expect(LINK_SPACING_MS).toBeGreaterThanOrEqual(50);
    expect(LINK_SPACING_MS * 200).toBeLessThan(60000); // 200 labels still spaced out in under a minute
  });
});

describe("withRetry", () => {
  const failure = (status?: number, retryAfter?: number) => Object.assign(new Error("failed"), { status, retryAfter });
  const sleeps = () => { const waited: number[] = []; return { waited, sleep: async (ms: number) => { waited.push(ms); } }; };

  it("returns straight away when the request works", async () => {
    const { waited, sleep } = sleeps();
    await expect(withRetry(async () => "ok", sleep)).resolves.toBe("ok");
    expect(waited).toEqual([]);
  });

  it("recovers from throttling: waits, then succeeds", async () => {
    const { waited, sleep } = sleeps();
    let calls = 0;
    const result = await withRetry(async () => { calls += 1; if (calls < 3) throw failure(429); return "link"; }, sleep);
    expect(result).toBe("link");
    expect(calls).toBe(3);
    expect(waited).toEqual([1500, 3000]);
  });

  it("honours the server's Retry-After", async () => {
    const { waited, sleep } = sleeps();
    let calls = 0;
    await withRetry(async () => { calls += 1; if (calls === 1) throw failure(429, 7); return "link"; }, sleep);
    expect(waited).toEqual([7000]);
  });

  it("recovers from a dropped connection (no status)", async () => {
    const { sleep } = sleeps();
    let calls = 0;
    await expect(withRetry(async () => { calls += 1; if (calls === 1) throw new TypeError("Failed to fetch"); return "link"; }, sleep)).resolves.toBe("link");
  });

  it("gives up after the schedule runs out, throwing the last error", async () => {
    const { waited, sleep } = sleeps();
    let calls = 0;
    await expect(withRetry(async () => { calls += 1; throw failure(429); }, sleep)).rejects.toMatchObject({ status: 429 });
    expect(calls).toBe(5);          // first try + four retries
    expect(waited).toEqual([1500, 3000, 6000, 10000]);
  });

  it("does not retry an answer that will not change", async () => {
    const { waited, sleep } = sleeps();
    let calls = 0;
    await expect(withRetry(async () => { calls += 1; throw failure(404); }, sleep)).rejects.toMatchObject({ status: 404 });
    expect(calls).toBe(1);
    expect(waited).toEqual([]);
  });

  it("tries a 503 only once more", async () => {
    const { sleep } = sleeps();
    let calls = 0;
    await expect(withRetry(async () => { calls += 1; throw failure(503); }, sleep)).rejects.toMatchObject({ status: 503 });
    expect(calls).toBe(2);
  });

  it("stops retrying once cancelled", async () => {
    const { waited, sleep } = sleeps();
    let calls = 0;
    await expect(withRetry(async () => { calls += 1; throw failure(429); }, sleep, () => true)).rejects.toMatchObject({ status: 429 });
    expect(calls).toBe(1);
    expect(waited).toEqual([]);
  });
});

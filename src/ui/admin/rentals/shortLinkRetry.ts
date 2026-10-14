// Retry rules and plain-language reasons for fetching many short links in a row. A burst of requests can be slowed or
// refused by the server or something in front of it, so transient answers are retried with a pause, while permanent
// ones (not signed in, not allowed, unsupported spot) are not.

/** Pauses (ms) before each retry for a failed request. An empty list means do not retry. `status` is the HTTP status, or
 *  undefined when there was no response at all (a network error). */
export const retryDelaysFor = (status?: number): number[] => {
  if (status === undefined || status === 0) return [800, 1600, 3200]; // network hiccup
  if (status === 429) return [1500, 3000, 6000, 10000];               // told to slow down
  if (status === 502 || status === 504) return [800, 1600, 3200];
  if (status === 403) return [2000];                                   // a proxy's bot/rate challenge looks like this; a genuine "not allowed" fails again fast
  if (status === 503) return [800];                                    // also the server's answer for "cannot make a link" (e.g. localhost)
  return [];
};

/** Spacing (ms) each worker leaves between requests so a long list is not sent as one burst. */
export const LINK_SPACING_MS = 120;

/** Pause to use before a retry: the server's Retry-After (seconds) if it sent one, otherwise our schedule. */
export const nextDelay = (scheduled: number, retryAfterSeconds?: number | null): number =>
  retryAfterSeconds && retryAfterSeconds > 0 ? Math.min(retryAfterSeconds * 1000, 30000) : scheduled;

export const statusPhrase = (status?: number): string => {
  if (status === undefined || status === 0) return "no response from the server";
  if (status === 429) return "too many requests (429)";
  if (status === 401 || status === 403) return `not signed in or not allowed (${status})`;
  if (status === 404) return "spot not found (404)";
  if (status === 422) return "unsupported link (422)";
  if (status === 503) return "short link unavailable (503)";
  return `HTTP ${status}`;
};

/** "too many requests (429)" for one reason, or "too many requests (429); short link unavailable (503)" for several. */
export const summarizeFailures = (statuses: Array<number | undefined>): string =>
  Array.from(new Set(statuses.map(statusPhrase))).join("; ");

/** Runs the request, retrying transient failures on the schedule above. Throws the last error when retries run out
 *  or the failure is not worth retrying. `sleep` is injected so tests do not wait. */
export const withRetry = async <T>(
  attemptRequest: () => Promise<T>,
  sleep: (ms: number) => Promise<void>,
  cancelled: () => boolean = () => false,
): Promise<T> => {
  for (let attempt = 0; ; attempt++) {
    try {
      return await attemptRequest();
    } catch (e) {
      const error = e as { status?: number; retryAfter?: number };
      const delays = retryDelaysFor(error.status);
      if (attempt >= delays.length || cancelled()) throw e;
      await sleep(nextDelay(delays[attempt], error.retryAfter));
    }
  }
};


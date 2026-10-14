export interface ShortLink { code: string; short_url: string; }
export interface ShortLinkError extends Error { status?: number; retryAfter?: number; }
export const createShortLink = async (target_url: string): Promise<ShortLink> => {
  const token = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]*)/);
  const response = await fetch("/api/shortcodes", {
    method: "POST", credentials: "include", cache: "no-store",
    headers: { "Content-Type": "application/json", "X-XSRF-TOKEN": token ? decodeURIComponent(token[1]) : "" },
    body: JSON.stringify({ target_url }),
  });
  if (!response.ok) {
    // The status and Retry-After let callers that make many links in a row back off and explain what happened.
    throw Object.assign(new Error("Could not create the short link. Please try again."), {
      status: response.status, retryAfter: Number(response.headers?.get?.("Retry-After")) || undefined,
    });
  }
  return response.json();
};

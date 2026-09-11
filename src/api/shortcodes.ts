export interface ShortLink { code: string; short_url: string; }
export const createShortLink = async (target_url: string): Promise<ShortLink> => {
  const token = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]*)/);
  const response = await fetch("/api/shortcodes", {
    method: "POST", credentials: "include", cache: "no-store",
    headers: { "Content-Type": "application/json", "X-XSRF-TOKEN": token ? decodeURIComponent(token[1]) : "" },
    body: JSON.stringify({ target_url }),
  });
  if (!response.ok) throw new Error("Could not create the short link. Please try again.");
  return response.json();
};

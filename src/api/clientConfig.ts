export interface ClientConfig {
  wiki_url: string;
}

let configPromise: Promise<ClientConfig> | undefined;

export const getClientConfig = (): Promise<ClientConfig> => {
  if (!configPromise) {
    if (typeof fetch !== "function") {
      return Promise.resolve({ wiki_url: "" });
    }
    configPromise = fetch("/api/config", {
      headers: { "Content-Type": "application/json" },
    })
      .then(async response => {
        if (!response.ok) throw new Error("Unable to load portal configuration.");
        const config = await response.json();
        return {
          wiki_url: String(config.wiki_url || "").replace(/\/+$/, ""),
        };
      })
      .catch(error => {
        configPromise = undefined;
        throw error;
      });
  }
  return configPromise;
};

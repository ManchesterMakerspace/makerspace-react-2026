export interface ClientConfig {
  wiki_url: string;
  firebase_api_key?: unknown;
  firebase_project_id?: unknown;
  firebase_auth_domain?: unknown;
  firebase_auth_type?: unknown;
  turnstile_site_key?: unknown;
}

let configRequest: Promise<ClientConfig> | undefined;

/** Load public runtime configuration supplied by Rails. */
export const loadClientConfig = (): Promise<ClientConfig> => {
  if (configRequest) return configRequest;

  if (typeof fetch !== "function") {
    return Promise.resolve({ wiki_url: "" });
  }

  configRequest = fetch("/api/config", {
    headers: { "Content-Type": "application/json" },
  })
    .then(async response => {
      if (!response.ok) {
        throw new Error("Failed to load client configuration from server.");
      }

      const config = await response.json() as ClientConfig;
      return {
        ...config,
        wiki_url: String(config.wiki_url || "").replace(/\/+$/, ""),
      };
    })
    .catch(error => {
      // Allow a transient network/configuration failure to be retried later.
      configRequest = undefined;
      throw error;
    });

  return configRequest;
};

/** Backward-compatible name used by consumers that only need Wiki configuration. */
export const getClientConfig = loadClientConfig;

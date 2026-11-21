export interface ClientConfig {
  wiki_url: string;
  app_domain?: string;
  firebase_api_key?: unknown;
  firebase_project_id?: unknown;
  firebase_auth_domain?: unknown;
  firebase_auth_type?: unknown;
  turnstile_site_key?: unknown;
  volunteer_task_max_credit?: number;
}

let configRequest: Promise<ClientConfig> | undefined;

/** Fresh reads bypass the shared snapshot without changing other callers' cache. */
export const loadClientConfig = ({ refresh = false }: { refresh?: boolean } = {}): Promise<ClientConfig> => {
  if (configRequest && !refresh) return configRequest;

  if (typeof fetch !== "function") {
    return Promise.resolve({ wiki_url: "" });
  }

  const request = fetch("/api/config", {
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
      if (configRequest === request) configRequest = undefined;
      throw error;
    });

  if (!refresh) configRequest = request;
  return request;
};

/** Backward-compatible name used by consumers that only need Wiki configuration. */
export const getClientConfig = loadClientConfig;

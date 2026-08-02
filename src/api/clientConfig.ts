export interface ClientConfig {
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

  configRequest = fetch("/api/config", {
    headers: { "Content-Type": "application/json" }
  }).then(async response => {
    if (!response.ok) {
      throw new Error("Failed to load client configuration from server.");
    }

    return response.json() as Promise<ClientConfig>;
  });

  // Allow a transient network/configuration failure to be retried later.
  configRequest.catch(() => {
    configRequest = undefined;
  });

  return configRequest;
};

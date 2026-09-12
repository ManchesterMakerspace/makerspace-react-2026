import { loadClientConfig } from "api/clientConfig";

export const configuredPublicUrl = async (path: string): Promise<string> => {
  const { app_domain } = await loadClientConfig();
  const domain = app_domain?.trim().replace(/^(?:https?:\/\/)+/i, "").replace(/\/+$/, "");
  if (!domain) throw new Error("Public domain is not configured");
  const base = new URL(`https://${domain}`);
  if (base.username || base.password || base.pathname !== "/" || base.search || base.hash) {
    throw new Error("Invalid public domain");
  }
  return `${base.origin}${path}`;
};

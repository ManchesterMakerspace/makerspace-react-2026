export const toolPublicUrl = (domain: string | undefined, toolId: string): string => {
  if (!domain?.trim() || /[/?#@]/.test(domain)) throw new Error("Public tool links are not configured.");
  const origin = new URL(`https://${domain.trim()}`);
  return `${origin.origin}/api/tool/${encodeURIComponent(toolId)}/public.html`;
};

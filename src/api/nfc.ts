import { normalizeUid } from '../nfc/uid';
export interface NfcCard {
  id: string; uid: string; holder: string; expiry?: number; validity: string;
  member_id?: string; releasable: boolean; release_reason?: string; version: string;
}
export async function nfcRequest(path: string, options: RequestInit = {}) {
  const token = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]*)/);
  const response = await fetch(path, { ...options, credentials: 'include', cache: 'no-store',
    headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': token ? decodeURIComponent(token[1]) : '', ...options.headers } });
  if (response.status === 204) return null;
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(typeof body.error === 'string' ? body.error : body.error?.message || body.message || `Request failed (${response.status}).`), { status: response.status });
  return body;
}
export async function lookupNfcCard(uid: string, signal?: AbortSignal): Promise<NfcCard | null> {
  try { return await nfcRequest(`/api/admin/cards/lookup?uid=${encodeURIComponent(normalizeUid(uid))}`, { signal }); }
  catch (error) { if ((error as any).status === 404) return null; throw error; }
}
export const releaseNfcCard = (card: NfcCard, signal?: AbortSignal) => nfcRequest(`/api/admin/cards/${encodeURIComponent(card.id)}`, {
  method: 'DELETE', body: JSON.stringify({ version: card.version }), signal,
});

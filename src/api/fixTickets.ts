export interface FixPerson { id: string; name: string }
export interface FixTicket {
  closedBy?: FixPerson | null;
  toolHidden?: boolean;
  id: string; title: string; description: string; category: string; status: string; confirmation: string;
  priority: number | null; submittedPriority: number | null; shopId?: string; shopName?: string;
  toolId?: string; toolName?: string; uncataloguedTool?: string; outOfService: boolean;
  publicReadOnly: boolean; iBrokeIt: boolean; iCanFixIt: boolean; assignees: FixPerson[];
  announceToSlack: boolean; announcementNote: string; bountyId?: string; bountyUrl?: string;
  rewardStatus?: string; revision: number; createdAt: string; updatedAt: string; deliveryFailed?: boolean;
  capabilities: Record<string, boolean>;
  events?: { id: string; kind: string; note?: string; actor: string; createdAt: string; changes: Record<string, unknown> }[];
}
export interface FixCatalog {
  bountyMaxCredit?: number;
  assignees?: FixPerson[];
  shops: FixPerson[]; tools: (FixPerson & { shopId: string; outOfService: boolean })[];
  creationUnavailableReason?: string | null;
  canCreate: boolean; openCount: number; openLimit: number | null; centralSlackEnabled: boolean;
}
export const statuses = ['open', 'in_progress', 'waiting_for_parts', 'resolved', 'rejected', 'withdrawn'];
export const activeStatuses = statuses.slice(0, 3);
export const confirmations = ['unverified', 'confirmed', 'could_not_confirm'];
export const categories = ['damaged', 'broken', 'missing', 'other'];
export const fixLabel = (value: string) => value.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());
export async function fixRequest<T>(path: string, body?: unknown, method = 'POST'): Promise<T> {
  const token = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]*)/)?.[1];
  const response = await fetch(path, { credentials: 'include', cache: 'no-store',
    method: body === undefined ? 'GET' : method,
    headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': token ? decodeURIComponent(token) : '' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : data.message || `Request failed (${response.status}). Refresh and try again.`);
  return data;
}

export const fixNameHint = 'Use letters A-Z, numbers, spaces, and . , _ ( ) / -.';
export const invalidFixName = (value: string = '') => /[^A-Za-z0-9 .,_()\/\-]/.test(value);

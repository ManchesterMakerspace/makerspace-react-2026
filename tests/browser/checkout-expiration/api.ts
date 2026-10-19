export const listToolCheckouts = async () => ({ data: [
  { id: 'old', expiresOn: '2020-01-01' }, { id: 'never' }, { id: 'revoked', revokedAt: '2020-01-01' }, { id: 'history', supersededById: 'old' }
] });
export const updateCheckoutExpiration = async (checkout: any, date: string | null) => {
  (window as any).lastWrite = { id: checkout.id, expirationRevision: checkout.expirationRevision, expiresOn: date }; return { data: {} };
};
export const createToolCheckoutRequest = async (request: any) => { (window as any).lastRequest = request; return { data: {} }; };
export const bulkUpdateCheckoutExpirations = async (id: string, date: string) => {
  (window as any).lastBulk = { id, date }; return { data: { affectedCount: 2 } };
};

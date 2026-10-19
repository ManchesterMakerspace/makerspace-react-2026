const mockPatch = jest.fn(), mockPost = jest.fn(), mockGet = jest.fn();
jest.mock('axios', () => ({ __esModule: true, default: { create: () => ({
  patch: mockPatch, post: mockPost, get: mockGet, interceptors: { request: { use: jest.fn() } },
}) } }));
jest.mock('ui/common/globalAuthInterceptor', () => ({ attachGlobalAuthInterceptor: (api: unknown) => api }));
import { updateCheckoutExpiration, bulkUpdateCheckoutExpirations, listMemberCheckouts } from 'api/toolCheckouts';
import { ToolCheckout } from 'app/entities/toolCheckout';

describe('checkout expiration API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    [mockPatch, mockPost, mockGet].forEach(mock => mock.mockResolvedValue({ data: {}, headers: {} }));
  });
  it('sends null explicitly for Never and preserves the optimistic revision', async () => {
    await updateCheckoutExpiration({ id: 'one', expirationRevision: 5 } as ToolCheckout, null);
    expect(mockPatch).toHaveBeenCalledWith('/api/admin/tool_checkouts/one/expiration', { expires_on: null, expiration_revision: 5 });
  });
  it('sends bulk dates as date-only strings', async () => {
    await bulkUpdateCheckoutExpirations('tool', '2027-10-19');
    expect(mockPost).toHaveBeenCalledWith('/api/admin/tools/tool/checkout_expirations', { expires_on: '2027-10-19' });
  });
  it('requests expired checkouts without accidentally filtering them to active records', async () => {
    await listMemberCheckouts({ status: 'expired', includeHidden: true });
    expect(mockGet).toHaveBeenCalledWith('/api/tool_checkouts', { params: { status: 'expired', include_hidden: true } });
  });
});

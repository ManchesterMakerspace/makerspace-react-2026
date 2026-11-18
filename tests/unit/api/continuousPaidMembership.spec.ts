const mockGet = jest.fn(), mockPut = jest.fn(), mockUse = jest.fn();
jest.mock('axios', () => ({ __esModule: true, default: { create: () => ({
  get: mockGet, put: mockPut, interceptors: { request: { use: mockUse } },
}) } }));
jest.mock('ui/common/globalAuthInterceptor', () => ({ attachGlobalAuthInterceptor: (api: unknown) => api }));
import { getContinuousPaidMembership, increaseContinuousPaidMembership, PaidMembershipError } from 'api/continuousPaidMembership';

describe('paid membership authenticated API transport', () => {
  beforeEach(() => {
    mockGet.mockResolvedValue({ data: { continuousPaidMembershipMonths: 3, revision: 2, estimated: false } });
    mockPut.mockResolvedValue({ data: { continuousPaidMembershipMonths: 4, revision: 3, estimated: false } });
  });
  it('uses dedicated encoded endpoints and preserves the correction revision/reason', async () => {
    await getContinuousPaidMembership('one/two');
    expect(mockGet).toHaveBeenCalledWith('/api/members/one%2Ftwo/continuous_paid_membership');
    const body = { continuousPaidMembershipMonths: 4, expectedRevision: 2, reason: 'Verified' };
    await increaseContinuousPaidMembership('one', body);
    expect(mockPut).toHaveBeenCalledWith('/api/admin/members/one/continuous_paid_membership', body);
  });
  it('reads the current CSRF cookie for each request', () => {
    document.cookie = 'XSRF-TOKEN=new%20token';
    const headers = { set: jest.fn() };
    mockUse.mock.calls[0][0]({ headers });
    expect(headers.set).toHaveBeenCalledWith('X-XSRF-TOKEN', 'new token');
  });
  it('preserves conflict status and the server recovery message', async () => {
    mockPut.mockRejectedValueOnce({ response: { status: 409, data: { error: { message: 'Refresh and review' } } } });
    await expect(increaseContinuousPaidMembership('one', { continuousPaidMembershipMonths: 4, expectedRevision: 2, reason: 'Verified' }))
      .rejects.toEqual(expect.objectContaining({ status: 409, message: 'Refresh and review' }));
  });
});

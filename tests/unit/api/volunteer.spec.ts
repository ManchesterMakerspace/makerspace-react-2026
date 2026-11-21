const mockPost = jest.fn(), mockPut = jest.fn();
jest.mock('axios', () => ({ __esModule: true, default: { create: () => ({
  post: mockPost, put: mockPut, interceptors: { request: { use: jest.fn() } },
}) } }));
jest.mock('ui/common/globalAuthInterceptor', () => ({ attachGlobalAuthInterceptor: (api: unknown) => api }));
import { adminCreateVolunteerTask, adminUpdateVolunteerTask, adminCreateVolunteerEvent, adminUpdateVolunteerEvent } from 'api/volunteer';

describe('volunteer API validation and weekdays', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    [mockPost, mockPut].forEach(mock => mock.mockResolvedValue({ data: {}, headers: {} }));
  });

  it('preserves Sunday, clears Any day explicitly, and omits unknown weekday edits', async () => {
    await adminCreateVolunteerTask({ body: { title: 'Clean', status: 'reusable', dayOfWeek: 0 } });
    expect(mockPost.mock.calls[0][1].day_of_week).toBe(0);
    await adminUpdateVolunteerTask({ id: 'task', body: { dayOfWeek: null } });
    expect(mockPut.mock.calls[0][1]).toHaveProperty('day_of_week', null);
    await adminUpdateVolunteerTask({ id: 'task', body: { title: 'Rename' } });
    expect(mockPut.mock.calls[1][1]).not.toHaveProperty('day_of_week');
  });

  it.each([
    ['task creation', () => adminCreateVolunteerTask({ body: { creditValue: 5 } }), mockPost],
    ['task editing', () => adminUpdateVolunteerTask({ id: 'task', body: { creditValue: 5 } }), mockPut],
    ['event creation', () => adminCreateVolunteerEvent({ body: { creditValue: 5 } }), mockPost],
    ['event editing', () => adminUpdateVolunteerEvent({ id: 'event', body: { creditValue: 5 } }), mockPut],
  ] as const)('shows field validation rather than an error code for %s', async (_label, call, request) => {
    request.mockRejectedValueOnce({ message: 'Request failed with status code 422', response: {
      status: 422, data: { error: 'unprocessable_content', message: 'Credit value cannot exceed 3.5 credits.',
        errors: { credit_value: ['cannot exceed the configured maximum of 3.5 credits.'] } },
    } });
    const result: any = await call();
    expect(result.error.message).toContain('3.5 credits');
    expect(result.error.message).not.toContain('unprocessable');
    expect(result.response.status).toBe(422);
  });

  it('retains an actionable validation message when the server returns no field map', async () => {
    mockPost.mockRejectedValueOnce({ response: { status: 422, data: {
      error: 'unprocessable_content', message: 'Choose a positive credit value.',
    } } });
    const result: any = await adminCreateVolunteerEvent({ body: { creditValue: -1 } });
    expect(result.error.message).toBe('Choose a positive credit value.');
  });
});

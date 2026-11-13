import type { APIRequestContext } from '@playwright/test';
import { createRentalFixture, TOTE_PLAN } from '../../e2e/fixtures/rental';

jest.mock('@playwright/test', () => ({
  expect: (actual: unknown) => expect(actual),
  test: { extend: jest.fn() },
}));

const response = (status = 200, body: unknown = {}) => ({
  status: () => status, json: async () => body,
});

describe('rental attempt isolation', () => {
  const originalEnv = process.env.BT_ENV;
  afterEach(() => {
    if (originalEnv === undefined) delete process.env.BT_ENV;
    else process.env.BT_ENV = originalEnv;
  });

  function requestFixture() {
    let token = 'initial%2Btoken';
    let memberNumber = 0;
    return {
      get: jest.fn(async (path: string) => response(200,
        path === '/api/invoice_options' ? [{ id: 'plan', name: TOTE_PLAN }] : {})),
      storageState: jest.fn(async () => ({ cookies: [{ name: 'XSRF-TOKEN', value: token }] })),
      post: jest.fn(async (path: string) => {
        if (path === '/api/members/sign_in') token = 'rotated%2Btoken';
        if (path === '/api/admin/members') return response(200, { id: `member-${++memberNumber}` });
        if (path.endsWith('/update_password')) return response(204);
        return response(200, { id: 'type' });
      }),
      put: jest.fn(async () => response()),
      delete: jest.fn(async () => response(204)),
    };
  }

  it('provisions a different member and spot after an attempt leaves its rental/payment behind', async () => {
    process.env.BT_ENV = 'sandbox';
    const request = requestFixture();
    // Intentionally no cleanup between attempts: the payment can still be in flight.
    const first = await createRentalFixture(request as unknown as APIRequestContext);
    const retry = await createRentalFixture(request as unknown as APIRequestContext);
    expect(retry.email).not.toBe(first.email);
    expect(retry.memberId).not.toBe(first.memberId);
    expect(retry.spotNumber).not.toBe(first.spotNumber);
    const types = request.post.mock.calls.filter(([path]) => path === '/api/admin/rental_types');
    expect(types).toHaveLength(2);
    // Inspect request arguments without coupling the fake's handler to their shape.
    const calls = request.post.mock.calls as unknown as [string, { data: any; headers: any }][];
    const typeCalls = calls.filter(([path]) => path === '/api/admin/rental_types');
    expect(typeCalls[0][1].data.displayName).not.toBe(typeCalls[1][1].data.displayName);
    expect(typeCalls[0][1].headers['X-XSRF-TOKEN']).toBe('rotated+token');
    expect(calls.filter(([path]) => path === '/api/billing/payment_methods')).toHaveLength(2);
    const memberCalls = calls.filter(([path]) => path === '/api/admin/members');
    expect(memberCalls[0][1].data).toMatchObject({
      phone: '6035550100', memberContractOnFile: true,
      address: { street: '12 Test Street', city: 'Manchester', state: 'NH', postalCode: '03101' },
    });
  });

  it('refuses non-sandbox setup before making requests', async () => {
    process.env.BT_ENV = 'production';
    const request = requestFixture();
    await expect(createRentalFixture(request as unknown as APIRequestContext)).rejects.toThrow('BT_ENV=sandbox');
    expect(request.get).not.toHaveBeenCalled();
  });

  it('stops on a rejected fixture mutation instead of running with partial data', async () => {
    process.env.BT_ENV = 'sandbox';
    const request = requestFixture();
    request.put.mockResolvedValue(response(422));
    await expect(createRentalFixture(request as unknown as APIRequestContext)).rejects.toThrow();
    expect(request.post.mock.calls.some(([path]) => path === '/api/billing/payment_methods')).toBe(false);
  });

  it('supports Rails test mode, which does not issue a CSRF cookie', async () => {
    process.env.BT_ENV = 'sandbox';
    const request = requestFixture();
    request.storageState.mockResolvedValue({ cookies: [] });
    await expect(createRentalFixture(request as unknown as APIRequestContext)).resolves.toHaveProperty('spotNumber');
  });
});

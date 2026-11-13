import { randomUUID } from 'crypto';
import { APIRequestContext, expect, test as base } from '@playwright/test';
import { adminMember } from './testData';

export const TOTE_PLAN = 'Monthly Tote Rental';

export const uniqueRentalNames = () => {
  const suffix = randomUUID();
  return { typeName: `Green Tote ${suffix}`, spotNumber: `GT-${suffix}` };
};

// Fresh records for every attempt, including retries and --repeat-each runs.
// A timed-out payment may still finish on Rails: never reuse its member,
// outstanding invoices, rental spot, or Braintree customer on the next attempt.
export async function createRentalFixture(request: APIRequestContext) {
  if (process.env.BT_ENV !== 'sandbox') {
    throw new Error('Rental payment fixtures require BT_ENV=sandbox');
  }
  const { typeName, spotNumber } = uniqueRentalNames();
  const email = `e2e_rental_${randomUUID()}@test.com`;
  const password = 'RentalTest1!';
  const config = await request.get('/api/config');
  expect(config.status(), 'Bootstrap rental fixture session').toBe(200);

  const headers = async () => {
    const { cookies } = await request.storageState();
    const csrf = cookies.find(cookie => cookie.name === 'XSRF-TOKEN');
    // Rails test mode omits the cookie; other environments require the current
    // token, which can change after sign-in or sign-out.
    return { Accept: 'application/json', 'X-XSRF-TOKEN': csrf ? decodeURIComponent(csrf.value) : '' };
  };
  const post = async (path: string, data: object, status = 200) => {
    const response = await request.post(path, { headers: await headers(), data, timeout: 60_000 });
    expect(response.status(), `Rental fixture POST ${path}`).toBe(status);
    return status === 204 ? undefined : response.json();
  };

  await post('/api/members/sign_in', { member: adminMember });
  const optionsResponse = await request.get('/api/invoice_options', {
    params: { 'types[]': 'rental', only_enabled: true },
  });
  expect(optionsResponse.status()).toBe(200);
  const options = await optionsResponse.json();
  const plan = options.find(option => option.name === TOTE_PLAN);
  expect(plan, `Seeded ${TOTE_PLAN} invoice option`).toBeDefined();
  const rentalType = await post('/api/admin/rental_types', {
    displayName: typeName, invoiceOptionId: plan.id, active: true,
  });
  await post('/api/admin/rental_spots', {
    number: spotNumber, location: 'Classroom', description: 'Large Green Tote',
    rentalTypeId: rentalType.id, requiresApproval: false, active: true,
  });

  const member = await post('/api/admin/members', {
    firstname: 'Rental', lastname: 'Test', email, role: 'member',
    status: 'activeMember', memberContractOnFile: true,
    phone: '6035550100',
    address: { street: '12 Test Street', city: 'Manchester', state: 'NH', postalCode: '03101' },
  });
  const activated = await request.put(`/api/admin/members/${member.id}`, {
    headers: await headers(), data: { expirationTime: Date.now() + 30 * 86400_000 },
  });
  expect(activated.status(), 'Set fixture membership expiration').toBe(200);
  await post(`/api/admin/members/${member.id}/update_password`, { password }, 204);

  const logout = await request.delete('/api/members/sign_out', { headers: await headers() });
  expect(logout.status(), 'End admin fixture session').toBe(204);
  const memberConfig = await request.get('/api/config');
  expect(memberConfig.status(), 'Bootstrap member fixture session after logout').toBe(200);
  await post('/api/members/sign_in', { member: { email, password } });
  await post('/api/billing/payment_methods', { paymentMethodNonce: 'fake-valid-visa-nonce' });
  return { email, password, spotNumber, memberId: member.id };
}

export const test = base.extend<{ rentalFixture: Awaited<ReturnType<typeof createRentalFixture>> }>({
  // The API request fixture has its own cookie jar; the browser still signs in
  // through the UI. Setup gets a separate bounded budget for sandbox calls.
  rentalFixture: [async ({ request }, use) => {
    await use(await createRentalFixture(request));
  }, { timeout: 120_000 }],
});

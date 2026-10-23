import * as React from 'react';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { computeCapabilities } from 'app/permissions';
import FobIssuancePage from 'ui/fobIssuance/FobIssuancePage';

jest.mock('ui/nfc/ScanNfc', () => ({ __esModule: true, default: () => null }));

const newcomer = {
  id: 'm1', firstname: 'Nina', lastname: 'Newcomer', email: 'nina@example.test', status: 'pending',
  addressStreet: '1 Test St', addressCity: 'Manchester', addressState: 'NH', addressPostalCode: '03101',
  memberContractOnFile: true,
};

const flush = async () => { await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); }); };

describe('fob issuer capability', () => {
  const active = { id: 'v', status: 'activeMember', expirationTime: Date.now() + 60000 } as any;
  it('needs the server flag and an active, unexpired membership', () => {
    expect(computeCapabilities({ ...active, isFobIssuer: true }).canIssueFobs).toBe(true);
    expect(computeCapabilities(active).canIssueFobs).toBe(false);
    expect(computeCapabilities({ ...active, isAdmin: true }).canIssueFobs).toBe(false);
    expect(computeCapabilities({ ...active, isFobIssuer: true, status: 'revoked' }).canIssueFobs).toBe(false);
    expect(computeCapabilities({ ...active, isFobIssuer: true, expirationTime: 1 }).canIssueFobs).toBe(false);
  });
});

describe('Issue a Key Fob page', () => {
  let container: HTMLDivElement, root: Root, fetchMock: jest.Mock;
  beforeAll(() => { (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; });
  beforeEach(() => {
    container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
    fetchMock = jest.fn(async (url: string, init?: RequestInit) => {
      const ok = (body: unknown) => ({ ok: true, json: async () => body });
      if (url.startsWith('/api/fob_issuance/members')) return ok([newcomer]);
      if (url === '/api/fob_issuance/cards/new') return ok({ uid: '04A1B2C3' });
      if (url === '/api/fob_issuance/cards' && init?.method === 'POST') return ok({ uid: '04A1B2C3' });
      throw new Error(`unexpected ${url}`);
    });
    (globalThis as any).fetch = fetchMock;
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); });

  const type = async (value: string) => {
    const input = container.querySelector('input') as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    await act(async () => { setter.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 400)); });
    await flush();
  };
  const click = async (selector: string) => {
    await act(async () => { (container.querySelector(selector) as HTMLElement).click(); });
    await flush();
  };

  it('does not search for fewer than two characters', async () => {
    act(() => root.render(<FobIssuancePage />));
    await type('N');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('walks a volunteer from search to an issued fob, and requires the ID check first', async () => {
    act(() => root.render(<FobIssuancePage />));
    await type('Nina');
    await click('#fob-issuance-member-m1');

    expect(container.querySelector('#fob-issuance-selected')!.textContent).toContain('1 Test St');

    await click('#fob-issuance-import');
    expect(container.querySelector('#fob-issuance-uid')!.textContent).toContain('04A1B2C3');

    await click('#fob-issuance-submit');
    expect(container.querySelector('#fob-issuance-error')!.textContent).toContain("Check the member's ID");
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);

    await click('#fob-issuance-id-verified');
    await click('#fob-issuance-submit');

    const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')!;
    expect(JSON.parse(post[1].body)).toEqual({ member_id: 'm1', uid: '04A1B2C3', source: 'import' });
    expect(container.querySelector('#fob-issuance-success')!.textContent).toContain('Nina Newcomer');
    expect(container.querySelector('#fob-issuance-selected')).toBeNull();
  });

  it('blocks issuing when the member contract is not on file', async () => {
    fetchMock.mockImplementation(async (url: string) => ({
      ok: true,
      json: async () => (url.startsWith('/api/fob_issuance/members') ? [{ ...newcomer, memberContractOnFile: false }] : { uid: '04A1' }),
    }));
    act(() => root.render(<FobIssuancePage />));
    await type('Nina');
    await click('#fob-issuance-member-m1');
    expect((container.querySelector('#fob-issuance-submit') as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows the server message when issuing is refused', async () => {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') return { ok: false, json: async () => ({ error: 'This member already has a key fob. Ask a board member to replace it.' }) };
      return { ok: true, json: async () => (url.startsWith('/api/fob_issuance/members') ? [newcomer] : { uid: '04A1B2C3' }) };
    });
    act(() => root.render(<FobIssuancePage />));
    await type('Nina');
    await click('#fob-issuance-member-m1');
    await click('#fob-issuance-import');
    await click('#fob-issuance-id-verified');
    await click('#fob-issuance-submit');
    expect(container.querySelector('#fob-issuance-error')!.textContent).toContain('already has a key fob');
  });
});

import * as React from 'react';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';

const mockGroups = jest.fn();
const mockLookup = jest.fn();
const mockStop = jest.fn();
let mockOnTag: ((tag: any) => void) | undefined;
let mockSupported = true;

jest.mock('api/toolCheckouts', () => ({
  listToolGroups: (...args: any[]) => mockGroups(...args),
  lookupToolCheckoutCard: (...args: any[]) => mockLookup(...args),
}));
jest.mock('../../../../src/nfc/scanner', () => ({
  nfcCapabilities: () => Promise.resolve({ supported: mockSupported, enabled: true }),
  scanNfc: jest.fn((_mode: string, onTag: any) => { mockOnTag = onTag; return mockStop; }),
}));
jest.mock('ui/reducer/hooks', () => ({ useAuthState: () => ({ currentUser: {} }) }));
jest.mock('ui/hooks/useReadTransaction', () => () => ({ data: [], refresh: jest.fn() }));
jest.mock('ui/hooks/useWriteTransaction', () => () => ({ call: jest.fn() }));
jest.mock('ui/common/Filters/QueryContext', () => ({ withQueryContext: (component: any) => component }));
jest.mock('ui/common/MemberSearchInput', () => ({ onChange, initialSelection }: any) =>
  <div>
    <span data-testid="member">{initialSelection?.label || ''}</span>
    <button onClick={() => onChange({ value: 'm-search', label: 'Search Person' })}>Choose member</button>
  </div>);
jest.mock('ui/common/FormModal', () => ({ children, onSubmit, submitDisabled }: any) =>
  <form onSubmit={event => { event.preventDefault(); onSubmit(); }}>{children}<button type="submit" disabled={submitDisabled}>Save</button></form>);
jest.mock('ui/toolCheckouts/GroupApproval', () => ({ group, memberId }: any) => <div>Review {group.name} for {memberId}</div>);
import { CheckoutModal } from 'ui/toolCheckouts/CheckoutRoster';

const shops = [{ id: 'wood', name: 'Woodshop' }] as any;
const tools = [{ id: 't1', shopId: 'wood', name: 'Bandsaw', prerequisiteNames: [] }] as any;
const preview = (overrides: any = {}) => ({
  memberId: 'm-fob', name: 'Pat Member', status: 'activeMember', eligible: true, error: null, unmetPrerequisites: [], ...overrides,
});

describe('fob scanning in the roster check-out dialog', () => {
  let host: HTMLDivElement;
  let root: Root;
  let onCheckout: jest.Mock;
  const buttonNamed = (text: string) =>
    Array.from(host.querySelectorAll('button')).find(button => button.textContent?.trim() === text);
  const click = async (element: Element | undefined) => { await act(async () => { (element as HTMLElement).click(); }); };
  const choose = async (label: string, value: string) => {
    const select = host.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`)!;
    await act(async () => { select.value = value; select.dispatchEvent(new Event('change', { bubbles: true })); });
  };
  const render = async () => {
    onCheckout = jest.fn();
    await act(async () => root.render(
      <CheckoutModal shops={shops} allShops={shops} tools={tools} onClose={jest.fn()} onCheckout={onCheckout} loading={false} error="" />));
  };
  const tap = async (uid = '04A1B2C3') => {
    await click(buttonNamed("Scan member's fob"));
    await act(async () => { mockOnTag!({ uid, urls: [], texts: [] }); });
  };
  const submit = () => act(async () => { host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });

  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    mockGroups.mockReset();
    mockLookup.mockReset();
    mockStop.mockReset();
    mockOnTag = undefined;
    mockSupported = true;
    mockGroups.mockResolvedValue({ data: [{ id: 'kit', shopId: 'wood', name: 'Wood kit', canApprove: true }] });
    host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
  });
  afterEach(() => { act(() => root.unmount()); host.remove(); });

  it('needs a tool or group chosen before it can scan', async () => {
    await render();

    expect((buttonNamed("Scan member's fob") as HTMLButtonElement).disabled).toBe(true);
    expect(host.textContent).toContain('Choose the shop and tool or group first');
  });

  it('hides the fob option when NFC is unavailable', async () => {
    mockSupported = false;
    await render();

    expect(buttonNamed("Scan member's fob")).toBeUndefined();
    expect(buttonNamed('Choose member')).toBeDefined();
  });

  it('selects the member from a fob tap for a tool and records the checkout as a fob sign-off', async () => {
    mockLookup.mockResolvedValue({ data: preview() });
    await render();
    await choose('Shop', 'wood');
    await choose('Tool', 't1');

    await tap();

    expect(mockLookup).toHaveBeenCalledWith({ toolId: 't1', toolGroupId: undefined, uid: '04A1B2C3' });
    expect(host.querySelector('[data-testid="member"]')!.textContent).toBe('Pat Member');
    await submit();
    expect(onCheckout).toHaveBeenCalledWith('m-fob', 't1', 'fob');
  });

  it('looks the member up for a group and continues to the group review', async () => {
    mockLookup.mockResolvedValue({ data: preview() });
    await render();
    await choose('Shop', 'wood');
    await choose('Tool', 'group:kit');

    await tap();

    expect(mockLookup).toHaveBeenCalledWith({ toolId: undefined, toolGroupId: 'kit', uid: '04A1B2C3' });
    await submit();
    expect(host.textContent).toContain('Review Wood kit for m-fob');
    expect(onCheckout).not.toHaveBeenCalled();
  });

  it('blocks the checkout and says why when the member is not eligible', async () => {
    mockLookup.mockResolvedValue({ data: preview({ eligible: false, error: 'Membership has expired.', unmetPrerequisites: ['Safety Orientation'] }) });
    await render();
    await choose('Shop', 'wood');
    await choose('Tool', 't1');

    await tap();

    expect(host.textContent).toContain('Pat Member cannot be checked out here: Membership has expired. Missing: Safety Orientation.');
    expect((host.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows a refused fob (such as a lost one) and leaves the member unselected', async () => {
    mockLookup.mockResolvedValue({ error: { message: 'This fob has been reported lost or stolen and cannot be used.' } });
    await render();
    await choose('Shop', 'wood');
    await choose('Tool', 't1');

    await tap();

    expect(host.textContent).toContain('This fob has been reported lost or stolen and cannot be used.');
    expect(host.querySelector('[data-testid="member"]')!.textContent).toBe('');
  });

  it('records a member found by search without the fob source, even after an earlier fob tap', async () => {
    mockLookup.mockResolvedValue({ data: preview() });
    await render();
    await choose('Shop', 'wood');
    await choose('Tool', 't1');
    await tap();

    await click(buttonNamed('Choose member'));
    await submit();

    expect(onCheckout).toHaveBeenCalledWith('m-search', 't1', undefined);
  });
});

import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

const mockLookup = jest.fn();
const mockCreate = jest.fn();
const mockStopScan = jest.fn();
let mockOnTag: ((tag: any) => void) | undefined;
let mockOnScanError: ((error: Error) => void) | undefined;
let mockNfcSupported = true;

jest.mock('api/toolCheckouts', () => ({
  lookupToolCheckoutCard: (...args: any[]) => mockLookup(...args),
  adminCreateToolCheckout: (...args: any[]) => mockCreate(...args),
}));
jest.mock('../../../../src/nfc/scanner', () => ({
  nfcCapabilities: () => Promise.resolve({ supported: mockNfcSupported, enabled: true }),
  scanNfc: jest.fn((mode: string, onTag: any, onError: any) => { mockOnTag = onTag; mockOnScanError = onError; return mockStopScan; }),
}));
jest.mock('ui/common/MemberSearchInput', () => ({ onChange }: any) =>
  <button onClick={() => onChange({ value: 'm-search', label: 'Search Person' })}>pick member</button>);
import CheckoutMemberDialog from 'ui/workshops/CheckoutMemberDialog';
import { scanNfc } from '../../../../src/nfc/scanner';

const tool = { id: 't1', name: 'Laguna Bandsaw' };
const preview = (overrides: any = {}) => ({
  memberId: 'm-fob', name: 'Pat Member', status: 'activeMember', expirationTime: Date.UTC(2027, 0, 15),
  eligible: true, error: null, unmetPrerequisites: [], ...overrides,
});

const buttonNamed = (text: string) =>
  Array.from(document.body.querySelectorAll('button')).find(button => button.textContent?.trim() === text);
const click = async (element: Element | undefined) => { await act(async () => { (element as HTMLElement).click(); }); };

let onClose: jest.Mock;
let onDone: jest.Mock;
let unmount: () => void;

const render = async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  onClose = jest.fn();
  onDone = jest.fn();
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(<CheckoutMemberDialog tool={tool} onClose={onClose} onDone={onDone} />));
  unmount = () => { act(() => root.unmount()); host.remove(); };
};

const tapFob = async (uid = '04A1B2C3') => {
  await click(buttonNamed("Scan member's fob"));
  await act(async () => { mockOnTag!({ uid, urls: [], texts: [] }); });
};

beforeEach(() => {
  mockLookup.mockReset();
  mockCreate.mockReset();
  mockStopScan.mockReset();
  (scanNfc as jest.Mock).mockClear();
  mockOnTag = undefined;
  mockOnScanError = undefined;
  mockNfcSupported = true;
  mockCreate.mockResolvedValue({ data: { id: 'checkout-1' } });
});
afterEach(() => unmount && unmount());

it('looks the member up after a fob tap and records nothing until the approver confirms', async () => {
  mockLookup.mockResolvedValue({ data: preview() });
  await render();

  await tapFob();

  expect(scanNfc).toHaveBeenCalledWith('inspect', expect.any(Function), expect.any(Function));
  expect(mockLookup).toHaveBeenCalledWith({ toolId: 't1', uid: '04A1B2C3' });
  expect(document.body.textContent).toContain('Pat Member');
  expect(document.body.textContent).toContain('Make sure this is the person in front of you');
  expect(mockCreate).not.toHaveBeenCalled();

  await click(buttonNamed('Check Out'));

  expect(mockCreate).toHaveBeenCalledWith({ body: { memberId: 'm-fob', toolId: 't1', source: 'fob' } });
  expect(document.body.textContent).toContain('Pat Member is checked out on Laguna Bandsaw.');
  await click(buttonNamed('Done'));
  expect(onDone).toHaveBeenCalledTimes(1);
});

it('shows why a member cannot be checked out and keeps the button disabled', async () => {
  mockLookup.mockResolvedValue({ data: preview({ eligible: false, error: 'Membership has expired.', unmetPrerequisites: ['Safety Orientation'] }) });
  await render();

  await tapFob();

  expect(document.body.textContent).toContain('Membership has expired.');
  expect(document.body.textContent).toContain('Missing: Safety Orientation.');
  expect((buttonNamed('Check Out') as HTMLButtonElement).disabled).toBe(true);
  await click(buttonNamed('Check Out'));
  expect(mockCreate).not.toHaveBeenCalled();
});

it('shows the server message for a refused fob (such as a lost one) and offers to try again', async () => {
  mockLookup.mockResolvedValue({ error: { message: 'This fob has been reported lost or stolen and cannot be used.' } });
  await render();

  await tapFob();

  expect(document.body.textContent).toContain('This fob has been reported lost or stolen and cannot be used.');
  expect(buttonNamed("Scan member's fob")).toBeDefined();
  expect(mockCreate).not.toHaveBeenCalled();
});

it('checks out a member found by search without the fob source', async () => {
  await render();

  await click(buttonNamed('pick member'));
  expect(document.body.textContent).toContain('Search Person');
  await click(buttonNamed('Check Out'));

  expect(mockCreate).toHaveBeenCalledWith({ body: { memberId: 'm-search', toolId: 't1' } });
  expect(mockLookup).not.toHaveBeenCalled();
});

it('shows a failed checkout without leaving the confirmation', async () => {
  mockLookup.mockResolvedValue({ data: preview() });
  mockCreate.mockResolvedValue({ error: { message: 'Tool unavailable' } });
  await render();

  await tapFob();
  await click(buttonNamed('Check Out'));

  expect(document.body.textContent).toContain('Tool unavailable');
  expect(buttonNamed('Check Out')).toBeDefined();
  expect(onDone).not.toHaveBeenCalled();
});

it('returns from the confirmation to choosing a member', async () => {
  mockLookup.mockResolvedValue({ data: preview() });
  await render();

  await tapFob();
  await click(buttonNamed('Back'));

  expect(buttonNamed("Scan member's fob")).toBeDefined();
  expect(document.body.textContent).not.toContain('Pat Member');
});

it('hides the fob option when NFC is unavailable and still offers search', async () => {
  mockNfcSupported = false;
  await render();

  expect(buttonNamed("Scan member's fob")).toBeUndefined();
  expect(buttonNamed('pick member')).toBeDefined();
});

it('stops the scanner on cancel and when the dialog unmounts', async () => {
  await render();

  await click(buttonNamed("Scan member's fob"));
  await click(buttonNamed('Cancel'));
  expect(mockStopScan).toHaveBeenCalled();
  expect(buttonNamed("Scan member's fob")).toBeDefined();

  mockStopScan.mockClear();
  await click(buttonNamed("Scan member's fob"));
  unmount();
  unmount = () => {};
  expect(mockStopScan).toHaveBeenCalled();
});

it('reports a scanner error and returns to choosing', async () => {
  await render();

  await click(buttonNamed("Scan member's fob"));
  await act(async () => { mockOnScanError!(new Error('NFC is turned off.')); });

  expect(document.body.textContent).toContain('NFC is turned off.');
  expect(buttonNamed("Scan member's fob")).toBeDefined();
});

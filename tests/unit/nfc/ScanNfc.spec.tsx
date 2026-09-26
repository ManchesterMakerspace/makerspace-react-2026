import * as React from 'react';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
let mockCaps = { canScanNfc: true, canManageNfcCards: false };
let mockRead: (tag: any) => void;
const mockStop = jest.fn();
const mockNavigate = jest.fn();
const mockLocation = { key: 'one' };
jest.mock('app/permissions', () => ({ useCapabilities: () => mockCaps }));
jest.mock('ui/reducer/hooks', () => ({ useAuthState: () => ({ currentUser: { id: 'operator' }, totpEnrollmentRequired: false }) }));
jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate, useLocation: () => mockLocation }));
jest.mock('../../../src/nfc/scanner', () => ({
  nfcCapabilities: async () => ({ supported: true, enabled: true }),
  scanNfc: jest.fn((_mode, read) => { mockRead = read; return mockStop; }),
}));
jest.mock('../../../src/native/transport', () => ({ portalOrigin: () => 'https://members.example.org' }));
jest.mock('api/nfc', () => ({ lookupNfcCard: jest.fn(), releaseNfcCard: jest.fn(), nfcRequest: jest.fn() }));
jest.mock('makerspace-ts-api-client', () => ({ getMember: jest.fn(), isApiErrorResponse: (result: any) => !!result.error }));
import ScanNfc from 'ui/nfc/ScanNfc';
import { scanNfc } from '../../../src/nfc/scanner';
import { lookupNfcCard, releaseNfcCard } from 'api/nfc';
import { getMember } from 'makerspace-ts-api-client';

const empty = { urls: [], texts: [], unsupported: [] };
const card = { id: 'card1', uid: '1B1A4D2F', member_id: 'member1', holder: 'Ada', validity: 'lost', releasable: true, version: 'version' };
describe('NFC interaction flows', () => {
  let root: Root; let host: HTMLDivElement;
  beforeAll(() => { (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; });
  beforeEach(() => {
    jest.clearAllMocks(); mockCaps = { canScanNfc: true, canManageNfcCards: false };
    host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
    (lookupNfcCard as jest.Mock).mockResolvedValue(card);
    (releaseNfcCard as jest.Mock).mockResolvedValue(null);
    (getMember as jest.Mock).mockResolvedValue({ data: { id: 'member1' } });
  });
  afterEach(() => { act(() => root.unmount()); host.remove(); });
  const click = async (label: string) => {
    const button = Array.from(document.querySelectorAll('button')).find(button => button.textContent === label);
    expect(button).toBeDefined();
    await act(async () => { button.click(); });
  };
  it('regular members scan only NDEF and navigate internally without card lookup', async () => {
    await act(async () => root.render(<ScanNfc />)); await click('SCAN NFC');
    expect(scanNfc).toHaveBeenCalledWith('ndef', expect.any(Function), expect.any(Function));
    await act(async () => mockRead({ ...empty, urls: ['https://members.example.org/volunteer/tasks/0123456789abcdef01234567'] }));
    expect(lookupNfcCard).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/volunteer/tasks/0123456789abcdef01234567');
  });
  it('waits for the member-details button before fetching the member', async () => {
    mockCaps.canManageNfcCards = true;
    await act(async () => root.render(<ScanNfc />)); await click('SCAN NFC');
    await act(async () => mockRead({ ...empty, uid: card.uid }));
    expect(getMember).not.toHaveBeenCalled(); expect(document.body.textContent).toContain('Ada');
    await click('View member details'); expect(getMember).toHaveBeenCalledWith({ id: 'member1' });
  });
  it('releases only by explicit action and reports confirmed success', async () => {
    mockCaps.canManageNfcCards = true;
    await act(async () => root.render(<ScanNfc />)); await click('SCAN NFC');
    await act(async () => mockRead({ ...empty, uid: card.uid }));
    expect(releaseNfcCard).not.toHaveBeenCalled(); await click('RELEASE CARD');
    expect(releaseNfcCard).toHaveBeenCalledWith(card, expect.any(AbortSignal));
    expect(document.body.textContent).toContain('Released, reusable');
  });
  it('never treats a lookup failure as an available enrollment UID', async () => {
    mockCaps.canManageNfcCards = true;
    (lookupNfcCard as jest.Mock).mockRejectedValue(new Error('Server unavailable'));
    const candidate = jest.fn();
    await act(async () => root.render(<ScanNfc onUid={candidate} />)); await click('SCAN NFC');
    await act(async () => mockRead({ ...empty, uid: card.uid }));
    expect(candidate).not.toHaveBeenCalled(); expect(document.body.textContent).toContain('Server unavailable');
  });
  it('fills the enrollment candidate only for an unregistered UID', async () => {
    mockCaps.canManageNfcCards = true; (lookupNfcCard as jest.Mock).mockResolvedValue(null);
    const candidate = jest.fn();
    await act(async () => root.render(<ScanNfc onUid={candidate} />)); await click('SCAN NFC');
    await act(async () => mockRead({ ...empty, uid: card.uid })); expect(candidate).toHaveBeenCalledWith(card.uid);
  });
  it('ignores a late lookup after Cancel', async () => {
    mockCaps.canManageNfcCards = true;
    let resolve: (value: any) => void;
    (lookupNfcCard as jest.Mock).mockReturnValue(new Promise(done => { resolve = done; }));
    await act(async () => root.render(<ScanNfc />)); await click('SCAN NFC');
    await act(async () => mockRead({ ...empty, uid: card.uid })); await click('Cancel');
    await act(async () => resolve(card)); expect(document.body.textContent).not.toContain('Ada');
  });
});

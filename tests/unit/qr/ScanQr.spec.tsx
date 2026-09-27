import * as React from 'react';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
let mockAuth = { currentUser: { id: 'member' }, totpEnrollmentRequired: false };
const mockNavigate = jest.fn();
const mockLocation = { key: 'one' };
let mockRead: (value: string) => void;
let mockSignal: AbortSignal;
let mockNative = false;
let mockAppState: (state: { isActive: boolean }) => void;
const mockRemove = jest.fn();
const mockBrowserOpen = jest.fn(async (_options: any) => {});
jest.mock('@capacitor/browser', () => ({ Browser: { open: (options: any) => mockBrowserOpen(options) } }));
jest.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => mockNative } }));
jest.mock('@capacitor/app', () => ({ App: { addListener: jest.fn(async (_event, listener) => { mockAppState = listener; return { remove: mockRemove }; }) } }));
jest.mock('ui/reducer/hooks', () => ({ useAuthState: () => mockAuth }));
jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate, useLocation: () => mockLocation }));
jest.mock('../../../src/native/transport', () => ({ portalOrigin: () => 'https://members.example.org' }));
jest.mock('../../../src/ui/qr/camera', () => ({
  startQrCamera: jest.fn(async (_video, signal, read) => { mockRead = read; mockSignal = signal; }),
  cameraError: (error: Error) => error.message,
}));
jest.mock('app/scanLinks', () => ({ resolveScanLink: jest.fn() }));
import ScanQr, { QrController } from 'ui/qr/ScanQr';
import { startQrCamera } from 'ui/qr/camera';
import { resolveScanLink } from 'app/scanLinks';
import { closeTopmostDialog } from '../../../src/native/backButton';

describe('QR interaction', () => {
  let root: Root; let host: HTMLDivElement; let ref: React.RefObject<QrController>;
  beforeAll(() => { (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; });
  beforeEach(() => {
    jest.clearAllMocks(); mockNative = false; mockAuth = { currentUser: { id: 'member' }, totpEnrollmentRequired: false }; mockLocation.key = 'one';
    host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host); ref = React.createRef<QrController>();
    (resolveScanLink as jest.Mock).mockResolvedValue({ kind: 'internal', path: '/rentals' });
  });
  afterEach(() => { act(() => root.unmount()); host.remove(); });
  const render = () => act(async () => root.render(<ScanQr ref={ref} />));
  const start = async () => { await render(); await act(async () => ref.current.start()); };
  const click = async (label: string) => act(async () => Array.from(document.querySelectorAll('button')).find(button => button.textContent === label).click());
  it('starts on demand and accepts only the first decoded frame', async () => {
    await render(); expect(startQrCamera).not.toHaveBeenCalled();
    await act(async () => ref.current.start());
    await act(async () => { mockRead('one'); mockRead('one'); });
    expect(resolveScanLink).toHaveBeenCalledTimes(1); expect(mockNavigate).toHaveBeenCalledWith('/rentals'); expect(mockSignal.aborted).toBe(true);
  });
  it('leaves external links for an explicit open action', async () => {
    (resolveScanLink as jest.Mock).mockResolvedValue({ kind: 'external', url: 'https://example.org/' });
    await start(); await act(async () => mockRead('external'));
    expect(document.body.textContent).toContain('Open in browser'); expect(mockNavigate).not.toHaveBeenCalled();
  });
  it.each(['cancel', 'back', 'route', 'logout', 'background'])('cancels pending resolution on %s', async reason => {
    let finish: (value: any) => void;
    (resolveScanLink as jest.Mock).mockReturnValue(new Promise(resolve => { finish = resolve; }));
    await start(); await act(async () => mockRead('code'));
    if (reason === 'cancel') await click('Cancel');
    if (reason === 'back') await act(async () => { expect(closeTopmostDialog()).toBe(true); });
    if (reason === 'route') { mockLocation.key = 'two'; await render(); }
    if (reason === 'logout') { mockAuth.currentUser.id = ''; await render(); }
    if (reason === 'background') await act(async () => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange'));
      Object.defineProperty(document, 'hidden', { configurable: true, value: false }); document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(mockSignal.aborted).toBe(true);
    await act(async () => finish({ kind: 'internal', path: '/rentals' })); expect(mockNavigate).not.toHaveBeenCalled();
    expect(startQrCamera).toHaveBeenCalledTimes(1);
  });
  it.each([false, true])('disallows scanning without a session or during TOTP enrollment (%s)', totp => {
    mockAuth = { currentUser: { id: totp ? 'member' : '' }, totpEnrollmentRequired: totp };
    return start().then(() => expect(startQrCamera).not.toHaveBeenCalled());
  });
  it('shows camera startup failures and allows retry', async () => {
    (startQrCamera as jest.Mock).mockRejectedValueOnce(new Error('Camera denied'));
    await start(); expect(document.body.textContent).toContain('Camera denied');
    await click('Scan Again'); expect(startQrCamera).toHaveBeenCalledTimes(2);
  });
  it('cancels startup on unmount', async () => {
    await start(); await act(async () => root.render(null)); expect(mockSignal.aborted).toBe(true);
  });
  it('stops native capture on inactivity and does not restart on resume', async () => {
    mockNative = true;
    await start(); await act(async () => { mockAppState({ isActive: false }); mockAppState({ isActive: true }); });
    expect(mockSignal.aborted).toBe(true); expect(startQrCamera).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).toContain('Scan stopped');
    await act(async () => root.render(null)); expect(mockRemove).toHaveBeenCalled();
  });
  it('opens external native links only after tapping Open in browser', async () => {
    mockNative = true;
    (resolveScanLink as jest.Mock).mockResolvedValue({ kind: 'external', url: 'https://example.org/' });
    await start(); await act(async () => mockRead('external'));
    expect(mockBrowserOpen).not.toHaveBeenCalled(); await click('Open in browser');
    expect(mockBrowserOpen).toHaveBeenCalledWith({ url: 'https://example.org/' });
  });
});

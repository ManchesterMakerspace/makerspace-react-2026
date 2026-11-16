import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
const mockProgrammer = { identify: jest.fn(), programCredential: jest.fn(), cancel: jest.fn(async () => {}), addListener: jest.fn(async () => ({ remove: jest.fn() })) };
jest.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => 'android', isPluginAvailable: () => true }, registerPlugin: () => mockProgrammer }));
jest.mock('ui/reducer/hooks', () => ({ useAuthState: () => ({ currentUser: { id: 'actor' }, totpEnrollmentRequired: false }) }));
jest.mock('api/nfc', () => ({ nfcRequest: jest.fn() }));
import { useCardEnrollment } from 'ui/nfc/CardEnrollment';
import { nfcRequest } from 'api/nfc';
let controller: ReturnType<typeof useCardEnrollment>;
function Fixture() { controller = useCardEnrollment('member', 'admin', true); return <div>{controller.progress}</div>; }
const material = { keyA: '1', keyB: '2', contents: 'data', digest: 'digest', version: 1 };
describe('native enrollment controller', () => {
  let root: ReturnType<typeof createRoot>, host: HTMLDivElement;
  beforeAll(() => { (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; });
  beforeEach(async () => {
    jest.clearAllMocks(); host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
    mockProgrammer.identify.mockResolvedValue({ uid: '00112233' });
    mockProgrammer.programCredential.mockResolvedValue({ uid: '00112233', digest: 'digest' });
    (nfcRequest as jest.Mock).mockImplementation(async path => path.endsWith('/commit') ? { state: 'completed' } : { id: 'attempt', revision: 2, state: 'pending', material: { ...material } });
    await act(async () => root.render(<Fixture />));
  });
  afterEach(() => { act(() => root.unmount()); host.remove(); });
  it('checks compatibility before preparation and commits only verified data', async () => {
    await act(async () => controller.enroll('00112233'));
    expect(mockProgrammer.identify.mock.invocationCallOrder[0]).toBeLessThan((nfcRequest as jest.Mock).mock.invocationCallOrder[0]);
    expect(mockProgrammer.programCredential).toHaveBeenCalledWith({ uid: '00112233', ...material });
    const commit = (nfcRequest as jest.Mock).mock.calls[1];
    expect(commit[0]).toBe('/api/admin/card_enrollments/attempt/commit');
    expect(JSON.parse(commit[1].body)).toEqual({ revision: 2, digest: 'digest' });
  });
  it('leaves unsupported devices on fallback without creating pending material', async () => {
    mockProgrammer.identify.mockRejectedValue(new Error('Unsupported'));
    await act(async () => { await expect(controller.enroll('00112233')).rejects.toThrow('Unsupported'); });
    expect(nfcRequest).not.toHaveBeenCalled();
  });
  it('does not commit failed readback', async () => {
    mockProgrammer.programCredential.mockRejectedValue(new Error('Readback failed'));
    await act(async () => { await expect(controller.enroll('00112233')).rejects.toThrow('Readback failed'); });
    expect(nfcRequest).toHaveBeenCalledTimes(1);
  });
  it('recovers a lost commit response using secret-free status', async () => {
    (nfcRequest as jest.Mock).mockResolvedValueOnce({ id: 'attempt', revision: 2, state: 'pending', material: { ...material } }).mockRejectedValueOnce(new Error('Network')).mockResolvedValueOnce({ state: 'completed' });
    await act(async () => controller.enroll('00112233'));
    expect(nfcRequest).toHaveBeenCalledTimes(3);
  });
  it('ignores a late identify callback after cancellation', async () => {
    let resolve: (value: any) => void;
    mockProgrammer.identify.mockImplementation(() => new Promise(r => { resolve = r; }));
    let task: Promise<void>;
    await act(async () => { task = controller.enroll('00112233'); });
    await act(async () => { controller.cancel(); resolve({ uid: '00112233' }); await expect(task).rejects.toThrow('stopped'); });
    expect(nfcRequest).not.toHaveBeenCalled();
  });
});

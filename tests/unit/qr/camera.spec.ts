const mockDestroy = jest.fn();
const mockStart = jest.fn();
const mockList = jest.fn(async () => [{ id: 'rear', label: 'Rear' }]);
let mockDecode: (result: any) => void;
jest.mock('qr-scanner', () => ({ __esModule: true, default: class {
  static listCameras = mockList;
  constructor(_video: any, read: any) { mockDecode = read; }
  start = mockStart;
  destroy = mockDestroy;
} }));
import { cameraError, startQrCamera } from 'ui/qr/camera';
describe('camera ownership', () => {
  beforeEach(() => {
    jest.clearAllMocks(); mockStart.mockResolvedValue(undefined);
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: jest.fn(async () => ({ getTracks: () => [] })) } });
  });
  it('stops tracks before delivering a decoded QR and ignores duplicates', async () => {
    const video = document.createElement('video'); const stop = jest.fn(); const read = jest.fn();
    (navigator.mediaDevices.getUserMedia as jest.Mock).mockResolvedValue({ getTracks: () => [{ stop }] });
    await startQrCamera(video, new AbortController().signal, read, jest.fn());
    mockDecode({ data: 'abc' }); mockDecode({ data: 'abc' });
    expect(stop).toHaveBeenCalledTimes(1); expect(read).toHaveBeenCalledTimes(1);
    expect(stop.mock.invocationCallOrder[0]).toBeLessThan(read.mock.invocationCallOrder[0]);
  });
  it('releases a camera that arrives after permission-time cancellation', async () => {
    const video = document.createElement('video'); const stop = jest.fn(); const read = jest.fn();
    let finish: () => void;
    (navigator.mediaDevices.getUserMedia as jest.Mock).mockImplementation(() => new Promise(resolve => { finish = () => resolve({ getTracks: () => [{ stop }] }); }));
    const controller = new AbortController();
    const pending = startQrCamera(video, controller.signal, read, jest.fn());
    await Promise.resolve(); await Promise.resolve(); controller.abort(); finish(); await pending;
    expect(stop).toHaveBeenCalled(); expect(video.srcObject).toBeFalsy(); expect(read).not.toHaveBeenCalled();
  });
  it.each(['NotAllowedError', 'NotFoundError', 'NotReadableError'])('explains %s', name => {
    expect(cameraError({ name })).toContain('Scan Again');
  });
});

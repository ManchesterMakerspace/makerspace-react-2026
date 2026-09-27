import { Capacitor } from '@capacitor/core';

export type Camera = { id: string; label: string };

/** Owns one camera attempt, including permission requests that finish after cancellation. */
export async function startQrCamera(video: HTMLVideoElement, signal: AbortSignal,
  read: (value: string) => void, cameras: (values: Camera[]) => void, camera = 'environment') {
  if (!navigator.mediaDevices?.getUserMedia || (!window.isSecureContext && !Capacitor.isNativePlatform())) {
    throw new Error('Camera scanning is unavailable here. Use HTTPS and a browser or app with camera support.');
  }
  const { default: QrScanner } = await import(/* webpackChunkName: "qr-scanner" */ 'qr-scanner');
  if (signal.aborted) return;
  // Acquire directly to preserve permission/busy errors (the decoder collapses them).
  const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: camera === 'environment'
    ? { facingMode: { ideal: 'environment' } } : { deviceId: { ideal: camera } } });
  if (signal.aborted) { stream.getTracks().forEach(track => track.stop()); return; }
  video.srcObject = stream;
  let finished = false;
  let scanner: InstanceType<typeof QrScanner>;
  const overlay = document.createElement('div');
  // A static theme-colored frame avoids the decoder's animated yellow overlay.
  Object.assign(overlay.style, { border: '2px solid currentColor', borderRadius: '8px', boxSizing: 'border-box' });
  overlay.setAttribute('aria-hidden', 'true');
  video.parentElement?.appendChild(overlay);
  const dispose = () => {
    finished = true;
    scanner?.destroy();
    overlay.remove();
    // Also release a stream obtained by an in-flight start after destroy().
    const stream = video.srcObject as MediaStream | null;
    stream?.getTracks().forEach(track => track.stop());
    video.srcObject = null;
  };
  try {
    scanner = new QrScanner(video, result => {
      if (finished || signal.aborted) return;
      dispose();
      signal.removeEventListener('abort', dispose);
      read(result.data);
    }, { preferredCamera: camera, returnDetailedScanResult: true, maxScansPerSecond: 10,
      highlightScanRegion: true, overlay });
    signal.addEventListener('abort', dispose, { once: true });
    await scanner.start();
    if (finished || signal.aborted) { dispose(); return; }
    // Device enumeration is optional: a camera can work even when listing fails.
    void QrScanner.listCameras().then(values => {
      if (!finished && !signal.aborted) cameras(values);
    }).catch(() => {});
  } catch (error) {
    dispose();
    signal.removeEventListener('abort', dispose);
    if (!signal.aborted) throw error;
  }
}

export function cameraError(error: unknown): string {
  const name = (error as Error)?.name;
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') return 'Camera permission was denied. Allow camera access in browser or app settings, then select Scan Again.';
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') return 'No camera was found. Connect or enable a camera, then select Scan Again.';
  if (name === 'NotReadableError' || name === 'TrackStartError') return 'The camera is busy or unavailable. Close other camera apps, then select Scan Again.';
  return error instanceof Error ? error.message : 'Could not start the camera. Check camera permissions and select Scan Again.';
}

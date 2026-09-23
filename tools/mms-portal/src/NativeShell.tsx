import * as React from 'react';
import { Alert, Button, Stack } from '@mui/material';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import { useLocation, useNavigate } from 'react-router-dom';
import { CapacitorBarcodeScanner, CapacitorBarcodeScannerTypeHint } from '@capacitor/barcode-scanner';
import { App } from '@capacitor/app';
import { Network } from '@capacitor/network';
import { loadClientConfig } from 'api/clientConfig';
import { platform } from 'app/platform';
import { resolveQr } from './qr';

export const NativeShell = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [connected, setConnected] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  React.useEffect(() => {
    const failed = () => setError('Unable to open this link. Please try again.');
    window.addEventListener('mms:link-error', failed);
    return () => window.removeEventListener('mms:link-error', failed);
  }, []);
  React.useEffect(() => {
    let active = true;
    Network.getStatus().then(status => { if (active) setConnected(status.connected); });
    const listener = Network.addListener('networkStatusChange', status => setConnected(status.connected));
    return () => { active = false; void listener.then(handle => handle.remove()); };
  }, []);
  React.useEffect(() => {
    const listener = App.addListener('backButton', () => {
      // MUI handles Escape at its modal root; keep its normal close semantics.
      const overlays = [...document.querySelectorAll<HTMLElement>('.MuiModal-root')].filter(element =>
        element.getAttribute('aria-hidden') !== 'true' && getComputedStyle(element).visibility !== 'hidden');
      const overlay = overlays[overlays.length - 1];
      if (overlay) { overlay.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return; }
      const index = window.history.state?.idx || 0;
      if (index > 0) navigate(-1);
      else void App.minimizeApp();
    });
    return () => { void listener.then(handle => handle.remove()); };
  }, [navigate, location.key]);

  const scan = async () => {
    setBusy(true); setError('');
    try {
      const result = await CapacitorBarcodeScanner.scanBarcode({
        hint: CapacitorBarcodeScannerTypeHint.QR_CODE, scanInstructions: 'Scan a Makerspace resource QR code',
        cancelButtonAccessibilityLabel: 'Cancel scan',
        torchButtonOnAccessibilityLabel: 'Turn flashlight off', torchButtonOffAccessibilityLabel: 'Turn flashlight on',
      });
      if (!result.ScanResult) return;
      const config = await loadClientConfig();
      const origin = config.app_domain ? new URL('https://' + config.app_domain.replace(/^https?:\/\//i, '').replace(/\/$/, '')).origin : platform.apiOrigin;
      navigate(await resolveQr(result.ScanResult, origin, window.fetch));
    } catch (reason: any) {
      if (/cancel/i.test(String(reason?.message || reason))) return;
      setError(/permission|denied|camera/i.test(String(reason?.message || reason))
        ? 'Camera access is unavailable. Allow camera access in Android Settings and try again.'
        : reason?.message || 'Unable to scan. Please try again.');
    } finally { setBusy(false); }
  };
  return <Stack spacing={1} sx={{ px: 1.5, pb: 2 }}>
    <Button variant="outlined" startIcon={<QrCodeScannerIcon />} disabled={busy || !connected} onClick={scan}
      sx={{ alignSelf: 'flex-start' }}>{busy ? 'Scanning…' : 'Scan QR code'}</Button>
    {!connected && <Alert severity="warning">You are offline. Reconnect to load or change portal information.</Alert>}
    {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
  </Stack>;
};

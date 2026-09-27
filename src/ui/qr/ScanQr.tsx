import * as React from 'react';
import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField, Typography } from '@mui/material';
import { useLocation, useNavigate } from 'react-router-dom';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { useAuthState } from 'ui/reducer/hooks';
import { resolveScanLink, ScanDestination } from 'app/scanLinks';
import { portalOrigin } from '../../native/transport';
import { Camera, cameraError, startQrCamera } from './camera';

export interface QrController { start: () => void; }
const ScanQr = React.forwardRef<QrController>(function ScanQr(_, ref) {
  const { currentUser, totpEnrollmentRequired } = useAuthState();
  const allowed = !!currentUser.id && !totpEnrollmentRequired;
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = React.useState(false);
  const [attempt, setAttempt] = React.useState(0);
  const [camera, setCamera] = React.useState('environment');
  const [cameras, setCameras] = React.useState<Camera[]>([]);
  const [phase, setPhase] = React.useState<'starting' | 'scanning' | 'resolving' | 'stopped'>('stopped');
  const [error, setError] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [link, setLink] = React.useState<ScanDestination>();
  const [video, setVideo] = React.useState<HTMLVideoElement | null>(null);
  const request = React.useRef<AbortController>(undefined);
  const cancel = React.useCallback(() => { request.current?.abort(); }, []);
  const close = React.useCallback(() => {
    cancel(); setOpen(false); setLink(undefined); setError(''); setMessage(''); setPhase('stopped');
  }, [cancel]);
  const start = () => {
    if (!allowed) return;
    cancel(); setLink(undefined); setError(''); setMessage(''); setPhase('starting');
    setOpen(true); setAttempt(value => value + 1);
  };
  React.useImperativeHandle(ref, () => ({ start }));
  React.useEffect(() => { close(); return cancel; }, [currentUser.id, allowed, location.key, close, cancel]);
  React.useEffect(() => {
    const pause = () => {
      cancel(); setLink(undefined); setPhase('stopped'); setMessage('Scan stopped. Select Scan Again to continue.');
    };
    const visibility = () => { if (document.hidden) pause(); };
    document.addEventListener('visibilitychange', visibility);
    const subscription = Capacitor.isNativePlatform() ? App.addListener('appStateChange', state => { if (!state.isActive) pause(); }) : undefined;
    return () => { document.removeEventListener('visibilitychange', visibility); void subscription?.then(handle => handle.remove()); };
  }, [cancel]);
  React.useEffect(() => {
    if (!open || !allowed || !video) return;
    const controller = new AbortController();
    request.current = controller;
    let decoded = false;
    void startQrCamera(video, controller.signal, value => {
      if (controller.signal.aborted || decoded) return;
      decoded = true; setPhase('resolving');
      void resolveScanLink(value, portalOrigin(), controller.signal).then(destination => {
        if (controller.signal.aborted) return;
        if (destination.kind === 'internal') { close(); navigate(destination.path); }
        else {
          setPhase('stopped');
          if (destination.kind === 'external') setLink(destination);
          else setError('This QR code does not contain a supported link or shortcode. Try another QR code.');
        }
      }).catch(error => {
        if (!controller.signal.aborted) { setPhase('stopped'); setError(error instanceof TypeError ? 'Could not resolve this link. Check your connection and scan again.' : cameraError(error)); }
      });
    }, setCameras, camera).then(() => {
      if (!controller.signal.aborted && !decoded) setPhase('scanning');
    }).catch(error => {
      if (!controller.signal.aborted) { setPhase('stopped'); setError(cameraError(error)); }
    });
    return () => controller.abort();
  }, [open, allowed, video, camera, close, navigate]);
  if (!allowed) return null;
  return <Dialog open={open} onClose={close} fullWidth maxWidth="sm" aria-labelledby="qr-title"
    slotProps={{ transition: { onExited: () => document.getElementById('menu-button')?.focus() } }}>
    <DialogTitle id="qr-title">Scan QR</DialogTitle>
    <DialogContent sx={{ overflowWrap: 'anywhere' }}>
      <Typography>Point your camera at a Makerspace QR code.</Typography>
      <Box sx={{ position: 'relative', my: 2, color: 'primary.main', display: phase === 'starting' || phase === 'scanning' ? 'block' : 'none' }}>
        <video key={`${attempt}-${camera}`} ref={setVideo} muted playsInline aria-label="QR camera preview" style={{ width: '100%', maxHeight: '50vh', objectFit: 'contain' }} />
      </Box>
      {cameras.length > 1 && <TextField select fullWidth label="Camera" value={camera} disabled={phase === 'resolving'}
        onChange={event => { setCamera(event.target.value); start(); }} sx={{ my: 2 }}>
        <MenuItem value="environment">Rear camera (preferred)</MenuItem>
        {cameras.map((item, index) => <MenuItem key={item.id} value={item.id}>{item.label || `Camera ${index + 1}`}</MenuItem>)}
      </TextField>}
      <Box role="status" aria-live="polite">
        {(phase === 'starting' || phase === 'resolving') && <CircularProgress size={24} aria-label={phase === 'starting' ? 'Starting camera' : 'Resolving link'} />}
        {phase === 'scanning' && <Typography>Looking for a QR code…</Typography>}
        {message && <Alert severity="info">{message}</Alert>}
      </Box>
      {error && <Alert severity="error">{error}</Alert>}
      {link && <Box><Typography>{link.url}</Typography><Button onClick={() => {
        if (Capacitor.isNativePlatform()) void Browser.open({ url: link.url }).catch(error => setError(cameraError(error)));
        else window.open(link.url, '_blank', 'noopener,noreferrer');
      }}>Open in browser</Button></Box>}
    </DialogContent>
    <DialogActions><Button onClick={close}>Cancel</Button><Button onClick={start} disabled={phase !== 'stopped'}>Scan Again</Button></DialogActions>
  </Dialog>;
});
export default ScanQr;

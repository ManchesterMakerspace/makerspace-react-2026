import * as React from 'react';
import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';
import NfcIcon from '@mui/icons-material/Nfc';
import { useLocation, useNavigate } from 'react-router-dom';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { getMember, isApiErrorResponse } from 'makerspace-ts-api-client';
import { useCapabilities } from 'app/permissions';
import { useAuthState } from 'ui/reducer/hooks';
import { lookupNfcCard, NfcCard, nfcRequest, releaseNfcCard } from 'api/nfc';
import { nfcCapabilities, scanNfc, ScanResult } from '../../nfc/scanner';
import { classifyNfcUrl, NfcDestination } from '../../nfc/urls';
import { portalOrigin } from '../../native/transport';

export interface NfcController { start: () => void; }
const ScanNfc = React.forwardRef<NfcController, { hiddenTrigger?: boolean; onUid?: (uid: string) => void }>(function ScanNfc({ hiddenTrigger = false, onUid }, ref) {
  const caps = useCapabilities();
  const { currentUser, totpEnrollmentRequired } = useAuthState();
  const navigate = useNavigate();
  const location = useLocation();
  const [supported, setSupported] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [tag, setTag] = React.useState<ScanResult>();
  const [card, setCard] = React.useState<NfcCard>();
  const [links, setLinks] = React.useState<NfcDestination[]>([]);
  const stop = React.useRef<() => void>(() => {});
  const request = React.useRef<AbortController>(undefined);
  const generation = React.useRef(0);
  const retryButton = React.useRef<HTMLButtonElement>(null);
  const allowed = !totpEnrollmentRequired && (onUid ? caps.canManageNfcCards : caps.canScanNfc);
  const cancel = React.useCallback(() => {
    generation.current++;
    stop.current();
    request.current?.abort();
    setBusy(false);
  }, []);
  const close = () => { cancel(); setOpen(false); setCard(undefined); setTag(undefined); setLinks([]); };
  React.useEffect(() => {
    if (open && !busy) retryButton.current?.focus();
  }, [open, busy]);
  React.useEffect(() => {
    if (!open) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
    };
    document.addEventListener('keydown', escape, true);
    return () => document.removeEventListener('keydown', escape, true);
  }, [open]);
  React.useEffect(() => { void nfcCapabilities().then(value => setSupported(value.supported)).catch(() => setSupported(false)); }, []);
  React.useEffect(() => { close(); return cancel; }, [currentUser.id, allowed, location.key]);
  React.useEffect(() => {
    const hide = () => { if (document.hidden) { cancel(); setMessage('Scan stopped. Select Scan Again to continue.'); } };
    document.addEventListener('visibilitychange', hide);
    return () => document.removeEventListener('visibilitychange', hide);
  }, [cancel]);

  const start = () => {
    if (!allowed) return;
    cancel();
    const version = generation.current;
    const controller = new AbortController();
    request.current = controller;
    setOpen(true); setBusy(true); setError(''); setMessage('Hold a card near the NFC reader.'); setTag(undefined); setCard(undefined); setLinks([]);
    stop.current = scanNfc(onUid ? 'enroll' : caps.canManageNfcCards ? 'inspect' : 'ndef', result => {
      void (async () => {
        if (version !== generation.current) return;
        setTag(result); setMessage('');
        if (caps.canManageNfcCards && result.uid) {
          const found = await lookupNfcCard(result.uid, controller.signal);
          if (version !== generation.current) return;
          if (onUid) {
            if (found) { setCard(found); setError('This UID is already registered. Inspect and release it first if eligible.'); }
            else { onUid(result.uid); close(); }
            return;
          }
          setCard(found || undefined);
          if (!found) setMessage('No registered card found for this UID.');
        } else if (onUid) { throw new Error('No UID available. Try the Android app for non-NDEF fobs.'); }
        const destinations = await Promise.all(result.urls.map(async url => {
          const destination = classifyNfcUrl(url, portalOrigin());
          if (!destination.code) return destination;
          const response = await nfcRequest(`/api/shortcodes/${destination.code}`, { signal: controller.signal });
          return classifyNfcUrl(new URL(response.target_path, portalOrigin()).href, portalOrigin());
        }));
        if (version !== generation.current) return;
        setLinks(destinations);
        if (!caps.canManageNfcCards && destinations.length === 1 && destinations[0].path) {
          close(); navigate(destinations[0].path);
        } else if (!result.uid && !result.urls.length && !result.texts.length) setMessage('No readable NDEF content found.');
      })().catch(error => { if (version === generation.current) setError(error.message); })
        .finally(() => { if (version === generation.current) setBusy(false); });
    }, error => { if (version === generation.current) { setError(error.message); setMessage(''); setBusy(false); } });
  };
  React.useImperativeHandle(ref, () => ({ start }));
  const release = async () => {
    const version = generation.current;
    setBusy(true); setError('');
    try {
      await releaseNfcCard(card, request.current?.signal);
      if (version === generation.current) { setCard(undefined); setMessage('Released, reusable'); }
    } catch (error) { if (version === generation.current) setError((error as Error).message); }
    finally { if (version === generation.current) setBusy(false); }
  };
  const viewMember = async () => {
    const version = generation.current;
    setBusy(true); setError('');
    try {
      const response = await getMember({ id: card.member_id });
      if (version !== generation.current) return;
      if (isApiErrorResponse(response)) throw new Error(response.error.message);
      close(); navigate(`/members/${response.data.id}`);
    } catch (error) { if (version === generation.current) setError((error as Error).message); }
    finally { if (version === generation.current) setBusy(false); }
  };
  if (!allowed || (onUid && !supported)) return null;
  return <>
    {!hiddenTrigger && <Button variant="outlined" onClick={start} startIcon={<NfcIcon />}>SCAN NFC</Button>}
    <Dialog open={open} onClose={close} fullWidth maxWidth="sm" aria-labelledby="nfc-title">
      <DialogTitle id="nfc-title">{onUid ? 'Scan new fob' : 'Scan NFC'}</DialogTitle>
      <DialogContent sx={{ overflowWrap: 'anywhere' }}>
        {busy && <CircularProgress size={24} aria-label="Scanning or loading" />}
        <Box role="status" aria-live="polite">{message && <Alert severity={message === 'Released, reusable' ? 'success' : 'info'} sx={{ my: 1 }}>{message}</Alert>}</Box>
        {error && <Alert severity="error" sx={{ my: 1 }}>{error}</Alert>}
        {tag?.warning && <Alert severity="warning">{tag.warning}</Alert>}
        {tag?.uid && <Typography>UID: {tag.uid}</Typography>}
        {card && <Box sx={{ my: 2 }}>
          <Typography>Card record: {card.id}</Typography>
          <Typography>Holder: {card.holder || 'Unassigned'}</Typography>
          <Typography>Status: {card.validity}</Typography>
          <Typography>Expiry: {card.expiry ? new Date(card.expiry).toLocaleString() : 'None'}</Typography>
          {card.member_id && <><Typography>Member: {card.member_id}</Typography><Button disabled={busy} onClick={viewMember}>View member details</Button></>}
          {!onUid && card.releasable && <Box><Typography>{card.release_reason}</Typography><Button color="error" variant="outlined" disabled={busy} onClick={release}>RELEASE CARD</Button></Box>}
        </Box>}
        {tag?.texts.map((text, index) => <Typography key={index} sx={{ whiteSpace: 'pre-wrap', my: 1 }}>{text}</Typography>)}
        {tag?.unsupported.length > 0 && <Typography>Unsupported NDEF records: {tag.unsupported.join(', ')}</Typography>}
        {links.map((link, index) => <Box key={index} sx={{ my: 2 }}>
          <Typography>{link.url}</Typography>
          {link.path ? <Button onClick={() => { close(); navigate(link.path); }}>Open in Makerspace</Button>
            : link.openable ? <Button onClick={() => {
              if (Capacitor.isNativePlatform()) void Browser.open({ url: link.url }).catch(error => setError(error.message));
              else window.open(link.url, '_blank', 'noopener,noreferrer');
            }}>Open in new window</Button> : <Typography>This URL type cannot be opened.</Typography>}
        </Box>)}
      </DialogContent>
      <DialogActions><Button onClick={close}>Cancel</Button><Button ref={retryButton} onClick={start} disabled={busy}>Scan Again</Button></DialogActions>
    </Dialog>
  </>;
});
export default ScanNfc;

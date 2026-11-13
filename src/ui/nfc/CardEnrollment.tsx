import * as React from 'react';
import { Alert, Box, Button } from '@mui/material';
import { Capacitor, registerPlugin, PluginListenerHandle } from '@capacitor/core';
import { nfcRequest } from 'api/nfc';
import { useAuthState } from 'ui/reducer/hooks';

export const readerInstructions = 'Card UID assigned. To finish issuing or replacing this fob, present it to an enrollment-enabled reader. The fob is ready only after that reader completes enrollment.';
export type EnrollmentFlow = 'admin' | 'issuer';
interface Material { keyA: string; keyB: string; contents: string; digest: string; version: number; }
interface Enrollment { id: string; uid: string; state: 'pending' | 'completed'; revision: number; material?: Material; }
interface Programmer {
  identify(options: { uid: string }): Promise<{ uid: string }>;
  programCredential(options: Material & { uid: string }): Promise<{ uid: string; digest: string }>;
  cancel(): Promise<void>;
  addListener(name: 'progress', callback: (event: { message: string }) => void): Promise<PluginListenerHandle>;
}
const programmer = registerPlugin<Programmer>('CardEnrollment');
export const hasNativeEnrollment = () => Capacitor.getPlatform() === 'android' && Capacitor.isPluginAvailable('CardEnrollment');
export const enrollmentIntent = (memberId: string, flow: EnrollmentFlow) =>
  `intent://fob-enrollment?memberId=${encodeURIComponent(memberId)}&flow=${flow}#Intent;scheme=makerspace;package=org.manchestermakerspace.portal;end`;

export function EnrollmentChoices({ memberId, flow, native, setNative, disabled = false }: {
  memberId: string; flow: EnrollmentFlow; native: boolean; setNative: (value: boolean) => void; disabled?: boolean;
}) {
  return <Box sx={{ my: 2 }}>
    {hasNativeEnrollment()
      ? <Button disabled={disabled} onClick={() => setNative(true)} variant={native ? 'contained' : 'outlined'}>Enroll with this phone</Button>
      : <Button disabled={disabled} href={enrollmentIntent(memberId, flow)}>Continue in Android app</Button>}
    <Button disabled={disabled} onClick={() => setNative(false)} variant={!native ? 'contained' : 'outlined'}>Use enrollment reader instead</Button>
    {!hasNativeEnrollment() && <Alert severity="info">Open the installed Makerspace Android app to program this fob. If it is unavailable, use the enrollment reader option below.</Alert>}
    {!native && <Alert severity="warning">Assigning a replacement UID disables the old fob immediately. Arrange access to an enrollment-enabled reader before submitting.</Alert>}
  </Box>;
}

export function useCardEnrollment(memberId: string, flow: EnrollmentFlow, enabled: boolean) {
  const { currentUser, totpEnrollmentRequired } = useAuthState();
  const [native, setNative] = React.useState(hasNativeEnrollment);
  const [busy, setBusy] = React.useState(false);
  const [progress, setProgress] = React.useState('');
  const generation = React.useRef(0);
  const abort = React.useRef<AbortController>(undefined);
  const locked = React.useRef(false);
  const cancel = React.useCallback(() => {
    generation.current++; abort.current?.abort(); locked.current = false;
    if (hasNativeEnrollment()) void programmer.cancel().catch(() => {});
    setBusy(false); setProgress('');
  }, []);
  React.useEffect(() => { cancel(); return cancel; }, [memberId, currentUser.id, totpEnrollmentRequired, enabled]);
  React.useEffect(() => {
    const hide = () => { if (document.hidden) cancel(); };
    document.addEventListener('visibilitychange', hide);
    return () => document.removeEventListener('visibilitychange', hide);
  }, [cancel]);
  const enroll = async (uid: string) => {
    if (locked.current || !enabled || totpEnrollmentRequired || !hasNativeEnrollment()) throw new Error('Enrollment is unavailable.');
    locked.current = true; setBusy(true);
    const version = ++generation.current;
    const check = () => { if (version !== generation.current) throw new Error('Enrollment stopped. Resume with the same card.'); };
    const controller = new AbortController(); abort.current = controller;
    let listener: PluginListenerHandle;
    let prepared: Enrollment;
    try {
      listener = await programmer.addListener('progress', event => { if (version === generation.current) setProgress(event.message); });
      check(); setProgress('Tap the displayed card to check phone compatibility.');
      await programmer.identify({ uid }); check();
      const base = `/api/${flow === 'admin' ? 'admin' : 'fob_issuance'}/card_enrollments`;
      setProgress('Preparing enrollment…');
      prepared = await nfcRequest(base, { method: 'POST', signal: controller.signal,
        body: JSON.stringify({ memberId, uid, idVerified: true }) }); check();
      if (prepared.state === 'completed') return;
      setProgress('Tap and hold the same card to program it.');
      const verified = await programmer.programCredential({ uid, ...prepared.material }); check();
      setProgress('Saving verified enrollment…');
      try {
        await nfcRequest(`${base}/${prepared.id}/commit`, { method: 'POST', signal: controller.signal,
          body: JSON.stringify({ revision: prepared.revision, digest: verified.digest }) });
      } catch (error) {
        check();
        const status: Enrollment = await nfcRequest(`${base}/${prepared.id}`, { signal: controller.signal });
        if (status.state !== 'completed') throw error;
      }
      check();
    } finally {
      if (prepared) prepared.material = undefined;
      await listener?.remove();
      if (version === generation.current) { locked.current = false; setBusy(false); setProgress(''); }
    }
  };
  return { native, setNative, busy, progress, enroll, cancel };
}

import { Capacitor, registerPlugin, PluginListenerHandle } from '@capacitor/core';
import { normalizeUid } from './uid';
import { decodeNdef, TagContent, TagRecord } from './ndef';

export type ScanMode = 'ndef' | 'inspect' | 'enroll';
export interface ScanResult extends TagContent { uid?: string; warning?: string; }
interface NativeNfc {
  capabilities(): Promise<{ supported: boolean; enabled: boolean }>;
  start(options: { mode: ScanMode; sessionId: string }): Promise<void>;
  stop(options: { sessionId: string }): Promise<void>;
  addListener(name: 'tag' | 'scanError', callback: (event: any) => void): Promise<PluginListenerHandle>;
}
const native = registerPlugin<NativeNfc>('MakerspaceNfc');
let nextSession = 0;
export async function nfcCapabilities() {
  if (Capacitor.isNativePlatform()) {
    if (!Capacitor.isPluginAvailable('MakerspaceNfc')) return { supported: false, enabled: false };
    return native.capabilities();
  }
  return { supported: window.isSecureContext && 'NDEFReader' in window, enabled: true };
}

/** One foreground session; stop is safe even while native start is pending. */
export function scanNfc(mode: ScanMode, onTag: (tag: ScanResult) => void, onError: (error: Error) => void): () => void {
  const abort = new AbortController();
  const sessionId = String(++nextSession);
  let handles: PluginListenerHandle[] = [];
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    abort.abort();
    handles.forEach(handle => { void handle.remove(); });
    handles = [];
    if (Capacitor.isNativePlatform()) void native.stop({ sessionId }).catch(() => {});
  };
  const receive = (tag: ScanResult) => {
    if (stopped) return;
    const result = { ...tag };
    if (mode === 'ndef') delete result.uid;
    else if (result.uid) {
      try { result.uid = normalizeUid(result.uid); }
      catch (error) { delete result.uid; result.warning = (error as Error).message; }
    }
    stop();
    onTag(result);
  };
  const fail = (error: any) => {
    if (!stopped) { stop(); onError(new Error(error?.message || 'Unable to read this NFC tag.')); }
  };
  if (Capacitor.isNativePlatform()) {
    void (async () => {
      for (const name of ['tag', 'scanError'] as const) {
        const handle = await native.addListener(name, name === 'tag' ? receive : fail);
        if (stopped) { await handle.remove(); return; }
        handles.push(handle);
      }
      if (!stopped) await native.start({ mode, sessionId });
      if (stopped) await native.stop({ sessionId });
    })().catch(fail);
  } else {
    try {
      const Reader = (window as any).NDEFReader;
      if (!window.isSecureContext || !Reader) throw new Error('NFC scanning is unavailable. Use Android Chrome over HTTPS or the Android app.');
      const reader = new Reader();
      reader.onreading = (event: { serialNumber: string; message: { records: TagRecord[] } }) => {
        try { receive({ ...decodeNdef(event.message.records), ...(mode !== 'ndef' && event.serialNumber ? { uid: event.serialNumber } : {}) }); }
        catch (error) { fail(error); }
      };
      reader.onreadingerror = () => fail(new Error('Cannot read this tag. Non-NDEF fobs may require the Android app.'));
      // Called synchronously from the user's click, before any await.
      reader.scan({ signal: abort.signal }).catch(fail);
    } catch (error) { fail(error); }
  }
  return stop;
}

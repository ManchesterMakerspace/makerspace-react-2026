package org.manchestermakerspace.portal;

import android.nfc.NfcAdapter;
import android.nfc.Tag;
import android.nfc.tech.MifareClassic;
import android.os.Handler;
import android.os.Looper;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.Locale;
import java.util.concurrent.Executors;
import java.util.concurrent.ExecutorService;

/** Fixed sector-1 operations only; no arbitrary block/key command bridge. */
@CapacitorPlugin(name = "CardEnrollment")
public class CardEnrollmentPlugin extends Plugin {
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private final Handler timer = new Handler(Looper.getMainLooper());
    private volatile int generation;
    private volatile MifareClassic connection;
    private PluginCall pending;
    private byte[] keyA, keyB, contents;
    private String expectedUid, expectedDigest;
    private boolean programming;
    private boolean verifying;
    private boolean reading;

    @PluginMethod public void identify(PluginCall call) { begin(call, false); }
    @PluginMethod public void programCredential(PluginCall call) { begin(call, true); }
    @PluginMethod public void cancel(PluginCall call) {
        getActivity().runOnUiThread(() -> { finish(null, "Enrollment stopped. Resume with the same card."); call.resolve(); });
    }
    private byte[] hex(String value, int size) {
        if (value == null || !value.matches("[0-9a-fA-F]{" + (size * 2) + "}")) throw new IllegalArgumentException();
        byte[] bytes = new byte[size];
        for (int i=0; i<size; i++) bytes[i]=(byte)Integer.parseInt(value.substring(i*2,i*2+2),16);
        return bytes;
    }
    private String hex(byte[] bytes) {
        StringBuilder result = new StringBuilder();
        for (byte b : bytes) result.append(String.format(Locale.ROOT,"%02X",b & 255));
        return result.toString();
    }
    private void begin(PluginCall call, boolean write) {
        getActivity().runOnUiThread(() -> {
            if (pending != null) { call.reject("Another enrollment is in progress."); return; }
            NfcAdapter adapter=NfcAdapter.getDefaultAdapter(getContext());
            if (adapter == null || !adapter.isEnabled()) { call.reject("Enable NFC on a compatible Android phone, or use an enrollment reader."); return; }
            try {
                expectedUid=call.getString("uid", "");
                if (!expectedUid.matches("(?:[0-9A-F]{8}|[0-9A-F]{14})")) throw new IllegalArgumentException();
                if (write) {
                    keyA=hex(call.getString("keyA"),6); keyB=hex(call.getString("keyB"),6);
                    contents=hex(call.getString("contents"),48);
                    byte[] metadata=new byte[16]; metadata[0]='M'; metadata[1]='S'; metadata[2]='P'; metadata[3]='1'; metadata[7]=1;
                    if (!Arrays.equals(Arrays.copyOfRange(contents,32,48),metadata)) throw new IllegalArgumentException();
                    expectedDigest=call.getString("digest", "");
                    MessageDigest hash=MessageDigest.getInstance("SHA-256"); hash.update(hex(expectedUid,expectedUid.length()/2)); hash.update(contents);
                    if (!hex(hash.digest()).equalsIgnoreCase(expectedDigest)) throw new IllegalArgumentException();
                }
                pending=call; programming=write; verifying=false; reading=false;
                final int session=++generation;
                adapter.enableReaderMode(getActivity(), tag -> {
                    synchronized (this) { if (session != generation || reading) return; reading=true; }
                    worker.execute(() -> read(tag,session));
                }, NfcAdapter.FLAG_READER_NFC_A | NfcAdapter.FLAG_READER_SKIP_NDEF_CHECK, null);
                timer.postDelayed(() -> { if (session == generation) finish(null,"Scan timed out. Resume with the same card."); },60000);
            } catch (Exception error) { pending=call; finish(null,"Invalid enrollment material or NFC unavailable."); }
        });
    }
    private void read(Tag tag, int session) {
        // Snapshot the material for this RF callback. A canceled generation must
        // never observe a subsequent attempt's keys while unwinding.
        final String uid=expectedUid, digestExpected=expectedDigest;
        final byte[] readKey=keyA, writeKey=keyB, data=contents;
        final boolean writing=programming, verify=verifying;
        MifareClassic card=null;
        try {
            if (!hex(tag.getId()).equals(uid)) throw new Exception("Present the same card whose UID is displayed.");
            card=MifareClassic.get(tag);
            if (card == null || card.getType()!=MifareClassic.TYPE_CLASSIC || (card.getSize()!=MifareClassic.SIZE_1K && card.getSize()!=MifareClassic.SIZE_4K))
                throw new Exception("This phone/card cannot program MIFARE Classic. Use an enrollment reader.");
            if (!writing) { JSObject result=new JSObject(); result.put("uid",uid); complete(session,result,null); return; }
            connection=card; card.connect(); card.setTimeout(2000);
            if (session != generation) return;
            if (verify) {
                if (!card.authenticateSectorWithKeyA(1,readKey)) throw new Exception("Readback authentication failed. Resume with the same card.");
                MessageDigest hash=MessageDigest.getInstance("SHA-256"); hash.update(tag.getId());
                for (int block=4;block<=6;block++) hash.update(card.readBlock(block));
                byte[] trailer=card.readBlock(7);
                String digest=hex(hash.digest()).toLowerCase(Locale.ROOT);
                if (trailer[6]!=0x78 || trailer[7]!=0x77 || (trailer[8]&255)!=0x88 || trailer[9]!=0 || !digest.equalsIgnoreCase(digestExpected))
                    throw new Exception("Readback verification failed. Resume with the same card.");
                JSObject result=new JSObject(); result.put("uid",uid); result.put("digest",digest);
                complete(session,result,null); return;
            }
            boolean provisioned=card.authenticateSectorWithKeyB(1,writeKey);
            if (!provisioned) {
                card.close(); card.connect();
                if (!card.authenticateSectorWithKeyA(1,MifareClassic.KEY_DEFAULT)) throw new Exception("Card cannot be recovered with this enrollment. Contact an administrator.");
            }
            for (int block=4;block<=6;block++) {
                byte[] old=card.readBlock(block), wanted=Arrays.copyOfRange(data,(block-4)*16,(block-3)*16);
                boolean blank=true; for (byte b:old) blank &= b==0 || (b&255)==255;
                if (!blank && !Arrays.equals(old,wanted)) throw new Exception("Card contains unrelated data. It has not been overwritten.");
            }
            for (int block=4;block<=6;block++) {
                if (session != generation) return;
                card.writeBlock(block,Arrays.copyOfRange(data,(block-4)*16,(block-3)*16));
            }
            if (!provisioned) {
                byte[] trailer=new byte[16]; System.arraycopy(readKey,0,trailer,0,6); System.arraycopy(writeKey,0,trailer,10,6);
                trailer[6]=0x78; trailer[7]=0x77; trailer[8]=(byte)0x88;
                if (session != generation) return;
                card.writeBlock(7,trailer); Arrays.fill(trailer,(byte)0);
            }
            getActivity().runOnUiThread(() -> {
                if (session == generation) { verifying=true; JSObject progress=new JSObject(); progress.put("message","Remove the card, then tap it again to verify."); notifyListeners("progress",progress); }
            });
        } catch (Exception error) { complete(session,null,error.getMessage()==null ? "NFC operation failed. Resume with the same card." : error.getMessage()); }
        finally {
            if (card != null) try { card.close(); } catch (Exception ignored) {}
            connection=null;
            synchronized (this) { if (session == generation) reading=false; }
        }
    }
    private void complete(int session, JSObject result, String error) {
        getActivity().runOnUiThread(() -> { if (session == generation) finish(result,error); });
    }
    private void finish(JSObject result, String error) {
        generation++;
        NfcAdapter adapter=NfcAdapter.getDefaultAdapter(getContext());
        if (adapter != null) adapter.disableReaderMode(getActivity());
        MifareClassic active=connection; if (active != null) try { active.close(); } catch (Exception ignored) {}
        PluginCall call=pending; pending=null;
        // The worker may still be unwinding; erase buffers on its serial queue.
        final byte[] a=keyA,b=keyB,c=contents; keyA=null; keyB=null; contents=null;
        worker.execute(() -> { for (byte[] bytes:new byte[][]{a,b,c}) if(bytes!=null) Arrays.fill(bytes,(byte)0); });
        if (call != null) { if (error != null) call.reject(error); else call.resolve(result); }
    }
    @Override protected void handleOnPause() { finish(null,"Enrollment stopped. Resume with the same card."); }
    @Override protected void handleOnDestroy() { finish(null,"Enrollment stopped."); }
}

package org.manchestermakerspace.portal;

import android.nfc.NfcAdapter;
import android.nfc.NdefMessage;
import android.nfc.NdefRecord;
import android.nfc.Tag;
import android.nfc.tech.Ndef;
import android.net.Uri;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Locale;

@CapacitorPlugin(name = "MakerspaceNfc")
public class MakerspaceNfcPlugin extends Plugin {
    private volatile int generation = 0;
    private volatile boolean scanning = false;
    private String activeSession = "";
    private NfcAdapter adapter() { return NfcAdapter.getDefaultAdapter(getContext()); }

    @PluginMethod public void capabilities(PluginCall call) {
        NfcAdapter nfc = adapter();
        JSObject result = new JSObject();
        result.put("supported", nfc != null); result.put("enabled", nfc != null && nfc.isEnabled());
        call.resolve(result);
    }

    @PluginMethod public void start(PluginCall call) {
        final String mode = call.getString("mode", "ndef");
        if (!Arrays.asList("ndef", "inspect", "enroll").contains(mode)) { call.reject("Invalid scan mode"); return; }
        getActivity().runOnUiThread(() -> {
            NfcAdapter nfc = adapter();
            if (nfc == null) { call.reject("This device has no NFC reader."); return; }
            if (!nfc.isEnabled()) { call.reject("Enable NFC in Android Settings, then scan again."); return; }
            final int session = ++generation;
            activeSession = call.getString("sessionId", "");
            scanning = true;
            int flags = NfcAdapter.FLAG_READER_NFC_A | NfcAdapter.FLAG_READER_NFC_B |
                NfcAdapter.FLAG_READER_NFC_F | NfcAdapter.FLAG_READER_NFC_V;
            if (mode.equals("enroll")) flags |= NfcAdapter.FLAG_READER_SKIP_NDEF_CHECK;
            try {
                nfc.enableReaderMode(getActivity(), tag -> read(tag, mode, session), flags, null);
                call.resolve();
            } catch (Exception error) { scanning = false; call.reject("Could not start NFC scanning.", error); }
        });
    }

    private void read(Tag tag, String mode, int session) {
        if (!scanning || generation != session) return;
        JSObject result = new JSObject();
        JSArray urls = new JSArray(), texts = new JSArray(), unsupported = new JSArray();
        if (!mode.equals("ndef")) {
            StringBuilder uid = new StringBuilder();
            for (byte b : tag.getId()) uid.append(String.format(Locale.ROOT, "%02X", b & 0xff));
            if (uid.length() > 0) result.put("uid", uid.toString());
        }
        if (!mode.equals("enroll")) {
            Ndef ndef = Ndef.get(tag);
            if (ndef != null) {
                try {
                    ndef.connect();
                    NdefMessage message = ndef.getNdefMessage();
                    if (message != null) decode(message, urls, texts, unsupported, 0);
                } catch (Exception error) { result.put("warning", "NDEF could not be read. Hold the card steady and try again."); }
                finally { try { ndef.close(); } catch (Exception ignored) {} }
            }
        }
        result.put("urls", urls); result.put("texts", texts); result.put("unsupported", unsupported);
        getActivity().runOnUiThread(() -> {
            if (!scanning || generation != session) return;
            stopReader(); notifyListeners("tag", result);
        });
    }

    private void decode(NdefMessage message, JSArray urls, JSArray texts, JSArray unsupported, int depth) throws Exception {
        if (depth > 4 || message.toByteArray().length > 32768 || message.getRecords().length > 64) throw new Exception("Oversized NDEF");
        boolean hasPoster = false;
        for (NdefRecord record : message.getRecords()) if (record.getTnf() == NdefRecord.TNF_WELL_KNOWN && Arrays.equals(record.getType(), NdefRecord.RTD_SMART_POSTER)) hasPoster = true;
        for (NdefRecord record : message.getRecords()) {
            byte[] payload = record.getPayload();
            if (record.getTnf() == NdefRecord.TNF_WELL_KNOWN && Arrays.equals(record.getType(), NdefRecord.RTD_SMART_POSTER)) {
                decode(new NdefMessage(payload), urls, texts, unsupported, depth + 1);
            } else if (record.getTnf() == NdefRecord.TNF_WELL_KNOWN && Arrays.equals(record.getType(), NdefRecord.RTD_TEXT)) {
                if (payload.length == 0) continue;
                int languageLength = payload[0] & 63;
                if (languageLength + 1 > payload.length) throw new Exception("Invalid NDEF text");
                Charset encoding = (payload[0] & 128) != 0 ? StandardCharsets.UTF_16 : StandardCharsets.UTF_8;
                texts.put(new String(payload, languageLength + 1, payload.length - languageLength - 1, encoding));
            } else {
                Uri uri = record.toUri();
                if (uri != null && (record.getTnf() == NdefRecord.TNF_ABSOLUTE_URI || Arrays.equals(record.getType(), NdefRecord.RTD_URI))) {
                    if (!hasPoster) urls.put(uri.toString());
                } else if (record.getTnf() != NdefRecord.TNF_EMPTY) unsupported.put("TNF " + record.getTnf());
            }
        }
    }

    private void stopReader() {
        scanning = false; generation++;
        NfcAdapter nfc = adapter();
        if (nfc != null) nfc.disableReaderMode(getActivity());
    }
    @PluginMethod public void stop(PluginCall call) { getActivity().runOnUiThread(() -> {
        if (activeSession.equals(call.getString("sessionId", ""))) stopReader();
        call.resolve();
    }); }
    @Override protected void handleOnPause() { stopReader(); }
    @Override protected void handleOnDestroy() { stopReader(); }
}

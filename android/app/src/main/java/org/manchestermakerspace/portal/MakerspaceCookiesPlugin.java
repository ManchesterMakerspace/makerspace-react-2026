package org.manchestermakerspace.portal;

import android.net.Uri;
import android.webkit.CookieManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

/** Origin-aware access to the two public cookies used by the local app shell. */
@CapacitorPlugin(name = "MakerspaceCookies")
public class MakerspaceCookiesPlugin extends Plugin {
    private static final String PREFERENCE = "makerspace_stay_logged_in";

    private String portalUrl(PluginCall call) {
        String url = call.getString("url", "");
        Uri uri = Uri.parse(url);
        if (!"https".equals(uri.getScheme()) || uri.getHost() == null || uri.getUserInfo() != null) {
            call.reject("A remote HTTPS portal URL is required.");
            return null;
        }
        return url;
    }

    @PluginMethod public void read(PluginCall call) {
        String url = portalUrl(call);
        if (url == null) return;
        String cookies = CookieManager.getInstance().getCookie(url);
        JSObject result = new JSObject();
        if (cookies != null) {
            for (String cookie : cookies.split(";")) {
                String[] pair = cookie.trim().split("=", 2);
                if (pair.length == 2 && ("XSRF-TOKEN".equals(pair[0]) || PREFERENCE.equals(pair[0]))) {
                    result.put(pair[0], pair[1]);
                }
            }
        }
        call.resolve(result);
    }

    @PluginMethod public void setRememberPreference(PluginCall call) {
        String url = portalUrl(call);
        if (url == null) return;
        boolean enabled = Boolean.TRUE.equals(call.getBoolean("enabled", false));
        SimpleDateFormat format = new SimpleDateFormat("EEE, dd MMM yyyy HH:mm:ss 'GMT'", Locale.US);
        format.setTimeZone(TimeZone.getTimeZone("GMT"));
        String expiry = format.format(new Date(System.currentTimeMillis() + 365L * 24 * 60 * 60 * 1000));
        String value = PREFERENCE + "=" + enabled + "; Path=/; Expires=" + expiry + "; SameSite=Lax; Secure";
        getActivity().runOnUiThread(() -> {
            CookieManager manager = CookieManager.getInstance();
            manager.setCookie(url, value, accepted -> {
                if (Boolean.TRUE.equals(accepted)) {
                    manager.flush();
                    call.resolve();
                } else {
                    call.reject("Could not save the login preference.");
                }
            });
        });
    }
}

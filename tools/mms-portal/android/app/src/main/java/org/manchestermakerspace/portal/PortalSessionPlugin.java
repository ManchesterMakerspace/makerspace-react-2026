package org.manchestermakerspace.portal;

import android.webkit.CookieManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;

/** Only exposes the public anti-CSRF token, never the HttpOnly session cookie. */
@CapacitorPlugin(name = "PortalSession")
public class PortalSessionPlugin extends Plugin {
    private String apiOrigin() {
        String value = getConfig().getString("apiOrigin", "");
        URI uri = URI.create(value);
        if (!("https".equals(uri.getScheme()) || (BuildConfig.DEBUG && "http".equals(uri.getScheme()))) ||
            uri.getHost() == null || uri.getUserInfo() != null || uri.getRawQuery() != null || uri.getRawFragment() != null) {
            throw new IllegalStateException("Invalid portal API origin");
        }
        return value;
    }

    @PluginMethod public void csrfToken(PluginCall call) {
        try {
            String cookies = CookieManager.getInstance().getCookie(apiOrigin() + "/api/");
            String token = "";
            if (cookies != null) for (String cookie : cookies.split(";")) {
                String[] pair = cookie.trim().split("=", 2);
                if (pair.length == 2 && pair[0].equals("XSRF-TOKEN")) {
                    token = URLDecoder.decode(pair[1], StandardCharsets.UTF_8.name());
                }
            }
            JSObject result = new JSObject();
            result.put("token", token);
            call.resolve(result);
        } catch (Exception error) { call.reject("Unable to read the portal CSRF token"); }
    }

    @PluginMethod public void clear(PluginCall call) {
        // This WebView's jar is app-private; it does not clear Chrome's session.
        getActivity().runOnUiThread(() -> CookieManager.getInstance().removeAllCookies(removed -> {
            CookieManager.getInstance().flush();
            call.resolve();
        }));
    }

    @PluginMethod public void firebaseConfiguration(PluginCall call) {
        int project = getContext().getResources().getIdentifier("project_id", "string", getContext().getPackageName());
        int app = getContext().getResources().getIdentifier("google_app_id", "string", getContext().getPackageName());
        JSObject result = new JSObject();
        result.put("configured", project != 0 && app != 0);
        result.put("projectId", project == 0 ? "" : getContext().getString(project));
        call.resolve(result);
    }
}

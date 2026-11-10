package dev.bearframe.ridge;

import android.app.Activity;
import android.os.Bundle;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.RenderProcessGoneDetail;
import android.view.ViewGroup;
import android.widget.TextView;
import android.webkit.WebChromeClient;
import android.net.Uri;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

/**
 * Experimental offline Chromium/WebView adapter for the SAME portable
 * Bearframe engine rules and save journal used in Node and Rhino tests.
 *
 * This Activity is deliberately NOT the launcher until its release gate passes.
 * It uses only packaged trusted scripts. No network, remote navigation or
 * arbitrary filesystem access is enabled. The separate, exact-key legacy
 * source bridge is read-only; no original game save is modified.
 */
public final class UnifiedEngineActivity extends Activity {
    public static final String ORIGIN = "https://appassets.androidplatform.net";
    private static final String DIAGNOSTICS = ORIGIN + "/enginehost/index.html";
    private static final String PREFERENCES = "bearframe_unified_v1";
    private WebView browser;
    private int rendererRecoveries=0;
    private final LegacyArchiveExport exporter=new LegacyArchiveExport(this,result->{
        if(browser!=null){
            String line="restored".equals(result)?
                "Original save restored without overwriting existing progress. Open the original launcher to continue.":
                "restore-refused".equals(result)?
                "Restore refused: invalid backup or an original save already exists.":
                "restore-failed".equals(result)?
                "Restore failed; any existing save remains preserved.":
                "restore-cancelled".equals(result)?
                "Restore cancelled; no original save was changed.":
                "saved".equals(result)?
                "Backup JSON saved to the selected document.":
                "cancelled".equals(result)?
                "Export cancelled; backup remains in app storage.":
                "Export failed; backup remains in app storage.";
            browser.evaluateJavascript("var e=document.getElementById('legacy-archive-status');"+
                "if(e)e.textContent="+org.json.JSONObject.quote(line),null);
        }
    });
    private final AudioFocusRouter audioFocus=new AudioFocusRouter(this,()->{
        if(browser!=null)browser.evaluateJavascript(
            "window.BearframeHost&&window.BearframeHost.suspend()",null);
    });

    private static boolean allowedSaveKey(String key) {
        return key != null && key.length() <= 150 &&
            key.matches("bf:[a-z][a-z0-9_-]{0,63}:v[1-9][0-9]{0,3}(?::[a-z][a-z0-9_-]{0,63})?:[ab]");
    }

    public final class NativeSaveBridge {
        private SharedPreferences preferences() {
            return UnifiedEngineActivity.this.getSharedPreferences(PREFERENCES, MODE_PRIVATE);
        }
        @JavascriptInterface public String read(String key) {
            if (!allowedSaveKey(key)) return null;
            return preferences().getString(key,null);
        }
        /**
         * Legacy ExpeditionActivity.getPreferences(MODE_PRIVATE) uses the
         * Activity local class name as its SharedPreferences file name.
         * Read-only, single-key compatibility bridge. This method MUST NOT
         * remove, rewrite, or implicitly migrate the source snapshot.
         */
        @JavascriptInterface public String readLegacyExpedition() {
            try {
                String raw=UnifiedEngineActivity.this
                    .getSharedPreferences("ExpeditionActivity", MODE_PRIVATE)
                    .getString("expedition",null);
                return raw==null || raw.length()==0 || raw.length()>1900000 ? null : raw;
            } catch(RuntimeException unreadable) {
                return null; // Fail closed for wrong preference types or storage faults.
            }
        }
        @JavascriptInterface public boolean write(String key,String value) {
            if (!allowedSaveKey(key) || value == null || value.length() > 2000000)
                return false;
            return preferences().edit().putString(key,value).commit();
        }
    }

    private static WebResourceResponse failure(int code, String reason) {
        return new WebResourceResponse("text/plain", "utf-8", code, reason,
            Collections.singletonMap("Cache-Control","no-store"),
            new ByteArrayInputStream(new byte[0]));
    }
    private static boolean permittedAsset(String path) {
        if (path == null || !path.matches("/[A-Za-z0-9._/-]+") ||
            path.contains("..") || path.contains("//") || path.contains("\\"))
            return false;
        return path.startsWith("/enginehost/") ||
            path.startsWith("/framework/") || path.startsWith("/fixtures/");
    }
    private static String mime(String path) {
        if (path.endsWith(".html")) return "text/html";
        if (path.endsWith(".css")) return "text/css";
        if (path.endsWith(".js")) return "application/javascript";
        if (path.endsWith(".png")) return "image/png";
        if (path.endsWith(".webp")) return "image/webp";
        if (path.endsWith(".wav")) return "audio/wav";
        if (path.endsWith(".ogg")) return "audio/ogg";
        if (path.endsWith(".mp3")) return "audio/mpeg";
        return "application/octet-stream";
    }
    private WebResourceResponse asset(WebResourceRequest request) {
        if (request == null || !"GET".equalsIgnoreCase(request.getMethod()))
            return failure(403,"Forbidden");
        Uri uri=request.getUrl();
        if (uri == null || !"https".equals(uri.getScheme()) ||
            !"appassets.androidplatform.net".equals(uri.getHost()) ||
            uri.getPort() != -1 || !permittedAsset(uri.getPath()))
            return failure(403,"Forbidden");
        String relative=uri.getPath().substring(1);
        try {
            InputStream in=getAssets().open(relative);
            Map<String,String> headers=new HashMap<>();
            headers.put("Cache-Control","no-store");
            headers.put("X-Content-Type-Options","nosniff");
            headers.put("Content-Security-Policy",
                "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; "+
                "media-src 'self'; connect-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'");
            return new WebResourceResponse(mime(relative),"UTF-8",200,"OK",headers,in);
        } catch(IOException missing) {
            return failure(404,"Not Found");
        }
    }

    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        getWindow().setStatusBarColor(Color.rgb(17,20,28));
        getWindow().setNavigationBarColor(Color.rgb(17,20,28));
        createOfflineBrowser();
    }

    private void createOfflineBrowser() {
        browser=new WebView(this);
        browser.setBackgroundColor(Color.rgb(17,20,28));
        WebSettings settings=browser.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        browser.setWebChromeClient(new WebChromeClient());
        browser.setWebViewClient(new WebViewClient() {
            @Override public boolean onRenderProcessGone(
                WebView view, RenderProcessGoneDetail detail) {
                if(view!=browser)return false;
                // Renderer process is dead: discard WebView without touching
                // Android durable journal, then rehydrate from packaged code.
                browser=null;
                audioFocus.abandon();
                if(view.getParent() instanceof ViewGroup)
                    ((ViewGroup)view.getParent()).removeView(view);
                view.destroy();
                if(isFinishing()||isDestroyed())return true;
                rendererRecoveries++;
                if(rendererRecoveries>2){
                    // Fail visibly rather than spin in a renderer crash loop.
                    TextView warning=new TextView(UnifiedEngineActivity.this);
                    warning.setText("Engine renderer unavailable. Saved progress remains preserved. Restart the app.");
                    warning.setTextColor(Color.WHITE);
                    warning.setPadding(24,24,24,24);
                    setContentView(warning);
                    return true;
                }
                createOfflineBrowser();
                return true;
            }
            @Override public WebResourceResponse shouldInterceptRequest(
                WebView view, WebResourceRequest request) {
                return asset(request);
            }
            @Override public boolean shouldOverrideUrlLoading(
                WebView view, WebResourceRequest request) {
                // No navigation to arbitrary pages, even within the virtual origin.
                return true;
            }
        });
        browser.addJavascriptInterface(new NativeSaveBridge(),"BearframeNative");
        browser.addJavascriptInterface(audioFocus,"BearframeAudioFocus");
        browser.addJavascriptInterface(exporter,"BearframeArchiveExport");
        setContentView(browser);
        browser.loadUrl(DIAGNOSTICS);
    }

    /** Exposed only to instrumentation in this development phase. */
    public WebView getEngineWebView(){return browser;}

    @Override public void onTrimMemory(int level) {
        super.onTrimMemory(level);
        // Only the renderer cache is affected. No gameplay or save mutation.
        // JS executes on the WebView thread; a destroyed Activity has no browser.
        if (browser != null) {
            final int safeLevel=Math.max(0,Math.min(100,level));
            browser.evaluateJavascript(
                "window.BearframeHost&&window.BearframeHost.memoryPressure&&"+
                "window.BearframeHost.memoryPressure("+safeLevel+")",null);
        }
    }

    @Override protected void onPause() {
        audioFocus.abandon();
        if(browser!=null){
            browser.evaluateJavascript(
                "window.BearframeHost&&window.BearframeHost.suspend()",null);
            browser.onPause();
        }
        super.onPause();
    }
    @Override protected void onResume() {
        super.onResume();
        if(browser!=null){
            browser.onResume();
            browser.evaluateJavascript(
                "window.BearframeHost&&window.BearframeHost.resume()",null);
        }
    }
    @Override protected void onActivityResult(int requestCode,int resultCode,Intent data){
        super.onActivityResult(requestCode,resultCode,data);
        exporter.onResult(requestCode,resultCode,data);
    }
    @Override protected void onDestroy() {
        exporter.cancel();
        audioFocus.abandon();
        if(browser!=null){
            browser.removeJavascriptInterface("BearframeNative");
            browser.removeJavascriptInterface("BearframeAudioFocus");
            browser.removeJavascriptInterface("BearframeArchiveExport");
            browser.stopLoading();
            browser.destroy();
            browser=null;
        }
        super.onDestroy();
    }
}

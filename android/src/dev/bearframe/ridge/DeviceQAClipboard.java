package dev.bearframe.ridge;

import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.os.Build;
import android.os.Debug;
import android.webkit.JavascriptInterface;
import org.json.JSONObject;

/** Read-only host-process sampling and explicit user-requested QA copy.
 * Does not read saves, Android IDs, files, accounts, location or game content.
 * Android WebView may use a separate renderer process: PSS is HOST-ONLY.
 */
public final class DeviceQAClipboard {
    private final Activity activity;
    public DeviceQAClipboard(Activity activity){
        this.activity=activity;
    }
    @JavascriptInterface public String metrics(){
        try{
            Debug.MemoryInfo info=new Debug.MemoryInfo();
            Debug.getMemoryInfo(info);
            Runtime rt=Runtime.getRuntime();
            JSONObject out=new JSONObject();
            out.put("apiLevel",Build.VERSION.SDK_INT);
            out.put("model",Build.MODEL==null?"unknown":
                Build.MODEL.substring(0,Math.min(64,Build.MODEL.length())));
            out.put("hostProcessPssKb",Math.max(0,info.getTotalPss()));
            out.put("nativeHeapAllocatedBytes",Math.max(0,Debug.getNativeHeapAllocatedSize()));
            out.put("javaHeapUsedBytes",Math.max(0,
                rt.totalMemory()-rt.freeMemory()));
            return out.toString();
        }catch(Exception error){return "{}";}
    }
    /** Called only by the explicit "Copy device QA report" user control.
     * A format/size gate prevents arbitrary JS from putting sensitive
     * unbounded text into the Android clipboard through this bridge.
     */
    @JavascriptInterface public boolean copyReport(String content){
        if(content==null||content.length()<40||content.length()>12000)return false;
        try{
            JSONObject obj=new JSONObject(content);
            if(!"bearframe-device-qa".equals(obj.getString("kind"))||
               obj.getInt("version")!=1||
               !obj.has("display")||!obj.has("touch")||
               !obj.has("renderer")||!obj.has("renderWork")||
               !obj.has("saveVerified")||
               !obj.has("native")||!obj.has("interpretation"))
                return false;
            ClipboardManager clipboard=(ClipboardManager)
                activity.getSystemService(Context.CLIPBOARD_SERVICE);
            if(clipboard==null)return false;
            clipboard.setPrimaryClip(
                ClipData.newPlainText("Bearframe engine QA",content));
            return true;
        }catch(Exception failure){return false;}
    }
}

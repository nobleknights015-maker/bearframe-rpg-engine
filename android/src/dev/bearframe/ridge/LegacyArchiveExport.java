package dev.bearframe.ridge;

import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.webkit.JavascriptInterface;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import org.json.JSONObject;

/** User-chosen document export of the VERIFIED, independent old-save vault.
 * There is no arbitrary storage permission and no write to the old game's
 * ExpeditionActivity preferences. The user chooses the destination.
 */
public final class LegacyArchiveExport {
    public static final int REQUEST_CODE=4917;
    public interface ResultListener { void onResult(String result); }
    private final Activity activity;
    private final ResultListener listener;
    private String pending;
    public LegacyArchiveExport(Activity activity,ResultListener listener){
        this.activity=activity;
        this.listener=listener;
    }
    private static String checksum(String body){
        int h=0x811c9dc5;
        for(int i=0;i<body.length();i++){
            h^=body.charAt(i);
            h*=16777619;
        }
        return String.format(Locale.ROOT,"%08x",h);
    }
    private static String payload(String raw){
        if(raw==null||raw.length()>2000000||raw.length()<30)return null;
        try{
            JSONObject envelope=new JSONObject(raw);
            if(envelope.length()!=6||envelope.getInt("format")!=1||
               !"legacy-v1-archive".equals(envelope.getString("project"))||
               envelope.getInt("version")!=1||envelope.getInt("sequence")!=0)
                return null;
            String body=envelope.getString("body");
            if(!checksum(body).equals(envelope.getString("checksum")))return null;
            JSONObject state=new JSONObject(body);
            if(state.length()!=5||state.getInt("version")!=1||
               !"legacy-v1-archive".equals(state.getString("project"))||
               state.getInt("sequence")!=0||
               !"ExpeditionActivity/expedition".equals(state.getString("origin")))
                return null;
            String original=state.getString("payload");
            if(original.length()<2||original.length()>1900000)return null;
            JSONObject data=new JSONObject(original);
            if(data.getInt("v")!=1)return null;
            return original;
        }catch(Exception invalid){return null;}
    }
    private String archived(){
        SharedPreferences p=activity.getSharedPreferences("bearframe_unified_v1",Activity.MODE_PRIVATE);
        String a=null,b=null;
        try{
            a=payload(p.getString("bf:legacy-v1-archive:v1:backup:a",null));
            b=payload(p.getString("bf:legacy-v1-archive:v1:backup:b",null));
        }catch(RuntimeException invalid){return null;}
        if(a!=null&&b!=null&&!a.equals(b))return null;
        return a!=null?a:b;
    }
    @JavascriptInterface public boolean hasVerifiedArchive(){
        return archived()!=null;
    }
    @JavascriptInterface public synchronized boolean begin(){
        if(pending!=null)return false;
        String raw=archived();
        if(raw==null)return false;
        pending=raw;
        activity.runOnUiThread(()->{
            try{
                Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("application/json");
                intent.putExtra(Intent.EXTRA_TITLE,"bearframe-legacy-save.json");
                activity.startActivityForResult(intent,REQUEST_CODE);
            }catch(RuntimeException missingPicker){
                synchronized(LegacyArchiveExport.this){pending=null;}
                listener.onResult("failed");
            }
        });
        return true;
    }
    public void onResult(int code,int resultCode,Intent data){
        if(code!=REQUEST_CODE)return;
        String raw;
        synchronized(this){raw=pending;pending=null;}
        if(resultCode!=Activity.RESULT_OK||data==null||data.getData()==null){
            listener.onResult("cancelled");return;
        }
        if(raw==null){listener.onResult("failed");return;}
        Uri chosen=data.getData();
        try(OutputStream out=activity.getContentResolver().openOutputStream(chosen,"w")){
            if(out==null)throw new IllegalStateException("Document provider unavailable");
            out.write(raw.getBytes(StandardCharsets.UTF_8));
            out.flush();
            listener.onResult("saved");
        }catch(Exception failed){
            listener.onResult("failed");
        }
    }
    public synchronized void cancel(){pending=null;}
}

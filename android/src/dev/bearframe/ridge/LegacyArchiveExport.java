package dev.bearframe.ridge;

import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.webkit.JavascriptInterface;
import java.io.OutputStream;
import java.io.InputStream;
import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import org.json.JSONObject;

/** User-chosen document export of the VERIFIED, independent old-save vault.
 * There is no arbitrary storage permission and no write to the old game's
 * ExpeditionActivity preferences. The user chooses the destination.
 */
public final class LegacyArchiveExport {
    public static final int REQUEST_CODE=4917;
    public static final int RESTORE_REQUEST=4918;
    public static final int COMPAT_RESTORE_REQUEST=4919;
    public interface ResultListener { void onResult(String result); }
    private final Activity activity;
    private final ResultListener listener;
    private String pending;
    private boolean restoring;
    private boolean restoringCompat;
    private String stagedCompat;
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
            return LegacyV1Validator.accepts(original)?original:null;
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
    /** Verified playable-compatibility journal selection, fail closed on
     * malformed/ambiguous occupied slots. Export only the original-format
     * fields, so the old validator and missing-only restore can accept it. */
    private static final class CompatEntry {
        final String body;
        final String original;
        final long sequence;
        CompatEntry(String body,String original,long sequence){
            this.body=body;this.original=original;this.sequence=sequence;
        }
    }
    private static CompatEntry parseCompat(String raw){
        if(raw==null||raw.length()<30||raw.length()>2000000)return null;
        try{
            JSONObject envelope=new JSONObject(raw);
            if(envelope.length()!=6||envelope.getInt("format")!=1||
               !"legacy-expedition-compat".equals(envelope.getString("project"))||
               envelope.getInt("version")!=1)return null;
            long sequence=envelope.getLong("sequence");
            if(sequence<0||sequence>2147483647L)return null;
            String body=envelope.getString("body");
            if(!checksum(body).equals(envelope.getString("checksum")))return null;
            JSONObject state=new JSONObject(body);
            if(state.length()!=4||state.getInt("version")!=1||
               !"legacy-expedition-compat".equals(state.getString("project"))||
               state.getLong("sequence")!=sequence)return null;
            Object value=state.get("legacy");
            if(!(value instanceof JSONObject))return null;
            String original=((JSONObject)value).toString();
            if(!LegacyV1Validator.accepts(original))return null;
            return new CompatEntry(body,original,sequence);
        }catch(Exception invalid){return null;}
    }
    private String currentCompat(){
        SharedPreferences p=activity.getSharedPreferences("bearframe_unified_v1",Activity.MODE_PRIVATE);
        String prefix="bf:legacy-expedition-compat:v1:session:";
        try{
            String a=p.getString(prefix+"a",null),b=p.getString(prefix+"b",null);
            CompatEntry first=parseCompat(a),second=parseCompat(b);
            if((a!=null&&first==null)||(b!=null&&second==null))
                return null;
            if(first==null&&second==null)return null;
            if(first!=null&&second!=null&&first.sequence==second.sequence &&
               !first.body.equals(second.body))return null;
            CompatEntry latest=second==null?first:first==null?second:
                first.sequence>=second.sequence?first:second;
            return latest.original;
        }catch(RuntimeException invalid){return null;}
    }
    @JavascriptInterface public boolean hasPlayableCompat(){
        return currentCompat()!=null;
    }
    @JavascriptInterface public synchronized boolean beginCompatExport(){
        if(pending!=null||restoring||restoringCompat)return false;
        String raw=currentCompat();
        if(raw==null)return false;
        pending=raw;
        activity.runOnUiThread(()->{
            try{
                Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("application/json");
                intent.putExtra(Intent.EXTRA_TITLE,"bearframe-legacy-continued.json");
                activity.startActivityForResult(intent,REQUEST_CODE);
            }catch(RuntimeException missingPicker){
                synchronized(LegacyArchiveExport.this){pending=null;}
                listener.onResult("failed");
            }
        });
        return true;
    }
    @JavascriptInterface public boolean hasVerifiedArchive(){
        return archived()!=null;
    }
    @JavascriptInterface public synchronized boolean begin(){
        if(pending!=null||restoring||restoringCompat)return false;
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
    @JavascriptInterface public boolean canRestoreIntoEmptySource(){
        return !activity.getSharedPreferences("ExpeditionActivity",Activity.MODE_PRIVATE)
            .contains("expedition");
    }
    @JavascriptInterface public synchronized boolean beginRestore(){
        if(pending!=null||restoring||restoringCompat||!canRestoreIntoEmptySource())return false;
        restoring=true;
        activity.runOnUiThread(()->{
            try{
                Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("application/json");
                activity.startActivityForResult(intent,RESTORE_REQUEST);
            }catch(RuntimeException missingPicker){
                synchronized(LegacyArchiveExport.this){restoring=false;}
                listener.onResult("restore-failed");
            }
        });
        return true;
    }
    /** SAF selection does not write either the old or compatibility save.
     * The caller still needs to confirm the JS preflight after selection. */
    @JavascriptInterface public synchronized boolean beginCompatRestore(){
        if(pending!=null||restoring||restoringCompat)return false;
        try {
            SharedPreferences journal=activity.getSharedPreferences(
                "bearframe_unified_v1",Activity.MODE_PRIVATE);
            String prefix="bf:legacy-expedition-compat:v1:session:";
            if(journal.contains(prefix+"a")||journal.contains(prefix+"b"))return false;
        }catch(RuntimeException unreadable){return false;}
        stagedCompat=null;restoringCompat=true;
        activity.runOnUiThread(()->{
            try{
                Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("application/json");
                activity.startActivityForResult(intent,COMPAT_RESTORE_REQUEST);
            }catch(RuntimeException missingPicker){
                synchronized(LegacyArchiveExport.this){
                    stagedCompat=null;restoringCompat=false;
                }
                listener.onResult("compat-restore-failed");
            }
        });
        return true;
    }
    /** One-shot retrieval of the validated user-selected JSON.
     * A second explicit UI confirmation writes the separate journal. */
    @JavascriptInterface public synchronized String takeCompatRestore(){
        String raw=stagedCompat;stagedCompat=null;return raw;
    }
    /** Called only after system document picker returns, never from JS.
     * Refuses to overwrite any present legacy key, including malformed data.
     */
    synchronized boolean restoreIntoEmptySource(String raw){
        if(!LegacyV1Validator.accepts(raw))return false;
        SharedPreferences old=activity.getSharedPreferences("ExpeditionActivity",Activity.MODE_PRIVATE);
        if(old.contains("expedition"))return false;
        if(!old.edit().putString("expedition",raw).commit())return false;
        try{return raw.equals(old.getString("expedition",null));}
        catch(RuntimeException unreadable){return false;}
    }
    private static String utf8FromDocument(InputStream in) throws Exception{
        ByteArrayOutputStream bytes=new ByteArrayOutputStream();
        byte[] buffer=new byte[8192];int n;
        while((n=in.read(buffer))!=-1){
            if(bytes.size()+n>2000000)throw new IllegalArgumentException("Save file too large");
            bytes.write(buffer,0,n);
        }
        return StandardCharsets.UTF_8.newDecoder()
            .onMalformedInput(CodingErrorAction.REPORT)
            .onUnmappableCharacter(CodingErrorAction.REPORT)
            .decode(ByteBuffer.wrap(bytes.toByteArray())).toString();
    }
    public void onResult(int code,int resultCode,Intent data){
        if(code==COMPAT_RESTORE_REQUEST){
            boolean expected;
            synchronized(this){
                expected=restoringCompat;restoringCompat=false;stagedCompat=null;
            }
            if(!expected){listener.onResult("compat-restore-failed");return;}
            if(resultCode!=Activity.RESULT_OK||data==null||data.getData()==null){
                listener.onResult("compat-restore-cancelled");return;
            }
            try(InputStream in=activity.getContentResolver().openInputStream(data.getData())){
                if(in==null)throw new IllegalStateException("Missing document");
                String raw=utf8FromDocument(in);
                if(!LegacyV1Validator.accepts(raw))
                    throw new IllegalArgumentException("Incompatible original-format save");
                synchronized(this){stagedCompat=raw;}
                listener.onResult("compat-restore-ready");
            }catch(Exception invalid){
                synchronized(this){stagedCompat=null;}
                listener.onResult("compat-restore-failed");
            }
            return;
        }

        if(code==RESTORE_REQUEST){
            boolean expected;
            synchronized(this){expected=restoring;restoring=false;}
            if(!expected){listener.onResult("restore-failed");return;}
            if(resultCode!=Activity.RESULT_OK||data==null||data.getData()==null){
                listener.onResult("restore-cancelled");return;
            }
            try(InputStream in=activity.getContentResolver().openInputStream(data.getData())){
                if(in==null)throw new IllegalStateException("Missing save document");
                String raw=utf8FromDocument(in);
                listener.onResult(restoreIntoEmptySource(raw)?"restored":"restore-refused");
            }catch(Exception invalid){listener.onResult("restore-failed");}
            return;
        }
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
    public synchronized void cancel(){pending=null;restoring=false;restoringCompat=false;stagedCompat=null;}
}

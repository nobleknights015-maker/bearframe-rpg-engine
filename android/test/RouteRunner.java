package dev.bearframe.ridge.tests;

import android.app.*;
import android.content.Intent;
import android.os.Bundle;
import android.view.*;
import android.widget.*;
import android.graphics.*;
import org.json.*;
import java.util.*;
import java.lang.reflect.*;
import java.util.concurrent.atomic.AtomicReference;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import android.webkit.WebView;

/** Runs in the installed app and activates its actual Android controls. */
public final class RouteRunner extends Instrumentation {
    private Activity screen;
    private String stage;
    @Override public void onCreate(Bundle args){super.onCreate(args);stage=args.getString("stage","first");start();}
    private View search(View v,String name,boolean button){
        if(v.getVisibility()!=View.VISIBLE)return null;
        if(v instanceof TextView && (!button||v instanceof Button) &&
            (name.contentEquals(((TextView)v).getText())||name.equals(v.getContentDescription())))return v;
        if(v instanceof ViewGroup){
            ViewGroup group=(ViewGroup)v;
            for(int i=0;i<group.getChildCount();i++){View child=search(group.getChildAt(i),name,button);if(child!=null)return child;}
        }
        return null;
    }
    private void use(String label,boolean click){
        AtomicReference<Throwable> problem=new AtomicReference<>();
        runOnMainSync(()->{
            try{
                View v=search(screen.getWindow().getDecorView(),label,click);
                if(v==null)throw new AssertionError("Missing "+label);
                if(click&&(!v.isEnabled()||!v.performClick()))throw new AssertionError("Disabled "+label);
            }catch(Throwable t){problem.set(t);}
        });
        if(problem.get()!=null)throw new AssertionError(problem.get());
    }
    private void tap(String name){use(name,true);}
    private void gamepadKey(int keyCode){
        AtomicReference<Throwable> error=new AtomicReference<>();
        runOnMainSync(()->{
            try{
                long t=android.os.SystemClock.uptimeMillis();
                KeyEvent down=new KeyEvent(t,t,KeyEvent.ACTION_DOWN,keyCode,0,0,0,0,0,InputDevice.SOURCE_GAMEPAD);
                KeyEvent up=new KeyEvent(t,t+1,KeyEvent.ACTION_UP,keyCode,0,0,0,0,0,InputDevice.SOURCE_GAMEPAD);
                if(!down.isFromSource(InputDevice.SOURCE_GAMEPAD))
                    throw new AssertionError("Synthetic key did not preserve GAMEPAD source: "+down.getSource());
                if(!screen.dispatchKeyEvent(down)||!screen.dispatchKeyEvent(up))
                    throw new AssertionError("Gamepad key not handled: "+keyCode);
            }catch(Throwable x){error.set(x);}
        });
        if(error.get()!=null)throw new AssertionError(error.get());
    }
    private void gamepadAxis(float axisX,float axisY){
        AtomicReference<Throwable> error=new AtomicReference<>();
        runOnMainSync(()->{
            try{
                long t=android.os.SystemClock.uptimeMillis();
                MotionEvent.PointerProperties properties=new MotionEvent.PointerProperties();
                properties.id=0;properties.toolType=MotionEvent.TOOL_TYPE_UNKNOWN;
                MotionEvent.PointerCoords coords=new MotionEvent.PointerCoords();
                coords.setAxisValue(MotionEvent.AXIS_X,axisX);
                coords.setAxisValue(MotionEvent.AXIS_Y,axisY);
                MotionEvent e=MotionEvent.obtain(t,t,MotionEvent.ACTION_MOVE,1,
                    new MotionEvent.PointerProperties[]{properties},
                    new MotionEvent.PointerCoords[]{coords},0,0,1f,1f,0,0,
                    InputDevice.SOURCE_JOYSTICK,0);
                boolean handled=screen.onGenericMotionEvent(e);e.recycle();
                if(!handled)throw new AssertionError("Analog stick event not handled");
            }catch(Throwable x){error.set(x);}
        });
        if(error.get()!=null)throw new AssertionError(error.get());
    }
    private void walk(String path){
        for(char dir:path.toCharArray())tap(dir=='R'?"Move east":dir=='U'?"Move north":dir=='D'?"Move south":"Move west");
    }
    /** Exercises the independently packaged Android graphics adapter without launching gameplay. */
    private void atlasSmoke() throws Exception {
        Bitmap atlas=Bitmap.createBitmap(32,32,Bitmap.Config.ARGB_8888);
        atlas.eraseColor(Color.RED);
        Bitmap output=Bitmap.createBitmap(64,64,Bitmap.Config.ARGB_8888);
        output.eraseColor(Color.BLACK);
        Map<String,Bitmap> atlases=new HashMap<>();
        atlases.put("test",atlas);
        JSONArray commands=new JSONArray();
        commands.put(new JSONObject().put("type","clear").put("color","#000000"));
        commands.put(new JSONObject().put("type","sprite").put("imageId","test")
            .put("source",new JSONObject().put("x",0).put("y",0).put("w",32).put("h",32))
            .put("dest",new JSONObject().put("x",8).put("y",8).put("w",32).put("h",32)));
        JSONObject frame=new JSONObject().put("width",64).put("height",64)
            .put("commands",commands);
        Class<?> renderer=getTargetContext().getClassLoader()
            .loadClass("dev.bearframe.ridge.AtlasSceneRenderer");
        Object instance=renderer.getDeclaredConstructor().newInstance();
        Method draw=renderer.getMethod("draw",Canvas.class,JSONObject.class,Map.class);
        draw.invoke(instance,new Canvas(output),frame,atlases);
        if(output.getPixel(12,12)!=Color.RED||output.getPixel(45,45)!=Color.BLACK)
            throw new AssertionError("Atlas draw output has incorrect pixels");
        Bitmap untouched=Bitmap.createBitmap(64,64,Bitmap.Config.ARGB_8888);
        untouched.eraseColor(Color.GREEN);
        try{
            draw.invoke(instance,new Canvas(untouched),frame,new HashMap<String,Bitmap>());
            throw new AssertionError("Missing texture atlas did not reject the frame");
        }catch(InvocationTargetException expected){
            if(!(expected.getCause() instanceof IllegalArgumentException))throw expected;
        }
        if(untouched.getPixel(12,12)!=Color.GREEN)
            throw new AssertionError("Rejected frame modified the framebuffer");
    }
    private WebView findWebView(View root){
        if(root instanceof WebView)return (WebView)root;
        if(root instanceof ViewGroup){
            ViewGroup group=(ViewGroup)root;
            for(int i=0;i<group.getChildCount();i++){
                WebView found=findWebView(group.getChildAt(i));
                if(found!=null)return found;
            }
        }
        return null;
    }
    private String evalHost(final String expression) throws Exception {
        WebView browser=findWebView(screen.getWindow().getDecorView());
        if(browser==null)throw new AssertionError("Missing unified engine WebView");
        CountDownLatch latch=new CountDownLatch(1);
        AtomicReference<String> output=new AtomicReference<>();
        AtomicReference<Throwable> error=new AtomicReference<>();
        runOnMainSync(()->{
            try{
                browser.evaluateJavascript(expression,value->{output.set(value);latch.countDown();});
            }catch(Throwable ex){error.set(ex);latch.countDown();}
        });
        if(!latch.await(12,TimeUnit.SECONDS))throw new AssertionError("WebView JavaScript timeout");
        if(error.get()!=null)throw new AssertionError(error.get());
        return output.get();
    }
    private JSONObject unifiedSnapshot() throws Exception {
        for(int attempt=0;attempt<30;attempt++){
            String raw=evalHost("window.BearframeHost && BearframeHost.snapshotJson()");
            if(raw!=null && !"null".equals(raw)){
                Object value=new JSONTokener(raw).nextValue();
                if(value instanceof String){
                    JSONObject state=new JSONObject((String)value);
                    if(state.optBoolean("ready"))return state;
                    if(state.has("error")&&!"null".equals(state.optString("error")))
                        throw new AssertionError("Unified host failed to boot: "+state);
                }
            }
            Thread.sleep(200);
        }
        throw new AssertionError("Unified engine did not become ready");
    }
    private void checkUnified(boolean second) throws Exception {
        Intent launch=new Intent();
        launch.setClassName("dev.bearframe.ridge","dev.bearframe.ridge.UnifiedEngineActivity");
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        screen=startActivitySync(launch);
        // Verify the installed APK actually contains the original offline WAV.
        try(java.io.InputStream audio=getTargetContext().getAssets()
                .open("enginehost/audio/diagnostics/silence.wav")){
            byte[] header=new byte[44];
            int count=0;
            while(count<header.length){
                int n=audio.read(header,count,header.length-count);
                if(n<0)break;
                count+=n;
            }
            if(count!=44 || header[0]!='R'||header[1]!='I'||header[2]!='F'||header[3]!='F'||
               header[8]!='W'||header[9]!='A'||header[10]!='V'||header[11]!='E'||
               header[36]!='d'||header[37]!='a'||header[38]!='t'||header[39]!='a')
                throw new AssertionError("Packaged offline WAV missing or invalid");
        }
        JSONObject loaded=unifiedSnapshot();
        if(!"framework-test".equals(loaded.getString("project")))
            throw new AssertionError("Wrong unified project: "+loaded);
        if(loaded.optInt("assetsLoaded",-1)!=2 ||
           !"packaged-png".equals(loaded.optString("atlasSource")))
            throw new AssertionError("Unified WebView failed to load validated packaged PNG atlases: "+loaded);
        String pixel=evalHost("document.getElementById('surface').getContext('2d').getImageData(0,0,1,1).data[0]");
        if(!"23".equals(pixel))
            throw new AssertionError("Unified WebView did not draw expected packaged atlas pixels: "+pixel);
        // The WebView storage bridge must never touch legacy game saves or
        // arbitrary preference keys; its allowed namespace is engine-only.
        if(!"false".equals(evalHost("BearframeNative.write('expedition','overwrite')")) ||
           !"null".equals(evalHost("BearframeNative.read('expedition')")))
            throw new AssertionError("Unified WebView bridge exposed legacy save keys");
        int expectedSequence=second?1:0,expectedY=second?2:1;
        if(loaded.getInt("sequence")!=expectedSequence ||
           loaded.getInt("y")!=expectedY ||
           loaded.getInt("savedRevision")!=expectedSequence)
            throw new AssertionError("Unified WebView did not recover prior revision: "+loaded);
        String direction=second?"up":"down";
        String reply=evalHost("JSON.stringify(BearframeHost.navigate('"+direction+"'))");
        Object parsed=new JSONTokener(reply).nextValue();
        JSONObject moved=new JSONObject((String)parsed);
        if(!moved.getBoolean("ok"))throw new AssertionError("Unified move rejected: "+moved);
        JSONObject next=unifiedSnapshot();
        if(next.getInt("sequence")!=expectedSequence+1 ||
           next.getInt("savedRevision")!=expectedSequence+1 ||
           next.getInt("y")!=(second?1:2) ||
           next.getInt("validSlots")<1)
            throw new AssertionError("Unified WebView state was not durably committed: "+next);
        resultMeta.putString("unified",next.toString());
    }
    /** Installed-app low-memory acceptance: purge decoded atlases, recover them
     * asynchronously, and prove that the durable journal did not change. */
    private void checkUnifiedMemoryRecovery() throws Exception {
        Intent launch=new Intent();
        launch.setClassName("dev.bearframe.ridge","dev.bearframe.ridge.UnifiedEngineActivity");
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        screen=startActivitySync(launch);
        JSONObject before=unifiedSnapshot();
        int revision=before.getInt("sequence");
        int saved=before.getInt("savedRevision");
        if(before.getInt("assetsLoaded")!=2)
            throw new AssertionError("Missing baseline packaged atlases: "+before);
        // Use the native Activity callback, rather than invoking JS directly:
        // this verifies Android -> WebView -> cache -> rehydration wiring.
        AtomicReference<Throwable> callbackError=new AtomicReference<>();
        runOnMainSync(()->{
            try{screen.onTrimMemory(android.content.ComponentCallbacks2.TRIM_MEMORY_COMPLETE);}
            catch(Throwable error){callbackError.set(error);}
        });
        if(callbackError.get()!=null)throw new AssertionError(callbackError.get());
        boolean recovered=false;
        for(int attempt=0;attempt<50;attempt++){
            JSONObject snap=new JSONObject((String)new JSONTokener(
                evalHost("BearframeHost.snapshotJson()")
            ).nextValue());
            if(snap.getInt("sequence")!=revision || snap.getInt("savedRevision")!=saved)
                throw new AssertionError("Memory recovery mutated saved gameplay: "+snap);
            if(snap.getInt("trimCount")>0 && snap.getInt("recoveryCount")>0 &&
               !snap.getBoolean("restoring") && snap.getInt("assetsLoaded")==2){
                recovered=true;break;
            }
            Thread.sleep(200);
        }
        if(!recovered)
            throw new AssertionError("WebView did not prove eviction and atlas rehydration");
        String pixel=evalHost("document.getElementById('surface').getContext('2d').getImageData(0,0,1,1).data[0]");
        if(!"23".equals(pixel))
            throw new AssertionError("Restored canvas did not draw packaged pixels: "+pixel);
        JSONObject after=unifiedSnapshot();
        if(after.getInt("sequence")!=revision || after.getInt("savedRevision")!=saved)
            throw new AssertionError("Recovery changed journal: "+after);
        resultMeta.putString("memory","PASS native trim, atlas reload, canvas and unchanged journal");
    }
    /** Verify the *actual* legacy Activity preferences are available through a
     * narrow read-only bridge without exposing destination writes or mutating
     * either the old source or unified engine journal. */
    private void checkUnifiedLegacyRead() throws Exception {
        android.content.SharedPreferences legacy=getTargetContext()
            .getSharedPreferences("ExpeditionActivity",android.content.Context.MODE_PRIVATE);
        JSONObject flags=new JSONObject();
        for(String flag:new String[]{"bearing","E","D","H","echoAlly","gridAlly","met"})
            flags.put(flag,false);
        String raw=new JSONObject().put("v",1).put("name","Migration fixture")
            .put("finish","Ash").put("area","pod").put("x",3).put("y",4)
            .put("hp",30).put("charge",2).put("weapon",JSONObject.NULL)
            .put("flags",flags).put("battle",JSONObject.NULL)
            .put("prompt",JSONObject.NULL).put("message","Read-only source snapshot")
            .toString();
        if(!legacy.edit().putString("expedition",raw).putString("other","preserve").commit())
            throw new AssertionError("Cannot prepare existing source preference");
        Intent launch=new Intent();
        launch.setClassName("dev.bearframe.ridge","dev.bearframe.ridge.UnifiedEngineActivity");
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        screen=startActivitySync(launch);
        JSONObject before=unifiedSnapshot();
        Object value=new JSONTokener(evalHost("BearframeNative.readLegacyExpedition()")).nextValue();
        if(!(value instanceof String)||!raw.equals(value))
            throw new AssertionError("Read-only bridge lost original legacy bytes");
        String checked=evalHost("JSON.stringify(BearframeLegacyV1.inspect(BearframeNative.readLegacyExpedition()))");
        JSONObject described=new JSONObject((String)new JSONTokener(checked).nextValue());
        if(!described.getBoolean("ok") || described.getInt("version")!=1 ||
           !"Migration fixture".equals(described.getString("name")) ||
           !"pod".equals(described.getString("area")))
            throw new AssertionError("Installed engine rejected legacy v1 snapshot: "+described);
        if(!"false".equals(evalHost("BearframeNative.write('expedition','overwrite')")) ||
           !"null".equals(evalHost("BearframeNative.read('expedition')")) ||
           !"\"undefined\"".equals(evalHost("typeof BearframeNative.writeLegacyExpedition")))
            throw new AssertionError("Legacy namespace writable through engine bridge");
        if(!raw.equals(legacy.getString("expedition",null)) ||
           !"preserve".equals(legacy.getString("other",null)))
            throw new AssertionError("Legacy preferences mutated by inspection");
        JSONObject after=unifiedSnapshot();
        if(before.getInt("sequence")!=after.getInt("sequence") ||
           before.getInt("savedRevision")!=after.getInt("savedRevision"))
            throw new AssertionError("Inspection modified unified engine journal");
        // Wrong type and missing source must fail closed without crashing WebView.
        if(!legacy.edit().putInt("expedition",42).commit())
            throw new AssertionError("Cannot set corrupt source fixture");
        if(!"null".equals(evalHost("BearframeNative.readLegacyExpedition()")) ||
           !"\"false\"".equals(evalHost("String(BearframeLegacyV1.inspect(BearframeNative.readLegacyExpedition()).ok)")))
            throw new AssertionError("Wrong-type legacy source was accepted");
        if(!legacy.edit().remove("expedition").commit())
            throw new AssertionError("Cannot clear test fixture");
        if(!"null".equals(evalHost("BearframeNative.readLegacyExpedition()")))
            throw new AssertionError("Missing legacy source was accepted");
        resultMeta.putString("legacy","PASS exact-key read-only bridge, corruption and journal isolation");
    }
    /**
     * Read-only stress of the real installed offline WebView, portable core and
     * synchronous Android journal. First stage performs 256 durable moves;
     * stage two verifies exact process-death recovery, then commits 64 more.
     * No campaign, legacy source or diagnostic assets are modified.
     */
    private void checkUnifiedSoak(boolean restart) throws Exception {
        Intent launch=new Intent();
        launch.setClassName("dev.bearframe.ridge","dev.bearframe.ridge.UnifiedEngineActivity");
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        screen=startActivitySync(launch);
        JSONObject before=unifiedSnapshot();
        int initial=restart?256:0,cycles=restart?32:128;
        if(before.getInt("sequence")!=initial ||
           before.getInt("savedRevision")!=initial ||
           before.getInt("x")!=1 || before.getInt("y")!=1 ||
           before.getInt("assetsLoaded")!=2)
            throw new AssertionError("Soak began from unexpected recovery state: "+before);
        long started=android.os.SystemClock.elapsedRealtime();
        // Keep each synchronous WebView batch below the instrumentation timeout,
        // with journal readback at every eight complete down/up round trips.
        for(int block=0;block<cycles;block+=8){
            String batch=evalHost("(function(){for(var n=0;n<8;n++){" +
                "var down=BearframeHost.navigate('down');" +
                "if(!down.ok)return 'down:'+down.reason;" +
                "var up=BearframeHost.navigate('up');" +
                "if(!up.ok)return 'up:'+up.reason;" +
                "}return 'ok';})()");
            if(!"\"ok\"".equals(batch))
                throw new AssertionError("WebView soak action failed: "+batch);
            JSONObject snap=unifiedSnapshot();
            int expected=initial+(block+8)*2;
            if(snap.getInt("sequence")!=expected ||
               snap.getInt("savedRevision")!=expected ||
               snap.getInt("x")!=1 || snap.getInt("y")!=1 ||
               snap.getInt("validSlots")!=2)
                throw new AssertionError("Soak journal drift at "+expected+": "+snap);
        }
        long elapsed=android.os.SystemClock.elapsedRealtime()-started;
        resultMeta.putString("soak","PASS "+(cycles*2)+
            " committed moves; "+elapsed+"ms; revision "+(initial+cycles*2));
    }
    /** Confirm the actual optional signed-APK asset pack decodes through the
     * restricted local WebView origin, with the legacy and journal state intact.
     * The synthetic pixel fixture has no narrative or production content. */
    private void checkUnifiedAssetPack() throws Exception {
        Intent launch=new Intent();
        launch.setClassName("dev.bearframe.ridge","dev.bearframe.ridge.UnifiedEngineActivity");
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        screen=startActivitySync(launch);
        JSONObject before=unifiedSnapshot();
        String start=evalHost("(function(){" +
            "window.__bfPackProbe='pending';" +
            "var img=new Image();" +
            "img.onload=function(){try{" +
              "var c=document.createElement('canvas');c.width=1;c.height=1;" +
              "var context=c.getContext('2d');context.drawImage(img,0,0);" +
              "var rgba=context.getImageData(0,0,1,1).data;" +
              "window.__bfPackProbe=(img.naturalWidth===64&&img.naturalHeight===32&&" +
                "rgba[0]===76&&rgba[1]===100&&rgba[2]===128&&rgba[3]===255)?" +
                "'decoded':'unexpected-pixels';" +
             "}catch(e){window.__bfPackProbe='canvas-error';}};" +
            "img.onerror=function(){window.__bfPackProbe='image-error';};" +
            "img.src='/enginehost/packs/active/diagnostic/test.png';" +
            "return 'started';})()");
        if(!"\"started\"".equals(start))
            throw new AssertionError("Packaged asset probe did not start: "+start);
        String state="pending";
        for(int attempt=0;attempt<40;attempt++){
            state=evalHost("window.__bfPackProbe");
            if("\"decoded\"".equals(state))break;
            if(!"\"pending\"".equals(state))
                throw new AssertionError("Offline asset pack did not decode: "+state);
            Thread.sleep(200);
        }
        if(!"\"decoded\"".equals(state))
            throw new AssertionError("Offline asset pack decode timed out");
        JSONObject after=unifiedSnapshot();
        if(before.getInt("sequence")!=after.getInt("sequence") ||
           before.getInt("savedRevision")!=after.getInt("savedRevision"))
            throw new AssertionError("Packaged asset probe mutated game state");
        resultMeta.putString("pack","PASS original synthetic PNG pixels decoded from installed custom pack");
    }
    /** Installed Activity recreation acceptance. This is not a physical device
     * orientation/thermal claim. It exercises real onPause/onDestroy/onCreate
     * and the same durable two-slot journal through the Android WebView host. */
    private void checkUnifiedRecreate() throws Exception {
        Intent launch=new Intent();
        launch.setClassName("dev.bearframe.ridge","dev.bearframe.ridge.UnifiedEngineActivity");
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        screen=startActivitySync(launch);
        JSONObject initial=unifiedSnapshot();
        if(initial.getInt("sequence")!=0||initial.getInt("savedRevision")!=0 ||
           initial.getInt("x")!=1||initial.getInt("y")!=1)
            throw new AssertionError("Recreate test started with stale state: "+initial);
        String moved=evalHost("JSON.stringify(BearframeHost.navigate('down'))");
        JSONObject movedResult=new JSONObject((String)new JSONTokener(moved).nextValue());
        if(!movedResult.getBoolean("ok"))throw new AssertionError("Pre-recreate move rejected");
        JSONObject committed=unifiedSnapshot();
        if(committed.getInt("sequence")!=1||committed.getInt("savedRevision")!=1||
           committed.getInt("y")!=2)
            throw new AssertionError("Move not durable before Activity recreation: "+committed);
        Activity old=screen;
        ActivityMonitor monitor=addMonitor("dev.bearframe.ridge.UnifiedEngineActivity",null,false);
        try{
            runOnMainSync(()->old.recreate());
            Activity restored=waitForMonitorWithTimeout(monitor,15000);
            if(restored==null||restored==old)
                throw new AssertionError("WebView Activity did not recreate");
            screen=restored;
            waitForIdleSync();
        }finally{removeMonitor(monitor);}
        JSONObject recovered=unifiedSnapshot();
        if(recovered.getInt("sequence")!=1||recovered.getInt("savedRevision")!=1||
           recovered.getInt("x")!=1||recovered.getInt("y")!=2||
           recovered.getInt("assetsLoaded")!=2)
            throw new AssertionError("Activity recreation lost durable state or atlases: "+recovered);
        String result=evalHost("JSON.stringify(BearframeHost.navigate('up'))");
        JSONObject outcome=new JSONObject((String)new JSONTokener(result).nextValue());
        if(!outcome.getBoolean("ok"))throw new AssertionError("Post-recreate move rejected");
        JSONObject finalState=unifiedSnapshot();
        if(finalState.getInt("sequence")!=2||finalState.getInt("savedRevision")!=2 ||
           finalState.getInt("y")!=1||finalState.getInt("validSlots")!=2)
            throw new AssertionError("Post-recreate journal did not commit: "+finalState);
        resultMeta.putString("recreate","PASS WebView Activity recreation, asset reload and save rev 1 to 2");
    }
    /** Decode the packaged offline audio in the installed Chromium WebView, not
     * merely the APK filesystem. Require decoded media data, not only metadata.\n     * This does not assert audible output or autoplay. */
    private void checkUnifiedAudioDecode() throws Exception {
        Intent launch=new Intent();
        launch.setClassName("dev.bearframe.ridge","dev.bearframe.ridge.UnifiedEngineActivity");
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        screen=startActivitySync(launch);
        unifiedSnapshot();
        String start=evalHost("(function(){window.__bfAudioDecode='pending';" +
            "var a=document.createElement('audio');" +
            "a.preload='auto';" +
            "a.onloadedmetadata=function(){if(!(a.duration>0&&isFinite(a.duration)))" +
                "window.__bfAudioDecode='invalid-duration';};" +
            "a.onloadeddata=function(){if(window.__bfAudioDecode==='pending')" +
                "window.__bfAudioDecode=(a.readyState>=a.HAVE_CURRENT_DATA&&" +
                "a.buffered.length>0&&a.buffered.end(0)>0)?'decoded':'no-decoded-data';};" +
            "a.onerror=function(){window.__bfAudioDecode='decode-error-'+(a.error?a.error.code:'unknown');};" +
            "a.src='/enginehost/audio/diagnostics/silence.wav';a.load();" +
            "return 'started';})()");
        if(!"\"started\"".equals(start))
            throw new AssertionError("Audio decode probe failed to start: "+start);
        String result="pending";
        for(int attempt=0;attempt<40;attempt++){
            result=evalHost("window.__bfAudioDecode");
            if("\"decoded\"".equals(result))break;
            if(!"\"pending\"".equals(result))
                throw new AssertionError("Packaged WebView audio decode failed: "+result);
            Thread.sleep(200);
        }
        if(!"\"decoded\"".equals(result))
            throw new AssertionError("WebView audio metadata decode timed out: "+result);
        resultMeta.putString("audio","PASS packaged WAV media data decoded by WebView");
    }
    private Bundle resultMeta = new Bundle();
    @Override public void onStart(){
        Bundle result=new Bundle();
        try{
            if(stage.equals("unified-first") || stage.equals("unified-second")){
                checkUnified(stage.equals("unified-second"));
                result.putAll(resultMeta);
                result.putString("route","PASS "+stage);
                finish(Activity.RESULT_OK,result);
                return;
            }
            if(stage.equals("unified-pack")){
                checkUnifiedAssetPack();
                result.putAll(resultMeta);
                result.putString("route","PASS unified-pack");
                finish(Activity.RESULT_OK,result);
                return;
            }
            if(stage.equals("unified-legacy")){
                checkUnifiedLegacyRead();
                result.putAll(resultMeta);
                result.putString("route","PASS unified-legacy");
                finish(Activity.RESULT_OK,result);
                return;
            }
            if(stage.equals("unified-recreate")){
                checkUnifiedRecreate();
                result.putAll(resultMeta);
                result.putString("route","PASS unified-recreate");
                finish(Activity.RESULT_OK,result);
                return;
            }
            if(stage.equals("unified-memory")){
                checkUnifiedMemoryRecovery();
                result.putAll(resultMeta);
                result.putString("route","PASS unified-memory");
                finish(Activity.RESULT_OK,result);
                return;
            }
            if(stage.equals("unified-soak-first") || stage.equals("unified-soak-second")){
                checkUnifiedSoak(stage.equals("unified-soak-second"));
                result.putAll(resultMeta);
                result.putString("route","PASS "+stage);
                finish(Activity.RESULT_OK,result);
                return;
            }
            if(stage.equals("unified-audio")){
                checkUnifiedAudioDecode();
                result.putAll(resultMeta);
                result.putString("route","PASS unified-audio");
                finish(Activity.RESULT_OK,result);
                return;
            }
            if(stage.equals("kit")){
                atlasSmoke();
                result.putString("route","PASS kit");
                finish(Activity.RESULT_OK,result);
                return;
            }
            Intent launch=getTargetContext().getPackageManager().getLaunchIntentForPackage("dev.bearframe.ridge");
            launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);screen=startActivitySync(launch);
            if(stage.equals("controller")){
                AtomicReference<Throwable> focusFailure=new AtomicReference<>();
                runOnMainSync(()->{
                    try{
                        View awaken=search(screen.getWindow().getDecorView(),"Awaken",true);
                        if(awaken==null || !awaken.requestFocus())
                            throw new AssertionError("Controller cannot focus title confirmation");
                    }catch(Throwable t){focusFailure.set(t);}
                });
                if(focusFailure.get()!=null)throw new AssertionError(focusFailure.get());
                gamepadKey(KeyEvent.KEYCODE_BUTTON_A);
                // A/Cross activates character creation before gameplay begins.
                java.lang.reflect.Field titleField=screen.getClass().getDeclaredField("title");
                titleField.setAccessible(true);
                if(titleField.get(screen)==null)throw new AssertionError("Controller test not in gameplay");
                java.lang.reflect.Field padField=screen.getClass().getDeclaredField("gamepad");
                padField.setAccessible(true);
                Object router=padField.get(screen);
                java.lang.reflect.Field enabledField=router.getClass().getDeclaredField("enabled");
                enabledField.setAccessible(true);
                if(!enabledField.getBoolean(router))throw new AssertionError("Native gamepad adapter disabled during gameplay");
                gamepadKey(KeyEvent.KEYCODE_DPAD_UP);
                gamepadKey(KeyEvent.KEYCODE_DPAD_UP);
                gamepadKey(KeyEvent.KEYCODE_DPAD_UP);
                JSONObject controllerState=new JSONObject(screen.getPreferences(0).getString("expedition","{}"));
                if(!"G".equals(controllerState.optString("prompt")))
                    throw new AssertionError("Controller movement did not open Guardian prompt: "+controllerState);
                use("Listen",false); // D-pad moved through the world, opening the NPC prompt.
                gamepadKey(KeyEvent.KEYCODE_BUTTON_B);
                // Cancel must dismiss the prompt without choosing an action.
                if(search(screen.getWindow().getDecorView(),"Step back",true)!=null)
                    throw new AssertionError("Gamepad cancel did not close prompt");
                gamepadKey(KeyEvent.KEYCODE_DPAD_UP);
                use("Listen",false);
                gamepadKey(KeyEvent.KEYCODE_BUTTON_A);
                use("“Take the drainage gallery. The roof there still holds.” The Guardian stays at its post.",false);
                gamepadAxis(0f,0.9f);
                gamepadAxis(0f,0f);
                result.putString("route","PASS controller");
                finish(Activity.RESULT_OK,result);
                return;
            }
            if(stage.equals("first")){
                tap("Awaken");walk("UUU");tap("Listen");walk("DDRRRR");tap("Fit legacy bearing");walk("R");tap("Equip arc blade");
                walk("DRRRURRR");use("Relay gallery",false);walk("RRRUUU");tap("Ask to travel together");
                walk("DDRRRR");tap("Engage");tap("Pulse · 1 charge");use("Turn 2",false);
            }else{
                use("Turn 2",false);tap("Strike");walk("RRRRR");use("Sounding ridge",false);walk("RRUUU");tap("Request escort");
                walk("DDRRRRRR");tap("Keep your name private");use("Survey complete",false);
                use("Expedition complete · Echo ally · Crawler escort",false);
                atlasSmoke();
            }
            result.putString("route","PASS "+stage);finish(Activity.RESULT_OK,result);
        }catch(Throwable t){result.putString("route","FAIL "+t);finish(Activity.RESULT_CANCELED,result);}
    }
}

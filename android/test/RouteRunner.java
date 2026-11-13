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
import android.net.Uri;

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
    /** Exercise the Android dispatch path, not just the Activity callback.
     * A focused WebView must not consume raw joystick navigation first. */
    private void gamepadAxisViaDispatch(float axisX,float axisY){
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
                boolean handled=screen.dispatchGenericMotionEvent(e);
                e.recycle();
                if(!handled)throw new AssertionError("Physical joystick dispatch was not handled");
            }catch(Throwable failure){error.set(failure);}
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
    /** Installed WebView scene uses the opt-in profile, not diagnostic texture IDs.
     * CI profile contains only synthetic pixels and runs after baseline tests. */
    private void checkUnifiedOwnerArtProfile() throws Exception {
        Intent launch=new Intent();
        launch.setClassName("dev.bearframe.ridge","dev.bearframe.ridge.UnifiedEngineActivity");
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        screen=startActivitySync(launch);
        JSONObject before=unifiedSnapshot();
        // The same installed owner-art route must also prove that the
        // authored JSON project replaced the synthetic v2 default and
        // selected a distinct durable project namespace.
        String authored=evalHost("(function(){return JSON.stringify({id:" +
            "BearframeHost.partyWorld.snapshot().project});})()");
        JSONObject content=new JSONObject((String)new JSONTokener(authored).nextValue());
        if(!"ci-external-content".equals(content.getString("id")))
            throw new AssertionError("External content project not booted: "+content);
        if(!before.optBoolean("ownerArtActive") || before.getInt("assetsLoaded")!=1 ||
           before.getInt("sequence")!=before.getInt("savedRevision"))
            throw new AssertionError("Opt-in owner art scene did not load: "+before);
        String pixelProof=evalHost("(function(){" +
            "var scene=BearframeHost.partyWorld.compose({width:224,height:160,tick:0});" +
            "var ids=Array.from(new Set(scene.commands.filter(function(c){" +
              "return c.type==='sprite';}).map(function(c){return c.imageId;})));" +
            "var canvas=document.getElementById('party-world-surface');" +
            "var data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;" +
            "var nonClear=0;for(var i=0;i<data.length;i+=4){" +
              "if(data[i]!==16||data[i+1]!==16||data[i+2]!==24)nonClear++;}" +
            "return JSON.stringify({images:ids,painted:nonClear});})()");
        JSONObject proof=new JSONObject((String)new JSONTokener(pixelProof).nextValue());
        JSONArray ids=proof.getJSONArray("images");
        if(ids.length()!=1 || !"test".equals(ids.getString(0)) || proof.getInt("painted")<32)
            throw new AssertionError("Canvas did not draw owner-role texture pixels: "+proof);
        // Move DOWN into an empty passable tile: moving RIGHT instead starts the
        // supply dialogue without relocating the player, so its unchanged
        // pixels are correct event behavior and cannot prove locomotion.
        // Installed WebView must select real directional source rectangles, not
        // merely report one decoded image. Use synthetic CI atlas halves with
        // different pixels and preserve the exact party-world save revision.
        String visual=evalHost("(function(){" +
            "var host=BearframeHost.partyWorld;" +
            "var pose=function(dir,moving,tick){" +
              "var s=host.compose({width:224,height:160,tick:tick," +
                "playerDirection:dir,playerMoving:moving});" +
              "return s.commands.find(function(c){return c.actor==='player';});};" +
            "var idle=pose('left',false,0),step=pose('left',true,0)," +
              "next=pose('left',true,2),up=pose('up',false,0);" +
            "var cv=document.getElementById('party-world-surface');" +
            "var original=new Uint8Array(cv.getContext('2d').getImageData(" +
              "0,0,cv.width,cv.height).data);" +
            "var revision=host.view().sequence;" +
            "var accepted=BearframeHost.input({type:'navigate',direction:'down'});" +
            "var repainted=BearframeHost.renderVisualTickForAudit(0);" +
            "var latest=cv.getContext('2d').getImageData(" +
              "0,0,cv.width,cv.height).data,changed=0;" +
            "for(var i=0;i<latest.length;i+=4){" +
              "if(original[i]!==latest[i]||original[i+1]!==latest[i+1]||" +
                 "original[i+2]!==latest[i+2]||original[i+3]!==latest[i+3])changed++;}" +
            "return JSON.stringify({idle:idle.source.x,step:step.source.x," +
              "next:next.source.x,up:up.source.x,img:step.imageId," +
              "accepted:accepted,repainted:repainted,from:revision,to:host.view().sequence," +
              "facing:host.facing(),atX:host.view().x,atY:host.view().y," +
              "saved:host.verifySave().ok,changed:changed," +
              "status:document.getElementById('party-world-status').textContent});})()");
        JSONObject movement=new JSONObject((String)new JSONTokener(visual).nextValue());
        if(movement.getInt("idle")!=32||movement.getInt("step")!=0||
           movement.getInt("next")!=32||movement.getInt("up")!=32||
           !"test".equals(movement.getString("img"))||
           !movement.getBoolean("accepted")||
           !movement.getJSONObject("repainted").getBoolean("ok")||
           movement.getInt("to")!=movement.getInt("from")+1||
           !"down".equals(movement.getString("facing"))||
           movement.getInt("atX")!=1||movement.getInt("atY")!=2||
           !movement.getBoolean("saved")||movement.getInt("changed")<16)
            throw new AssertionError("Installed directional movement/animation wrong: "+movement);
        int partyRevision=movement.getInt("to");
        runOnMainSync(()->screen.onTrimMemory(android.content.ComponentCallbacks2.TRIM_MEMORY_COMPLETE));
        boolean recovered=false;
        for(int attempt=0;attempt<50;attempt++){
            JSONObject snap=new JSONObject((String)new JSONTokener(
                evalHost("BearframeHost.snapshotJson()")).nextValue());
            if(snap.getInt("sequence")!=before.getInt("sequence")||
               snap.getInt("savedRevision")!=before.getInt("savedRevision"))
                throw new AssertionError("Owner art recovery changed journal: "+snap);
            if(snap.getInt("recoveryCount")>0 && !snap.getBoolean("restoring") &&
               snap.getInt("assetsLoaded")==1){recovered=true;break;}
            Thread.sleep(200);
        }
        if(!recovered)throw new AssertionError("Owner art rehydration failed");
        // Memory rehydration must leave the independently durable v2 scene
        // at the exact new revision committed by the controller move.
        String afterParty=evalHost("(function(){" +
            "var h=BearframeHost.partyWorld;" +
            "return JSON.stringify({sequence:h.view().sequence," +
              "saved:h.verifySave().ok});})()");
        JSONObject rehydrated=new JSONObject((String)new JSONTokener(afterParty).nextValue());
        if(rehydrated.getInt("sequence")!=partyRevision||
           !rehydrated.getBoolean("saved"))
            throw new AssertionError("Directional scene recovery altered save: "+rehydrated);

        resultMeta.putString("ownerArt",
            "PASS installed owner-role scene pixels, eviction, reload and unchanged save");
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
    /** Real installed WebView diagnostic exercises v2 party turns and journal
     * through touch-button event listeners and preserves the existing v1
     * diagnostic save revision in its separate namespace. */
    private void checkUnifiedParty(boolean second) throws Exception {
        Intent launch=new Intent();
        launch.setClassName("dev.bearframe.ridge","dev.bearframe.ridge.UnifiedEngineActivity");
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        screen=startActivitySync(launch);
        JSONObject baseline=unifiedSnapshot();
        if(baseline.getInt("savedRevision")!=0 ||
           baseline.getInt("sequence")!=0)
            throw new AssertionError("Party test disturbed baseline engine save: "+baseline);
        String raw=evalHost("JSON.stringify(BearframeHost.party.snapshot())");
        JSONObject initial=new JSONObject((String)new JSONTokener(raw).nextValue());
        if(!initial.getBoolean("ready")||initial.getInt("engineVersion")!=2||
           initial.getInt("sequence")!=(second?7:0) ||
           initial.getInt("savedRevision")!=(second?7:0))
            throw new AssertionError("Party journal failed initial restore: "+initial);
        if(!second){
            evalHost("document.getElementById('party-start').click()");
            String begin=evalHost("JSON.stringify(BearframeHost.party.snapshot())");
            JSONObject started=new JSONObject((String)new JSONTokener(begin).nextValue());
            if(!"active".equals(started.getString("phase"))||
               started.getInt("sequence")!=6||started.getInt("partyCount")!=1||
               started.getInt("savedRevision")!=6)
                throw new AssertionError("Party encounter not durably started: "+started);
        }else{
            if(!"active".equals(initial.getString("phase"))||
               initial.getInt("targetHp")>=48)
                throw new AssertionError("Party encounter did not survive process death: "+initial);
        }
        evalHost("document.getElementById('party-round').click()");
        String next=evalHost("JSON.stringify(BearframeHost.party.snapshot())");
        JSONObject advanced=new JSONObject((String)new JSONTokener(next).nextValue());
        int expected=second?8:7;
        if(!"active".equals(advanced.getString("phase"))||
           advanced.getInt("sequence")!=expected||
           advanced.getInt("savedRevision")!=expected ||
           advanced.getInt("targetHp")>=48 ||
           advanced.getInt("validSlots")!=2)
            throw new AssertionError("Installed party turn not durably committed: "+advanced);
        String label=evalHost("document.getElementById('party-status').textContent");
        if(label==null||label.indexOf("Battle active")<0)
            throw new AssertionError("Party diagnostic screen did not present battle state");
        JSONObject after=unifiedSnapshot();
        if(after.getInt("savedRevision")!=0||after.getInt("sequence")!=0)
            throw new AssertionError("Party session crossed the base engine journal");
        resultMeta.putString("party","PASS v2 party turn, UI and durable revision "+expected);
    }
    /** Inspect installed skill/target selection UI and a real multi-command
     * round through the same durable portable v2 engine session. */
    /** In-installed-WebView v2 integration: normal item/equipment rules, active
     * encounter and durable party resources share ONE native v2 journal. */
    /** Installed Android WebView content-version isolation and two-process
     * persistence. A changed project may never read or overwrite old saves. */
    /** A real installed WebView drives v2 party inventory DOM controls into
     * native durable storage, verifies physical gear reservations, then
     * restarts and continues without changing the original Rhino save. */
    /** Opt-in level 2 progression via the actual offline Android WebView and
     * native journal. Separate test data does not change saved v1/v2 games. */
    private void checkUnifiedProgression(boolean restart) throws Exception {
        Intent launch=new Intent();
        launch.setClassName("dev.bearframe.ridge","dev.bearframe.ridge.UnifiedEngineActivity");
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        screen=startActivitySync(launch);
        unifiedSnapshot();
        String result=evalHost("(function(){try{" +
            "var p=JSON.parse(JSON.stringify(FRAMEWORK_PARTY_FIXTURE));" +
            "p.contentRevision='leveling_1';" +
            "p.partyCombat.skills.focus={kind:'damage',power:16,cost:1,element:'physical'};" +
            "p.partyCombat.progression={thresholds:[0,10,30],growth:{" +
            "pilot:{hp:4,mp:1,attack:2,defense:1,speed:0}," +
            "scout:{hp:3,mp:1,attack:1,defense:1,speed:1}}," +
            "unlocks:{pilot:{2:['focus']},scout:{2:['pulse']}}};" +
            "p.events.supply.choices[0].effects.push({type:'recruit',ally:'scout'});" +
            "var store={read:function(k){return BearframeNative.read(k)}," +
            "write:function(k,v){return BearframeNative.write(k,v)}};" +
            "var s=createBearframeSession(p,store,null," +
            "{slotPrefix:'bf:framework-party-test:v2:leveling'});" +
            "var launched="+(restart?"s.resume()":"s.start('Leveler',23)")+";" +
            "if(!launched.ok)return JSON.stringify({error:launched.reason});" +
            "if(!"+(restart?"true":"false")+"){" +
            "var moves=[{type:'move',dir:'right'},{type:'choose',id:'collect'}," +
            "{type:'equip',item:'blade'},{type:'move',dir:'right'}," +
            "{type:'move',dir:'right'}];" +
            "for(var i=0;i<moves.length;i++){" +
            "var out=s.dispatch(moves[i]);if(!out.ok)return JSON.stringify({error:out.reason,step:i});}" +
            "var limit=0;" +
            "while(s.snapshot().view.partyBattle&&limit++<10){" +
            "var done=s.dispatch({type:'party-round',orders:[" +
            "{actor:'pilot',skill:'strike',target:'crawler'}," +
            "{actor:'scout',skill:'strike',target:'crawler'}]});" +
            "if(!done.ok)return JSON.stringify({error:done.reason,step:'battle'});" +
            "}" +
            "if(s.snapshot().view.partyBattle)return JSON.stringify({error:'battle not finished'});" +
            "}else{" +
            "var walked=s.dispatch({type:'move',dir:'down'});" +
            "if(!walked.ok)return JSON.stringify({error:walked.reason,step:'resume move'});" +
            "}" +
            "var v=s.snapshot().view;" +
            "var eventRoot=document.createElement('div'),gear=document.createElement('div');" +
            "var status=document.createElement('p');" +
            "var panel=createBearframeRuntimePanels(eventRoot,gear,status,p," +
            "function(){return s.snapshot().view},function(cmd){return s.dispatch(cmd)});" +
            "panel.render();" +
            "return JSON.stringify({progress:v.partyProgression," +
            "xp:v.xp,maxHp:v.maxHp,charge:v.maxCharge," +
            "leadSkills:v.partyActors[0].skills,allySkills:v.partyActors[1].skills," +
            "weapon:v.partyGear.pilot.weapon,display:gear.textContent," +
            "valid:s.verifySave(),sequence:v.sequence});" +
            "}catch(error){return JSON.stringify({error:String(error),stack:String(error.stack||'')})}})()");
        JSONObject proof=new JSONObject((String)new JSONTokener(result).nextValue());
        if(proof.has("error"))throw new AssertionError("Installed progression failed "+result);
        JSONObject progress=proof.getJSONObject("progress");
        JSONObject pilot=progress.getJSONObject("pilot"),scout=progress.getJSONObject("scout");
        if(pilot.getInt("level")!=2||scout.getInt("level")!=2||
           pilot.getInt("xp")!=10||scout.getInt("xp")!=10||
           proof.getInt("maxHp")!=34||proof.getInt("charge")!=4||
           !"blade".equals(proof.getString("weapon"))||
           !proof.getJSONArray("leadSkills").toString().contains("focus")||
           !proof.getJSONArray("allySkills").toString().contains("pulse")||
           !proof.getString("display").contains("Level 2")||
           !proof.getJSONObject("valid").getBoolean("ok")||
           proof.getInt("sequence")<(restart?8:7))
            throw new AssertionError("Level growth/skill save did not survive Android "+result);
        resultMeta.putString("leveling",
            "PASS opt-in XP, ally skills, level growth, save and force-stop recovery");
    }
    /** Exercise the visible integrated v2 world: real DOM buttons, one
     * native journal, battle UI, progression, and two-process restart. */
    /** Assert the installed Android 35 WebView actually renders v2 map pixels,
     * follows the canonical saved position, and resumes its scene on restart. */
    /** Native renderer-memory eviction must preserve BOTH v2 world progress
     * and visible decoded pixels. After rehydration, real touch works again. */
    /** Synthetic complete route: event/inventory -> battle -> field exit ->
     * recruited second actor -> per-actor gear -> durable Android restart. */
    private void checkUnifiedPartyWorldRecruitment(boolean restart) throws Exception {
        Intent launch=new Intent();
        launch.setClassName("dev.bearframe.ridge","dev.bearframe.ridge.UnifiedEngineActivity");
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        screen=startActivitySync(launch);
        unifiedSnapshot();
        String result=evalHost("(function(){try{" +
            "var h=BearframeHost.partyWorld;" +
            "function tap(sel){var b=document.querySelector(sel);" +
            "if(!b||b.disabled)throw new Error('Missing or blocked '+sel);b.click();}" +
            "if(!"+(restart?"true":"false")+"){" +
            "tap('[data-party-world-dir=right]');" +
            "tap('#party-world-events [data-event-choice=collect]');" +
            "tap('[data-party-world-dir=right]');" +
            "tap('[data-party-world-dir=right]');" +
            "var rounds=0;while(h.battle()&&rounds++<10)tap('#party-world-battle #party-commit');" +
            "if(h.battle())throw new Error('Party encounter not resolved');" +
            // The encounter begins on tile 3,1, so three additional right
            // interactions reach the field scout event (the fourth is blocked).
            "tap('[data-party-world-dir=right]');" +
            "tap('[data-party-world-dir=right]');" +
            "tap('[data-party-world-dir=right]');" +
            "tap('#party-world-events [data-event-choice=recruit]');" +
            "var buttons=document.querySelectorAll('#party-world-inventory [data-inventory-equip=blade]');" +
            "var found=null;for(var i=0;i<buttons.length;i++){" +
            "if(buttons[i].textContent.indexOf('Test scout')>=0)found=buttons[i];}" +
            "if(!found||found.disabled)throw new Error('Scout gear selector unavailable');" +
            "found.click();" +
            "}else{" +
            "tap('#party-world-inventory [data-inventory-unequip=\"scout:weapon\"]');" +
            "var buttons=document.querySelectorAll('#party-world-inventory [data-inventory-equip=blade]');" +
            "var found=null;for(var i=0;i<buttons.length;i++){" +
            "if(buttons[i].textContent.indexOf('World integration test')>=0)found=buttons[i];}" +
            "if(!found||found.disabled)throw new Error('Lead gear selector unavailable');" +
            "found.click();" +
            "}" +
            "var v=h.view();" +
            "return JSON.stringify({map:v.map,x:v.x,y:v.y,party:v.partyActors.length," +
            "leadLevel:v.partyProgression.pilot.level,scoutLevel:v.partyProgression.scout.level," +
            "quest:v.quests.survey,gear:v.partyGear,items:v.inventory," +
            "scoutAttack:v.partyActors[1].attack,verified:h.verifySave(),seq:v.sequence});" +
            "}catch(e){return JSON.stringify({error:String(e),stack:String(e.stack||'')})}})()");
        JSONObject proof=new JSONObject((String)new JSONTokener(result).nextValue());
        if(proof.has("error"))
            throw new AssertionError("Installed v2 recruitment route failed: "+result);
        JSONObject gear=proof.getJSONObject("gear");
        JSONObject pilot=gear.getJSONObject("pilot"),scout=gear.getJSONObject("scout");
        if(!"field".equals(proof.getString("map"))||proof.getInt("x")!=1||
           proof.getInt("y")!=1||proof.getInt("party")!=2||
           proof.getInt("leadLevel")!=2||proof.getInt("scoutLevel")!=1||
           proof.getInt("quest")!=2||
           !proof.getJSONObject("verified").getBoolean("ok")||
           proof.getJSONObject("items").getInt("blade")!=1||
           !(restart?"blade".equals(pilot.getString("weapon")):
             "blade".equals(scout.getString("weapon")))||
           !(restart?scout.isNull("weapon"):pilot.isNull("weapon"))||
           proof.getInt("scoutAttack")!=(restart?6:10))
            throw new AssertionError("Recruited party or shared gear lost: "+result);
        resultMeta.putString("partyRecruitment",
            "PASS synthetic recruitment, party XP, real gear UI and native restart");
    }
    private void checkUnifiedPartyWorldMemory() throws Exception {
        Intent launch=new Intent();
        launch.setClassName("dev.bearframe.ridge","dev.bearframe.ridge.UnifiedEngineActivity");
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        screen=startActivitySync(launch);
        JSONObject baseline=unifiedSnapshot();
        String worldReply=evalHost("JSON.stringify(BearframeHost.partyWorld.view())");
        JSONObject worldBefore=new JSONObject((String)new JSONTokener(worldReply).nextValue());
        if(worldBefore.getInt("sequence")!=0||worldBefore.getInt("x")!=1||
           worldBefore.getInt("y")!=1||baseline.getInt("assetsLoaded")!=2)
            throw new AssertionError("V2 memory test started with wrong state: "+worldBefore);
        String hashScript="(function(){var c=document.getElementById('party-world-surface');"+
            "var data=c.getContext('2d').getImageData(0,0,c.width,c.height).data;"+
            "var n=2166136261;for(var i=0;i<data.length;i+=4){"+
            "n=Math.imul(n^data[i],16777619)>>>0;"+
            "n=Math.imul(n^data[i+1],16777619)>>>0;"+
            "n=Math.imul(n^data[i+2],16777619)>>>0;}return n;})()";
        // WebView returns JS unsigned 32-bit hashes as JSON numbers, sometimes
        // with a trailing .0; parse as finite numeric values, not long literals.
        String frozen=evalHost("JSON.stringify(BearframeHost.renderVisualTickForAudit(0))");
        JSONObject freeze=new JSONObject((String)new JSONTokener(frozen).nextValue());
        if(!freeze.getBoolean("ok")||freeze.getInt("revision")!=0)
            throw new AssertionError("Unable to freeze pre-trim visual tick: "+frozen);
        long original=(long)Double.parseDouble(evalHost(hashScript));
        AtomicReference<Throwable> failure=new AtomicReference<>();
        runOnMainSync(()->{
            try{screen.onTrimMemory(android.content.ComponentCallbacks2.TRIM_MEMORY_COMPLETE);}
            catch(Throwable error){failure.set(error);}
        });
        if(failure.get()!=null)throw new AssertionError(failure.get());
        boolean restored=false;
        for(int i=0;i<50;i++){
            JSONObject main=new JSONObject((String)new JSONTokener(
                evalHost("BearframeHost.snapshotJson()")).nextValue());
            JSONObject world=new JSONObject((String)new JSONTokener(
                evalHost("JSON.stringify(BearframeHost.partyWorld.view())")).nextValue());
            if(main.getInt("sequence")!=baseline.getInt("sequence")||
               main.getInt("savedRevision")!=baseline.getInt("savedRevision")||
               world.getInt("sequence")!=0||world.getInt("x")!=1||
               world.getInt("y")!=1)
                throw new AssertionError("Memory trim mutated saved engine state");
            if(main.getInt("trimCount")>0&&main.getInt("recoveryCount")>0&&
               !main.getBoolean("restoring")&&main.getInt("assetsLoaded")==2){
                restored=true;break;
            }
            Thread.sleep(200);
        }
        if(!restored)throw new AssertionError("V2 atlases did not rehydrate");
        // The live world clock keeps running while standing still. Repaint
        // the restored real canvas at the exact pre-trim tick before hashing.
        String restoredPaint=evalHost(
            "JSON.stringify(BearframeHost.renderVisualTickForAudit(0))");
        JSONObject restoredTick=new JSONObject(
            (String)new JSONTokener(restoredPaint).nextValue());
        if(!restoredTick.getBoolean("ok")||restoredTick.getInt("revision")!=0)
            throw new AssertionError("Rehydrated scene cannot repaint same tick: "+restoredPaint);
        long rehydrated=(long)Double.parseDouble(evalHost(hashScript));
        if(rehydrated!=original)
            throw new AssertionError("Rehydrated v2 canvas pixels differ");
        if(!"true".equals(evalHost("BearframeHost.presentationClock.start()")))
            throw new AssertionError("Live world presentation clock did not restart");
        if(!"false".equals(evalHost(
            "document.querySelector('[data-party-world-dir=down]').disabled")))
            throw new AssertionError("V2 movement remained disabled after atlas recovery");
        evalHost("document.querySelector('[data-party-world-dir=down]').click()");
        String advanced=evalHost("JSON.stringify(BearframeHost.partyWorld.view())");
        JSONObject next=new JSONObject((String)new JSONTokener(advanced).nextValue());
        String valid=evalHost("JSON.stringify(BearframeHost.partyWorld.verifySave())");
        JSONObject verified=new JSONObject((String)new JSONTokener(valid).nextValue());
        if(next.getInt("sequence")!=1||next.getInt("y")!=2||
           !verified.getBoolean("ok")||verified.getInt("revision")!=1||
           (long)Double.parseDouble(evalHost(hashScript))==rehydrated)
            throw new AssertionError("Restored v2 scene did not advance/save");
        JSONObject mainAfter=unifiedSnapshot();
        if(mainAfter.getInt("sequence")!=baseline.getInt("sequence")||
           mainAfter.getInt("savedRevision")!=baseline.getInt("savedRevision"))
            throw new AssertionError("V2 memory recovery polluted v1 journal");
        resultMeta.putString("partyWorldMemory",
            "PASS native trim, v2 atlas pixel rehydration, input and isolated journal");
    }
    /** Installed WebView: responsive v2 screen tabs are presentational only,
     * preserve journal bytes, and return to real event controls on phase change. */
    /** Installed Android gamepad: native KeyEvent/Joystick -> semantic
     * WebView input -> same canonical v2 journal. Never modifies legacy v1. */
    /** Native gamepad ability/target control: no implicit default combat
     * round may execute from A until commit is explicitly focused. */
    private void checkUnifiedV2BattleController() throws Exception {
        Intent launch=new Intent();
        launch.setClassName("dev.bearframe.ridge","dev.bearframe.ridge.UnifiedEngineActivity");
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        screen=startActivitySync(launch);
        unifiedSnapshot();
        gamepadKey(KeyEvent.KEYCODE_DPAD_RIGHT);
        gamepadKey(KeyEvent.KEYCODE_BUTTON_A);
        gamepadKey(KeyEvent.KEYCODE_DPAD_RIGHT);
        gamepadKey(KeyEvent.KEYCODE_DPAD_RIGHT);
        String start=evalHost("JSON.stringify(BearframeHost.partyWorld.view())");
        JSONObject before=new JSONObject((String)new JSONTokener(start).nextValue());
        if(before.getInt("sequence")!=4||before.isNull("partyBattle"))
            throw new AssertionError("Native battle controller failed to start party encounter: "+start);
        String initial=evalHost("(function(){var n=document.activeElement;"+
            "return JSON.stringify({attribute:n&&n.getAttribute('data-party-skill'),"+
            "value:n&&n.value,commit:document.getElementById('party-commit')!==null})})()");
        JSONObject init=new JSONObject((String)new JSONTokener(initial).nextValue());
        if(!"pilot".equals(init.getString("attribute"))||
           !"strike".equals(init.getString("value"))||
           !init.getBoolean("commit"))
            throw new AssertionError("Party skill not focusable by native gamepad: "+initial);
        gamepadKey(KeyEvent.KEYCODE_DPAD_RIGHT);
        if(!"\"pulse\"".equals(evalHost(
           "document.querySelector('#party-world-battle [data-party-skill]').value")))
            throw new AssertionError("Native right press did not select alternate skill");
        gamepadKey(KeyEvent.KEYCODE_DPAD_DOWN);
        String target=evalHost("document.activeElement.getAttribute('data-party-target')");
        if(!"\"pilot\"".equals(target))
            throw new AssertionError("Native down press did not focus target: "+target);
        gamepadKey(KeyEvent.KEYCODE_BUTTON_A);
        String focused=evalHost("document.activeElement&&document.activeElement.id");
        if(!"\"party-commit\"".equals(focused))
            throw new AssertionError("A must focus commit, not submit hidden round: "+focused);
        if(!"4".equals(evalHost("BearframeHost.partyWorld.view().sequence")))
            throw new AssertionError("Selecting ability/target committed combat early");
        gamepadKey(KeyEvent.KEYCODE_BUTTON_A);
        String result=evalHost("JSON.stringify(BearframeHost.partyWorld.view())");
        JSONObject after=new JSONObject((String)new JSONTokener(result).nextValue());
        JSONObject saved=new JSONObject((String)new JSONTokener(evalHost(
            "JSON.stringify(BearframeHost.partyWorld.verifySave())")).nextValue());
        if(after.getInt("sequence")!=5||
           after.getInt("charge")!=2||
           !saved.getBoolean("ok")||saved.getInt("revision")!=5)
            throw new AssertionError("Native controller combat order not saved: "+result);
        resultMeta.putString("v2BattleController",
            "PASS native battle ability, target, explicit commit and durable round");
    }
    private void checkUnifiedControllerWorld(boolean restart) throws Exception {
        Intent launch=new Intent();
        launch.setClassName("dev.bearframe.ridge","dev.bearframe.ridge.UnifiedEngineActivity");
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        screen=startActivitySync(launch);
        JSONObject legacy=unifiedSnapshot();
        String baseline=evalHost("JSON.stringify({v:BearframeHost.partyWorld.view(),"+
            "screen:BearframeHost.partyWorldScreens.current()})");
        JSONObject before=new JSONObject((String)new JSONTokener(baseline).nextValue());
        if(!"world".equals(before.getString("screen"))||
           before.getJSONObject("v").getInt("sequence")!=(restart?2:0)||
           legacy.getInt("sequence")!=0)
            throw new AssertionError("Native controller world not isolated: "+baseline);
        if(!restart){
            gamepadKey(KeyEvent.KEYCODE_DPAD_RIGHT);
            JSONObject event=new JSONObject((String)new JSONTokener(
                evalHost("JSON.stringify(BearframeHost.partyWorld.view())")).nextValue());
            if(event.getInt("sequence")!=1||event.isNull("prompt"))
                throw new AssertionError("Physical D-pad event did not open: "+event);
            gamepadKey(KeyEvent.KEYCODE_BUTTON_A);
            JSONObject chosen=new JSONObject((String)new JSONTokener(
                evalHost("JSON.stringify(BearframeHost.partyWorld.view())")).nextValue());
            // Adjacent event interaction does not enter the event's tile.
            if(chosen.getInt("sequence")!=2||!chosen.isNull("prompt")||
               chosen.getInt("x")!=1||chosen.getInt("y")!=1)
                throw new AssertionError("Controller confirm did not commit event: "+chosen);
            gamepadKey(KeyEvent.KEYCODE_BUTTON_X);
            if(!"true".equals(evalHost("BearframeHost.jrpgMenu.isOpen()")))
                throw new AssertionError("Controller menu did not open JRPG commands");
            gamepadKey(KeyEvent.KEYCODE_BUTTON_R1);
            if(!"true".equals(evalHost(
                "document.querySelector('[data-jrpg-command=techniques]').getAttribute('data-jrpg-selected')==='true'")))
                throw new AssertionError("Shoulder did not select next JRPG command");
            gamepadKey(KeyEvent.KEYCODE_BUTTON_B);
            if(!"false".equals(evalHost("BearframeHost.jrpgMenu.isOpen()"))||
               !"\"world\"".equals(evalHost("BearframeHost.partyWorldScreens.current()")))
                throw new AssertionError("Controller cancel did not return to World");
        }else{
            gamepadKey(KeyEvent.KEYCODE_BUTTON_L1);
            if(!"true".equals(evalHost("BearframeHost.jrpgMenu.isOpen()"))||
               !"true".equals(evalHost(
                   "document.querySelector('[data-jrpg-command=options]').getAttribute('data-jrpg-selected')==='true'")))
                throw new AssertionError("Left shoulder did not wrap to Options menu");
            gamepadKey(KeyEvent.KEYCODE_BUTTON_B);
            gamepadKey(KeyEvent.KEYCODE_DPAD_DOWN);
            JSONObject walked=new JSONObject((String)new JSONTokener(
                evalHost("JSON.stringify(BearframeHost.partyWorld.view())")).nextValue());
            if(walked.getInt("sequence")!=3||walked.getInt("x")!=1||
               walked.getInt("y")!=2)
                throw new AssertionError("Controller could not move after restart: "+walked);
            gamepadAxisViaDispatch(0f,-0.9f);
            gamepadAxisViaDispatch(0f,0f);
            JSONObject analog=new JSONObject((String)new JSONTokener(
                evalHost("JSON.stringify(BearframeHost.partyWorld.view())")).nextValue());
            if(analog.getInt("sequence")!=4||analog.getInt("x")!=1||
               analog.getInt("y")!=1)
                throw new AssertionError("Native analog movement did not commit: "+analog);
        }
        JSONObject now=new JSONObject((String)new JSONTokener(
            evalHost("JSON.stringify(BearframeHost.partyWorld.view())")).nextValue());
        JSONObject saved=new JSONObject((String)new JSONTokener(
            evalHost("JSON.stringify(BearframeHost.partyWorld.verifySave())")).nextValue());
        JSONObject original=unifiedSnapshot();
        if(now.getInt("sequence")!=(restart?4:2)||
           !saved.getBoolean("ok")||saved.getInt("revision")!=(restart?4:2)||
           original.getInt("sequence")!=0||original.getInt("savedRevision")!=0)
            throw new AssertionError("Native gamepad corrupted engine journals: "+now);
        resultMeta.putString("v2Controller",
            "PASS native D-pad, A/B, menus, shoulders, analog and two-process journal");
    }
    /** Installed Android WebView acceptance for the actual JRPG command dialog.
     * Uses real UI buttons and the same durable world game session.
     */
    /** Installed Android WebView proof for opt-in fixed-point locomotion.
     * Uses a synthetic isolated project and native durable journal, leaving
     * the actual player's grid save namespace completely untouched.
     */
    private void checkUnifiedFreeMovement() throws Exception {
        Intent launch=new Intent();
        launch.setClassName("dev.bearframe.ridge","dev.bearframe.ridge.UnifiedEngineActivity");
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        screen=startActivitySync(launch);
        unifiedSnapshot();
        String raw=evalHost("(function(){try{" +
            "var p=JSON.parse(JSON.stringify(FRAMEWORK_PARTY_WORLD_FIXTURE));" +
            "p.id='free_android_probe';p.contentRevision='free_android_1';" +
            "p.movement={mode:'free',directions:8,speed:32,radius:48};" +
            "var t={tileSize:32,clearColor:'#101018',atlases:{" +
              "terrain:{width:64,height:32},characters:{width:64,height:48}}," +
              "tiles:{floor:{atlas:'terrain',x:0,y:0,w:32,h:32}," +
              "wall:{atlas:'terrain',x:32,y:0,w:32,h:32}}," +
              "sprites:{player:{ticksPerFrame:1,frames:[" +
              "{atlas:'characters',x:0,y:0,w:32,h:48}]}}};" +
            "var storage={read:function(k){return BearframeNative.read(k);}," +
              "write:function(k,v){return BearframeNative.write(k,v)===true;}};" +
            "var settings={slotPrefix:'bf:free_android_probe:v2:runtime'};" +
            "var a=createBearframeSession(p,storage,t,settings);" +
            "if(!a.start('Free',3).ok)throw Error('Cannot start free session');" +
            "var first=a.snapshot().view;" +
            "var frameA=a.compose({width:96,height:96,tick:0});" +
            "if(!a.dispatch({type:'move',dir:'right'}).ok)" +
              "throw Error('Subtile motion refused');" +
            "var second=a.snapshot().view;" +
            "if(second.x!==first.x||second.y!==first.y||" +
              "second.freePosition.x<=first.freePosition.x)" +
              "throw Error('World still moves tile-by-tile');" +
            "var frameB=a.compose({width:96,height:96,tick:0});" +
            "if(frameB.camera.x<=frameA.camera.x)" +
              "throw Error('Camera did not track sub-tile movement');" +
            "if(!a.dispatch({type:'move',dir:'up-right'}).ok)" +
              "throw Error('Diagonal motion refused');" +
            "var view=a.snapshot().view;" +
            "if(view.freePosition.y>=second.freePosition.y||" +
              "view.freePosition.x<=second.freePosition.x)" +
              "throw Error('Diagonal vector not applied');" +
            "if(!a.verifySave().ok)throw Error('Persistent position unverified');" +
            "var reboot=createBearframeSession(p,storage,t,settings);" +
            "if(!reboot.resume().ok||!reboot.verifySave().ok)" +
              "throw Error('Native journal restart refused');" +
            "var recovered=reboot.snapshot().view;" +
            "if(recovered.sequence!==view.sequence||" +
              "JSON.stringify(recovered.freePosition)!==" +
              "JSON.stringify(view.freePosition))" +
              "throw Error('Subtile save lost on restart');" +
            "var cardinal=JSON.parse(JSON.stringify(p));" +
            "cardinal.id='cardinal_android_probe';" +
            "cardinal.contentRevision='cardinal_android_1';" +
            "cardinal.movement.directions=4;" +
            "var opts4={slotPrefix:'bf:cardinal_android_probe:v2:runtime'};" +
            "var four=createBearframeSession(cardinal,storage,t,opts4);" +
            "if(!four.start('Cardinal',7).ok)throw Error('Four-way session refused');" +
            "var v4=four.snapshot().view;" +
            "if(v4.movementDirections!==4||v4.movementMode!=='free')" +
              "throw Error('Four-way movement contract missing');" +
            "var illegal=four.dispatch({type:'move',dir:'down-right'});" +
            "if(illegal.ok||four.snapshot().view.sequence!==0)" +
              "throw Error('Diagonal mutated four-way durable journal');" +
            "if(!four.dispatch({type:'move',dir:'right'}).ok)" +
              "throw Error('Four-way sub-tile movement refused');" +
            "var moved4=four.snapshot().view;" +
            "if(moved4.x!==v4.x||moved4.y!==v4.y||" +
              "moved4.freePosition.x<=v4.freePosition.x||" +
              "moved4.freePosition.y!==v4.freePosition.y)" +
              "throw Error('Four-way cardinal vector inaccurate');" +
            "var fourHost=createBearframePartyWorldHost(" +
              "storage,cardinal,t,opts4);" +
            "if(fourHost.navigate('up-right').ok||" +
              "fourHost.facing()!=='down'||!fourHost.verifySave().ok)" +
              "throw Error('Four-way controller/facing accepted diagonal');" +
            "var fourReload=createBearframeSession(cardinal,storage,t,opts4);" +
            "if(!fourReload.resume().ok||!fourReload.verifySave().ok||" +
              "JSON.stringify(fourReload.snapshot().view.freePosition)!==" +
              "JSON.stringify(moved4.freePosition))" +
              "throw Error('Four-way native position lost on restart');" +
            "return JSON.stringify({ok:true,sequence:view.sequence," +
              "position:view.freePosition,cameraMove:frameB.camera.x-frameA.camera.x});" +
            "}catch(e){return JSON.stringify({error:String(e),stack:String(e.stack||'')})}})()");
        JSONObject proof=new JSONObject((String)new JSONTokener(raw).nextValue());
        if(proof.has("error"))
            throw new AssertionError("Installed free locomotion failed: "+proof);
        if(!proof.getBoolean("ok")||proof.getInt("sequence")!=2||
           proof.getInt("cameraMove")<=0)
            throw new AssertionError("Free locomotion incomplete: "+proof);
        resultMeta.putString("freeMovement",
            "PASS installed 4-way free movement, preserved 8-way test, camera and native save");
    }

    /** Installed Android native-journal persistence of options. Distinct
     * from all legacy, diagnostic, and real-world character-save namespaces.
     */
    private void checkUnifiedUiPreferences(boolean restart) throws Exception {
        Intent launch=new Intent();
        launch.setClassName("dev.bearframe.ridge","dev.bearframe.ridge.UnifiedEngineActivity");
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        screen=startActivitySync(launch);
        unifiedSnapshot();
        String response=evalHost("(function(){try{" +
            "var h=BearframeHost.partyWorld,p=BearframeHost.userSettings," +
              "m=BearframeHost.jrpgMenu,a=BearframeHost.gameAudio;" +
            "if(!h||!p||!m||!a)throw Error('Installed settings module missing');" +
            "var before=h.view().sequence;" +
            "if(!"+(restart?"true":"false")+"){" +
            "if(!m.open('options'))throw Error('Cannot open real Options menu');" +
            "function tap(label){" +
              "var b=Array.from(document.querySelectorAll(" +
                "'#jrpg-menu [data-jrpg-action]')).find(function(node){" +
                  "return node.textContent===label;});" +
              "if(!b||b.disabled||!b.getClientRects().length)" +
                "throw Error('Settings control not visible '+label);" +
              "b.click();}" +
            "tap('Hide touch D-pad');" +
            "tap('Reduce transition animations');" +
            "if(!document.body.classList.contains('jrpg-pad-hidden')||" +
              "!document.body.classList.contains('jrpg-reduced-motion'))" +
              "throw Error('Saved display controls not applied');" +
            "if(!p.set('muted',true).ok||!p.volume('music',45).ok)" +
              "throw Error('Independent audio preferences refused');" +
            "m.close();" +
            "}else{" +
            "var v=p.snapshot();" +
            "if(v.showPad||!v.reducedMotion||!v.muted||v.volumes.music!==45)" +
              "throw Error('Settings journal lost after force-stop');" +
            "if(!document.body.classList.contains('jrpg-pad-hidden')||" +
              "!document.body.classList.contains('jrpg-reduced-motion'))" +
              "throw Error('Settings CSS not restored on Activity restart');" +
            "var sound=a.status();" +
            "if(!sound.muted||sound.volumes.music!==45||sound.enabled)" +
              "throw Error('Audio pref restoration/autoplay contract failed');" +
            "}" +
            "var pview=p.snapshot();" +
            "if(pview.sequence!==4||h.view().sequence!==before||" +
              "!h.verifySave().ok)" +
              "throw Error('Settings modified game save or wrong prefs revision');" +
            "return JSON.stringify({ok:true,settingsRevision:pview.sequence," +
              "gameRevision:h.view().sequence,muted:pview.muted});" +
            "}catch(e){return JSON.stringify({error:String(e),stack:String(e.stack||'')})}})()");
        JSONObject proof=new JSONObject((String)new JSONTokener(response).nextValue());
        if(proof.has("error"))
            throw new AssertionError("Installed UI preferences failed: "+proof);
        if(!proof.getBoolean("ok")||proof.getInt("settingsRevision")!=4)
            throw new AssertionError("Incomplete UI preference acceptance: "+proof);
        resultMeta.putString("uiPreferences",
            "PASS isolated native preferences, options buttons, restart, no autoplay");
    }

    private void checkUnifiedJrpgMenu() throws Exception {
        Intent launch=new Intent();
        launch.setClassName("dev.bearframe.ridge","dev.bearframe.ridge.UnifiedEngineActivity");
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        screen=startActivitySync(launch);
        unifiedSnapshot();
        String raw=evalHost("(function(){try{" +
            "var h=BearframeHost.partyWorld,m=BearframeHost.jrpgMenu;" +
            "if(!h||!m)throw Error('JRPG menu missing');" +
            "var before=h.view().sequence;" +
            "var overlay=document.getElementById('jrpg-menu');" +
            "var tabs=document.getElementById('party-world-navigation');" +
            "if(!overlay.hidden)throw Error('Menu should start closed');" +
            "if(!BearframeHost.input({type:'menu'}))throw Error('Menu button not routed');" +
            "if(overlay.hidden||getComputedStyle(overlay).display==='none')" +
              "throw Error('JRPG dialog not visible');" +
            "if(getComputedStyle(tabs).opacity!=='0')" +
              "throw Error('Developer tabs still player visible');" +
            "if(!BearframeHost.input({type:'navigate',direction:'down'})||" +
              "!BearframeHost.input({type:'confirm'})||m.current()!=='techniques')" +
              "throw Error('Controller menu selection broken');" +
            "if(!BearframeHost.input({type:'cancel'})||m.current()!=='overview'||" +
              "!BearframeHost.input({type:'cancel'})||m.isOpen())" +
              "throw Error('Controller menu cancel broken');" +
            "if(h.view().sequence!==before)" +
              "throw Error('Menu navigation modified saved gameplay');" +
            "if(!h.navigate('right').ok||!h.view().prompt)" +
              "throw Error('Expected scripted event');" +
            "if(m.open())throw Error('Menu opened on top of event choices');" +
            "if(!h.dispatch({type:'choose',id:'collect'}).ok)" +
              "throw Error('Item collection refused');" +
            "if(!m.open('equipment'))throw Error('Equipment menu unavailable');" +
            "var buttons=Array.from(overlay.querySelectorAll('[data-jrpg-action]'));" +
            "var equip=buttons.find(function(b){return b.textContent==='Equip Training blade';});" +
            "if(!equip||equip.disabled||!equip.getClientRects().length)" +
              "throw Error('Real equipment action not visible');" +
            "equip.click();" +
            "var gear=h.view().partyGear.pilot.weapon;" +
            "var same=h.verifySave().ok&&h.view().sequence===before+3;" +
            "var audio=BearframeHost.gameAudio;" +
            "if(!audio||audio.status().available||audio.status().enabled)" +
              "throw Error('Default engine must be silent without an owned audio pack');" +
            "var options=overlay.querySelector('[data-jrpg-command=options]');" +
            "if(!options)throw Error('Game Options missing');options.click();" +
            "if(!overlay.textContent.includes('No licensed game soundtrack'))" +
              "throw Error('Audio availability not visible in Options');" +
            "if(h.view().sequence!==before+3)" +
              "throw Error('Audio Options unexpectedly modified RPG save');" +
            "m.close();" +
            "return JSON.stringify({gear:gear,saved:same,menuClosed:overlay.hidden," +
              "sequence:h.view().sequence,original:before});" +
            "}catch(e){return JSON.stringify({error:String(e),stack:String(e.stack||'')})}})()");
        JSONObject proof=new JSONObject((String)new JSONTokener(raw).nextValue());
        if(proof.has("error"))throw new AssertionError("Installed JRPG menu failed: "+proof);
        if(!"blade".equals(proof.getString("gear"))||
           !proof.getBoolean("saved")||!proof.getBoolean("menuClosed")||
           proof.getInt("sequence")!=proof.getInt("original")+3)
            throw new AssertionError("JRPG menu changed or failed journal: "+proof);
        resultMeta.putString("jrpgMenu",
            "PASS installed command menu, controller, gear, original autosave");
    }

    private void checkUnifiedPartyWorldScreens(boolean restart) throws Exception {
        Intent launch=new Intent();
        launch.setClassName("dev.bearframe.ridge","dev.bearframe.ridge.UnifiedEngineActivity");
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        screen=startActivitySync(launch);
        unifiedSnapshot();
        String result=evalHost("(function(){try{" +
            "var h=BearframeHost.partyWorld,nav=BearframeHost.partyWorldScreens;" +
            "if(!nav||!h)throw Error('Missing canonical screen bridge');" +
            "var start=h.view().sequence;" +
            "if(nav.current()!=='world')throw Error('Restart should open world screen');" +
            "var tabs=document.querySelectorAll('#party-world-navigation [role=tab]');" +
            "if(tabs.length!==3)throw Error('Incomplete screen navigation');" +
            "function press(screen){var t=document.querySelector('[data-party-world-tab='+screen+']');" +
            "if(!t)throw Error('Missing tab '+screen);t.click();return t;}" +
            "var party=press('party');" +
            "if(document.getElementById('pw-screen-party').hidden||" +
            "!document.getElementById('pw-screen-world').hidden||" +
            "party.getAttribute('aria-selected')!=='true')throw Error('Party screen not visible');" +
            "var key=new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true});" +
            "party.dispatchEvent(key);" +
            "if(nav.current()!=='save')throw Error('Keyboard screen navigation failed');" +
            "var save=document.getElementById('pw-screen-save');" +
            "if(save.hidden)throw Error('Save panel hidden');" +
            "document.getElementById('party-world-verify').click();" +
            "if(!document.getElementById('party-world-save-status').textContent.includes('Verified'))" +
            "throw Error('Save verification not visible');" +
            "var afterTabs=h.view().sequence;" +
            "if(!"+(restart?"true":"false")+"){" +
            "press('world');" +
            "document.querySelector('[data-party-world-dir=right]').click();" +
            "if(nav.current()!=='world'||" +
            "!document.activeElement.hasAttribute('data-event-choice'))" +
            "throw Error('Event action not surfaced automatically');" +
            "document.querySelector('#party-world-events [data-event-choice=collect]').click();" +
            "press('party');" +
            "var equip=document.querySelector('#party-world-inventory [data-inventory-equip=blade]');" +
            "if(!equip||equip.disabled||!equip.getClientRects().length)" +
            "throw Error('Inventory equip control not visible to touch');" +
            "equip.click();" +
            "}else{" +
            "press('party');" +
            "if(!document.getElementById('pw-screen-party').hidden===false)" +
            "throw Error('Party screen visibility lost after restart');" +
            "}" +
            "var v=h.view();" +
            "return JSON.stringify({initial:start,afterTabs:afterTabs,sequence:v.sequence," +
            "weapon:v.partyGear.pilot.weapon,selected:nav.current()," +
            "verified:h.verifySave(),tabs:tabs.length});" +
            "}catch(e){return JSON.stringify({error:String(e),stack:String(e.stack||'')})}})()");
        JSONObject proof=new JSONObject((String)new JSONTokener(result).nextValue());
        if(proof.has("error"))
            throw new AssertionError("Installed party screen navigation failed: "+result);
        if(proof.getInt("initial")!=(restart?3:0)||
           proof.getInt("afterTabs")!=proof.getInt("initial")||
           proof.getInt("sequence")!=3||
           proof.getInt("tabs")!=3||
           !"blade".equals(proof.getString("weapon"))||
           !"party".equals(proof.getString("selected"))||
           !proof.getJSONObject("verified").getBoolean("ok"))
            throw new AssertionError("Screen navigation altered durable state: "+result);
        resultMeta.putString("partyScreens",
            "PASS touch/keyboard screen navigation, event focus, journal and restart");
    }
    private void checkUnifiedPartyWorldCanvas(boolean restart) throws Exception {
        Intent launch=new Intent();
        launch.setClassName("dev.bearframe.ridge","dev.bearframe.ridge.UnifiedEngineActivity");
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        screen=startActivitySync(launch);
        unifiedSnapshot();
        String reply=evalHost("(function(){try{" +
            "var w=window.BearframeHost&&BearframeHost.partyWorld;" +
            "var c=document.getElementById('party-world-surface');" +
            "if(!w||!c)return JSON.stringify({error:'world canvas unavailable'});" +
            "function hash(){var data=c.getContext('2d').getImageData(0,0,c.width,c.height).data;" +
            "var n=2166136261;for(var i=0;i<data.length;i+=4){" +
            "n=Math.imul(n^data[i],16777619)>>>0;" +
            "n=Math.imul(n^data[i+1],16777619)>>>0;" +
            "n=Math.imul(n^data[i+2],16777619)>>>0;}return n;}" +
            "function actor(){var v=w.view(),frame=w.compose({width:c.width,height:c.height,tick:v.sequence%100});" +
            "var list=frame.commands.filter(function(cmd){return cmd.actor==='player'});" +
            "if(list.length!==1)throw new Error('missing world player sprite');" +
            "return list[0].world;}" +
            "var before=w.view(),start=hash(),oldActor=actor();" +
            "var button=document.querySelector('[data-party-world-dir="+(restart?"up":"down")+"]');" +
            "if(!button||button.disabled)throw new Error('rendered movement button disabled');" +
            "button.click();" +
            "var after=w.view(),end=hash(),newActor=actor();" +
            "return JSON.stringify({start:start,end:end,beforeX:before.x,beforeY:before.y," +
            "afterX:after.x,afterY:after.y,from:oldActor,to:newActor," +
            "beforeRev:before.sequence,afterRev:after.sequence,verified:w.verifySave()," +
            "canvasWidth:c.width,canvasHeight:c.height});" +
            "}catch(error){return JSON.stringify({error:String(error),stack:String(error.stack||'')})}})()");
        JSONObject proof=new JSONObject((String)new JSONTokener(reply).nextValue());
        if(proof.has("error"))
            throw new AssertionError("V2 rendered Android world failed: "+reply);
        JSONObject from=proof.getJSONObject("from"),to=proof.getJSONObject("to");
        if(proof.getInt("canvasWidth")!=224||proof.getInt("canvasHeight")!=160||
           proof.getLong("start")==proof.getLong("end")||
           proof.getInt("beforeX")!=1||proof.getInt("afterX")!=1||
           proof.getInt("beforeY")!=(restart?2:1)||
           proof.getInt("afterY")!=(restart?1:2)||
           from.getInt("y")!=(restart?2:1)||to.getInt("y")!=(restart?1:2)||
           proof.getInt("beforeRev")!=(restart?1:0)||
           proof.getInt("afterRev")!=(restart?2:1)||
           !proof.getJSONObject("verified").getBoolean("ok"))
            throw new AssertionError("V2 world renderer state/pixels not recoverable: "+reply);
        resultMeta.putString("partyWorldCanvas",
            "PASS offline v2 scene pixels, movement, native journal and process restart");
    }
    private void checkUnifiedPartyWorldUi(boolean restart) throws Exception {
        Intent launch=new Intent();
        launch.setClassName("dev.bearframe.ridge","dev.bearframe.ridge.UnifiedEngineActivity");
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        screen=startActivitySync(launch);
        unifiedSnapshot();
        String response=evalHost("(function(){try{" +
            "var h=window.BearframeHost&&BearframeHost.partyWorld;" +
            "if(!h)return JSON.stringify({error:'world host missing'});" +
            "function tap(sel){var b=document.querySelector(sel);" +
            "if(!b||b.disabled)throw new Error('Missing or disabled '+sel);b.click();}" +
            "if(!"+(restart?"true":"false")+"){" +
            "tap('[data-party-world-dir=\\\"right\\\"]');" +
            "tap('#party-world-events [data-event-choice=\\\"collect\\\"]');" +
            "tap('#party-world-inventory [data-inventory-equip=\\\"blade\\\"]');" +
            "tap('#party-world-inventory [data-inventory-equip=\\\"vest\\\"]');" +
            "tap('#party-world-inventory [data-inventory-equip=\\\"charm\\\"]');" +
            "tap('[data-party-world-dir=\\\"right\\\"]');" +
            "tap('[data-party-world-dir=\\\"right\\\"]');" +
            "var panel=document.getElementById('party-world-battle');" +
            "if(!h.battle()||!panel||getComputedStyle(panel).display!=='grid')" +
              "throw Error('Fullscreen JRPG battle not visible');" +
            "var arena=panel.querySelector('.jrpg-battle-stage');" +
            "if(!arena||!arena.getClientRects().length||" +
              "!panel.querySelector('.jrpg-battle-foe')||" +
              "!panel.querySelector('.jrpg-battle-member')||" +
              "!panel.querySelector('[data-party-skill]')||" +
              "!panel.querySelector('[data-party-target]'))" +
              "throw Error('Missing battle arena, targets or party status');" +
            "var confirm=panel.querySelector('#party-commit');" +
            "if(!confirm||!confirm.getClientRects().length||confirm.disabled)" +
              "throw Error('Battle confirm inaccessible');" +
            "var turns=0;while(h.battle()&&turns++<10)tap('#party-world-battle #party-commit');" +
            "if(h.battle())throw new Error('Battle not completed');" +
            "}else{tap('[data-party-world-dir=\\\"down\\\"]');}" +
            "var v=h.view();" +
            "return JSON.stringify({level:v.partyProgression.pilot.level," +
            "xp:v.partyProgression.pilot.xp,skills:v.partyActors[0].skills," +
            "gear:v.partyGear.pilot,valid:h.verifySave()," +
            "display:document.getElementById('party-world-inventory').textContent," +
            "revision:v.sequence,partySize:v.partyActors.length});" +
            "}catch(e){return JSON.stringify({error:String(e),stack:String(e.stack||'')})}})()");
        JSONObject proof=new JSONObject((String)new JSONTokener(response).nextValue());
        if(proof.has("error"))
            throw new AssertionError("Integrated party world WebView UI failed "+response);
        JSONObject gear=proof.getJSONObject("gear");
        if(proof.getInt("level")!=2||proof.getInt("xp")!=10||
           proof.getInt("partySize")!=1||
           !"blade".equals(gear.getString("weapon"))||
           !"vest".equals(gear.getString("armor"))||
           !"charm".equals(gear.getString("accessory"))||
           !proof.getJSONArray("skills").toString().contains("focus")||
           !proof.getString("display").contains("Level 2")||
           !proof.getJSONObject("valid").getBoolean("ok")||
           proof.getInt("revision")<(restart?9:8))
            throw new AssertionError("Integrated party world UI/state did not persist "+response);
        resultMeta.putString("partyWorldUI",
            "PASS visible party world buttons, gear, combat, levels and native restart");
    }
    private void checkUnifiedPartyInventoryUi(boolean restart) throws Exception {
        Intent launch=new Intent();
        launch.setClassName("dev.bearframe.ridge","dev.bearframe.ridge.UnifiedEngineActivity");
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        screen=startActivitySync(launch);
        unifiedSnapshot();
        String result=evalHost("(function(){try{" +
            "var p=JSON.parse(JSON.stringify(FRAMEWORK_PARTY_FIXTURE));" +
            "p.items.vest={kind:'armor',name:'Test vest',defense:8,maxStack:2};" +
            "p.items.charm={kind:'accessory',name:'Test charm',attack:2,speed:3,maxStack:2};" +
            "p.partyCombat.allies.scout.hp=10;" +
            "p.events.supply.choices[0].effects.push({type:'recruit',ally:'scout'});" +
            "p.events.supply.choices[0].effects.push({type:'give',item:'vest',qty:2});" +
            "p.events.supply.choices[0].effects.push({type:'give',item:'charm',qty:2});" +
            "var store={read:function(k){return BearframeNative.read(k)}," +
            "write:function(k,v){return BearframeNative.write(k,v)}};" +
            "var s=createBearframeSession(p,store,null," +
            "{slotPrefix:'bf:framework-party-test:v2:gearui'});" +
            "var started="+(restart?"s.resume()":"s.start('Gear',37)")+";" +
            "if(!started.ok)return JSON.stringify({error:started.reason});" +
            "var ev=document.createElement('div'),gear=document.createElement('div');" +
            "var status=document.createElement('p');" +
            "document.body.appendChild(ev);document.body.appendChild(gear);" +
            "var panels=createBearframeRuntimePanels(ev,gear,status,p," +
            "function(){return s.snapshot().view},function(c){return s.dispatch(c)});" +
            "function find(attr,value,name){" +
            "var all=gear.querySelectorAll('['+attr+'=\"'+value+'\"]');" +
            "for(var i=0;i<all.length;i++)if(all[i].textContent.indexOf(name)>=0)return all[i];" +
            "return null;}" +
            "function push(btn,tag){if(!btn||btn.disabled)return tag;btn.click();panels.render();return null;}" +
            "var failed=null;" +
            "if(!"+(restart?"true":"false")+"){" +
            "if(!s.dispatch({type:'move',dir:'right'}).ok)return JSON.stringify({error:'event'});" +
            "if(!s.dispatch({type:'choose',id:'collect'}).ok)return JSON.stringify({error:'collect'});" +
            "panels.render();" +
            "failed=push(find('data-inventory-equip','blade','Test scout'),'scout blade');" +
            "if(failed)return JSON.stringify({error:failed});" +
            "var leadBlade=find('data-inventory-equip','blade','Gear');" +
            "if(!leadBlade||!leadBlade.disabled)return JSON.stringify({error:'duplicate weapon available'});" +
            "failed=push(find('data-inventory-equip','vest','Gear'),'lead armor');" +
            "if(failed)return JSON.stringify({error:failed});" +
            "failed=push(find('data-inventory-equip','charm','Test scout'),'scout charm');" +
            "if(failed)return JSON.stringify({error:failed});" +
            "failed=push(find('data-inventory-use','patch','Test scout'),'scout patch');" +
            "if(failed)return JSON.stringify({error:failed});" +
            "failed=push(find('data-inventory-unequip','scout:weapon','Test scout'),'release blade');" +
            "if(failed)return JSON.stringify({error:failed});" +
            "failed=push(find('data-inventory-equip','blade','Gear'),'lead blade');" +
            "if(failed)return JSON.stringify({error:failed});" +
            "}else{" +
            "panels.render();" +
            "failed=push(find('data-inventory-unequip','pilot:armor','Gear'),'resume unequip armor');" +
            "if(failed)return JSON.stringify({error:failed});" +
            "}" +
            "var view=s.snapshot().view;" +
            "return JSON.stringify({seq:view.sequence,gear:view.partyGear," +
            "hp:view.partyActors[1].hp,charge:view.partyActors[1].mp," +
            "inventory:view.inventory,quests:view.quests," +
            "pilotAttack:view.partyActors[0].attack," +
            "scoutAttack:view.partyActors[1].attack," +
            "saved:s.verifySave()});}catch(error){" +
            "return JSON.stringify({error:String(error),stack:String(error.stack||'')})}})()");
        JSONObject proof=new JSONObject((String)new JSONTokener(result).nextValue());
        if(proof.has("error"))
            throw new AssertionError("Party inventory browser action refused: "+result);
        JSONObject gear=proof.getJSONObject("gear");
        JSONObject lead=gear.getJSONObject("pilot"),scout=gear.getJSONObject("scout");
        JSONObject inv=proof.getJSONObject("inventory");
        if(proof.getInt("seq")!=(restart?9:8)||
           !"blade".equals(lead.getString("weapon"))||
           !(restart?lead.isNull("armor"):"vest".equals(lead.getString("armor")))||
           !"charm".equals(scout.getString("accessory"))||
           !scout.isNull("weapon")||
           proof.getInt("hp")!=22||
           proof.getInt("scoutAttack")!=8||
           inv.getInt("blade")!=1||inv.getInt("patch")!=1||
           proof.getJSONObject("quests").getInt("survey")!=0||
           !proof.getJSONObject("saved").getBoolean("ok"))
            throw new AssertionError("Party inventory failed Android save/readback: "+result);
        resultMeta.putString("inventoryUi",
            "PASS party equipment/consumable DOM, no duplicated gear, Android native restart");
    }
    /** Landscape is not a cosmetic CSS width: prove the live installed
     * Activity rotates, fits the logical stage inside safe view bounds,
     * and exposes all menus as pages instead of scrollable document content. */
    /** Installed Android WebView: real idle pixels advance on the world page
     * with no gameplay input, saved revisions or background RAF leak. */
    private void checkUnifiedPresentationClock() throws Exception {
        String setup=evalHost("(function(){try{" +
            "var h=BearframeHost,p=h.presentationClock,c=document.getElementById('party-world-surface');" +
            "if(!p||!c)throw Error('missing host presentation clock');" +
            "if(h.partyWorldScreens.current()!=='world')throw Error('world page not active');" +
            "var v=h.partyWorld.view(),state=p.snapshot();" +
            "function hash(){var d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;" +
            "var x=2166136261;for(var i=0;i<d.length;i+=4){" +
            "x=Math.imul(x^d[i],16777619)>>>0;" +
            "x=Math.imul(x^d[i+1],16777619)>>>0;" +
            "x=Math.imul(x^d[i+2],16777619)>>>0;}return x;}" +
            "return JSON.stringify({run:state.running,tick:state.tick,paints:state.paints," +
            "hash:hash(),revision:v.sequence});" +
            "}catch(e){return JSON.stringify({error:String(e)})}})()");
        JSONObject first=new JSONObject((String)new JSONTokener(setup).nextValue());
        if(first.has("error")||!first.getBoolean("run"))
            throw new AssertionError("Idle clock did not start: "+first);
        boolean pixelsChanged=false;
        JSONObject sample=null;
        for(int i=0;i<15;i++){
            Thread.sleep(90);
            String result=evalHost("(function(){var p=BearframeHost.presentationClock.snapshot()," +
                "c=document.getElementById('party-world-surface')," +
                "d=c.getContext('2d').getImageData(0,0,c.width,c.height).data,x=2166136261;" +
                "for(var i=0;i<d.length;i+=4){" +
                "x=Math.imul(x^d[i],16777619)>>>0;" +
                "x=Math.imul(x^d[i+1],16777619)>>>0;" +
                "x=Math.imul(x^d[i+2],16777619)>>>0;}" +
                "return JSON.stringify({hash:x,tick:p.tick,paints:p.paints," +
                "revision:BearframeHost.partyWorld.view().sequence});})()");
            sample=new JSONObject((String)new JSONTokener(result).nextValue());
            if(sample.getLong("hash")!=first.getLong("hash") &&
               sample.getInt("paints")>first.getInt("paints")){
                pixelsChanged=true;break;
            }
        }
        if(!pixelsChanged||sample.getInt("revision")!=first.getInt("revision"))
            throw new AssertionError("Real idle scene pixels did not advance without saves: "+
                first+" -> "+sample);
        String paused=evalHost("(function(){BearframeHost.partyWorldScreens.select('party');" +
            "return JSON.stringify(BearframeHost.presentationClock.snapshot());})()");
        JSONObject pauseBefore=new JSONObject((String)new JSONTokener(paused).nextValue());
        if(pauseBefore.getBoolean("running"))
            throw new AssertionError("Offscreen world kept RAF running");
        Thread.sleep(250);
        JSONObject pauseAfter=new JSONObject((String)new JSONTokener(evalHost(
            "JSON.stringify(BearframeHost.presentationClock.snapshot())")).nextValue());
        if(pauseAfter.getInt("tick")!=pauseBefore.getInt("tick")||
           pauseAfter.getInt("paints")!=pauseBefore.getInt("paints"))
            throw new AssertionError("Hidden screen continued ticking");
        String resume=evalHost("(function(){BearframeHost.partyWorldScreens.select('world');" +
            "var started=BearframeHost.presentationClock.snapshot().running;" +
            "BearframeHost.suspend();" +
            "var stopped=!BearframeHost.presentationClock.snapshot().running;" +
            "BearframeHost.resume();" +
            "return JSON.stringify({started:started,stopped:stopped," +
            "resumed:BearframeHost.presentationClock.snapshot().running," +
            "sequence:BearframeHost.partyWorld.view().sequence," +
            "save:BearframeHost.partyWorld.verifySave().ok});})()");
        JSONObject finalState=new JSONObject((String)new JSONTokener(resume).nextValue());
        if(!finalState.getBoolean("started")||!finalState.getBoolean("stopped")||
           !finalState.getBoolean("resumed")||!finalState.getBoolean("save")||
           finalState.getInt("sequence")!=first.getInt("revision"))
            throw new AssertionError("RAF lifecycle damaged world save: "+resume);
        resultMeta.putString("presentationClock",
            "PASS real idle pixel changes, tab/Activity pause-resume, unchanged saved revision");
    }
    private void checkLandscapeViewport() throws Exception {
        Intent launch=new Intent();
        launch.setClassName("dev.bearframe.ridge","dev.bearframe.ridge.UnifiedEngineActivity");
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        screen=startActivitySync(launch);
        unifiedSnapshot();
        if(screen.getRequestedOrientation()!=
            android.content.pm.ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE)
            throw new AssertionError("Unified Android engine did not request sensor landscape");
        if(screen.getResources().getConfiguration().orientation!=
            android.content.res.Configuration.ORIENTATION_LANDSCAPE)
            throw new AssertionError("Installed engine is still in portrait orientation");
        String reply=evalHost("(function(){try{" +
            "var l=window.BearframeLandscape,stage=document.getElementById('engine-landscape-stage');" +
            "if(!l||!stage)throw Error('Missing landscape host');" +
            "var rect=stage.getBoundingClientRect();" +
            "var npcAudit=BearframeHost.sceneVisibilityAudit();" +
            "var sceneryAudit=BearframeHost.sceneryLayerAudit();" +
            "var animationAudit=BearframeHost.animatedTileAudit();" +
            "var navHost=BearframeHost.partyWorld,navRevision=navHost.view().sequence;" +
            "var pathPlan=navHost.planPath({x:4,y:3});" +
            "var interaction=navHost.planPath({x:2,y:1},{allowDestinationTrigger:true});" +
            "var pathUnchanged=navHost.view().sequence===navRevision;" +
            "var cameraScene=navHost.compose({width:64,height:64,tick:0," +
            "cameraTarget:{x:5,y:3}});" +
            "var cameraSafe=cameraScene.camera.x===144&&" +
            "cameraScene.camera.y===80&&" +
            "navHost.view().sequence===navRevision&&" +
            "navHost.view().x===1&&navHost.view().y===1;" +
            "var layerProject=JSON.parse(JSON.stringify(FRAMEWORK_PARTY_FIXTURE));" +
            "layerProject.maps.hub.visualLayers=[" +
            "{depth:'ground',cells:{'1,1':'floor'}}," +
            "{depth:'canopy',cells:{'1,1':'wall'}}];" +
            "var layerTheme={tileSize:32,clearColor:'#101018'," +
            "atlases:{terrain:{width:64,height:32},characters:{width:64,height:48}}," +
            "tiles:{floor:{atlas:'terrain',x:0,y:0,w:32,h:32}," +
            "wall:{atlas:'terrain',x:32,y:0,w:32,h:32}}," +
            "sprites:{player:{ticksPerFrame:1,frames:[" +
            "{atlas:'characters',x:0,y:0,w:32,h:48}]}}};" +
            "var layerEngine=createBearframeEngine(layerProject);" +
            "var layerView=layerEngine.view(layerEngine.fresh('Layer test',43));" +
            "var layerScene=createBearframeSceneComposer(layerProject,layerTheme)" +
            ".compose(layerView,{width:96,height:96,tick:0});" +
            "var layerCommands=layerScene.commands;" +
            "var under=layerCommands.findIndex(function(c){return c.layer===0.5;});" +
            "var actor=layerCommands.findIndex(function(c){return c.actor==='player';});" +
            "var over=layerCommands.findIndex(function(c){return c.layer===2;});" +
            "var layerOrder=under>0&&actor>under&&over>actor&&" +
            "layerCommands[under].source.x===0&&layerCommands[over].source.x===32;" +
            "var walker=createBearframeCharacterSpriteRenderer({" +
            "atlas:'characters',frameWidth:16,frameHeight:12,columns:3,rows:4});" +
            "var directional=walker.frameFor({direction:'left',moving:true,elapsedMs:300});" +
            "var idle=walker.frameFor({direction:'up',moving:false});" +
            "var w=window.visualViewport?window.visualViewport.width:innerWidth;" +
            "var h=window.visualViewport?window.visualViewport.height:innerHeight;" +
            "var insets={top:12,right:18,bottom:8,left:22};" +
            "var sizes=[[640,360],[917,411],[1024,768],[1920,1080],[742,360]];" +
            "var fits=sizes.map(function(size){var f=l.fit(size[0],size[1],insets);" +
            "return f.scale>0&&f.offsetX>=insets.left-.01&&f.offsetY>=insets.top-.01&&" +
            "f.offsetX+f.stageWidth*f.scale<=size[0]-insets.right+.01&&" +
            "f.offsetY+f.stageHeight*f.scale<=size[1]-insets.bottom+.01;});" +
            "var world=document.getElementById('pw-tab-world'),party=document.getElementById('pw-tab-party');" +
            "var save=document.getElementById('pw-tab-save');" +
            "party.click();var partyVisible=!document.getElementById('pw-screen-party').hidden;" +
            "save.click();var saveVisible=!document.getElementById('pw-screen-save').hidden;" +
            "world.click();" +
            "var nav=document.getElementById('party-world-navigation').getBoundingClientRect();" +
            "var canvas=document.getElementById('party-world-surface').getBoundingClientRect();" +
            "function inside(a){return a.left>=rect.left-1&&a.top>=rect.top-1&&" +
            "a.right<=rect.right+1&&a.bottom<=rect.bottom+1;}" +
            "var debug=l.setDebug(true),debugOpen=document.body.classList.contains('landscape-debug');" +
            "l.setDebug(false);" +
            "return JSON.stringify({w:w,h:h,width:rect.width,height:rect.height," +
            "left:rect.left,top:rect.top,right:rect.right,bottom:rect.bottom," +
            "fits:fits,inside:inside(nav)&&inside(canvas)," +
            "npcAudit:npcAudit,sceneryAudit:sceneryAudit," +
            "animationAudit:animationAudit," +
            "pathPlan:pathPlan,interaction:interaction," +
            "pathUnchanged:pathUnchanged,layerOrder:layerOrder,cameraSafe:cameraSafe," +
            "directional:directional,idle:idle," +
            "coverage:(rect.width*rect.height)/(w*h)," +
            "scroll:getComputedStyle(document.documentElement).overflowY," +
            "game:document.body.classList.contains('landscape-gameplay')," +
            "party:partyVisible,save:saveVisible,debug:debug&&debugOpen});" +
            "}catch(e){return JSON.stringify({error:String(e),stack:String(e.stack||'')})}})()");
        JSONObject result=new JSONObject((String)new JSONTokener(reply).nextValue());
        if(result.has("error"))throw new AssertionError("Landscape JS failed: "+result);
        JSONObject animationAudit=result.getJSONObject("animationAudit");
        if(!animationAudit.getBoolean("ok")||
           animationAudit.getInt("changedPixels")<=20||
           animationAudit.getInt("revisionBefore")!=animationAudit.getInt("revisionAfter"))
            throw new AssertionError("Installed Canvas tile animation pixels missing: "+animationAudit);
        JSONObject sceneryAudit=result.getJSONObject("sceneryAudit");
        if(!sceneryAudit.getBoolean("ok")||
           sceneryAudit.getInt("alteredPixels")<=20||
           sceneryAudit.getInt("beforeRevision")!=sceneryAudit.getInt("afterRevision"))
            throw new AssertionError("Installed WebView scenery overlay pixels missing: "+sceneryAudit);
        JSONObject npcAudit=result.getJSONObject("npcAudit");
        if(!npcAudit.getBoolean("ok")||
           npcAudit.getInt("eventActors")<2||
           npcAudit.getInt("differentPixels")<20||
           npcAudit.getInt("revisionBefore")!=npcAudit.getInt("revisionAfter")||
           !npcAudit.getJSONArray("actorIds").toString().contains("event:mechanic:2,2"))
            throw new AssertionError("Installed WebView hides a configured NPC: "+npcAudit);
        if(!result.getBoolean("cameraSafe"))
            throw new AssertionError("Camera pan mutated or misplaced canonical world: "+result);
        if(!result.getBoolean("layerOrder"))
            throw new AssertionError("Installed scene painter order hides character layers: "+result);
        JSONObject pathPlan=result.getJSONObject("pathPlan");
        JSONObject interaction=result.getJSONObject("interaction");
        if(!interaction.getBoolean("ok")||interaction.getInt("cost")!=1||
           !"right".equals(interaction.getJSONArray("directions").getString(0)))
            throw new AssertionError("NPC destination path was not a safe single action: "+result);
        if(!pathPlan.getBoolean("ok")||pathPlan.getInt("cost")!=5||
           !result.getBoolean("pathUnchanged")||
           !"[\"down\",\"down\",\"right\",\"right\",\"right\"]".equals(
             pathPlan.getJSONArray("directions").toString()))
            throw new AssertionError("Installed pathfinder changed save or found unsafe route: "+result);
        JSONObject walk=result.getJSONObject("directional"),idle=result.getJSONObject("idle");
        if(walk.getInt("sx")!=32||walk.getInt("sy")!=12||
           walk.getInt("column")!=2||walk.getInt("row")!=1||
           idle.getInt("sx")!=16||idle.getInt("sy")!=36)
            throw new AssertionError("Installed Engine v1 directional sprite mapping failed: "+result);
        JSONArray fits=result.getJSONArray("fits");
        for(int i=0;i<fits.length();i++)
            if(!fits.getBoolean(i))
                throw new AssertionError("Landscape clipped screen profile "+i+": "+result);
        if(result.getDouble("coverage")<0.80)
            throw new AssertionError("Landscape viewport wastes too much phone display: "+result);
        if(result.getDouble("w")<=result.getDouble("h")||
           result.getDouble("left")< -2||result.getDouble("top")< -2||
           result.getDouble("right")>result.getDouble("w")+2||
           result.getDouble("bottom")>result.getDouble("h")+2||
           !"hidden".equals(result.getString("scroll"))||
           !result.getBoolean("inside")||!result.getBoolean("party")||
           !result.getBoolean("save")||!result.getBoolean("debug")||
           !result.getBoolean("game"))
            throw new AssertionError("Landscape scene/panels overflow: "+result);
        resultMeta.putString("landscape","PASS forced Android landscape, responsive safe-area fit, no-scroll panels and diagnostics toggle");
    }
    private void checkUnifiedContentBinding(boolean restart) throws Exception {
        Intent launch=new Intent();
        launch.setClassName("dev.bearframe.ridge","dev.bearframe.ridge.UnifiedEngineActivity");
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        screen=startActivitySync(launch);
        unifiedSnapshot();
        String response=evalHost("(function(){" +
            "var project=JSON.parse(JSON.stringify(FRAMEWORK_FIXTURE));" +
            "project.contentRevision='runtime_r1';" +
            "var store={read:function(k){return BearframeNative.read(k)}," +
            "write:function(k,v){return BearframeNative.write(k,v)}};" +
            "var prefix='bf:framework-test:v1:contentbinding';" +
            "var s=createBearframeSession(project,store,null,{slotPrefix:prefix});" +
            "var launched="+(restart?"s.resume()":"s.start('Bound',47)")+";" +
            "if(!launched.ok)return JSON.stringify({startError:launched.reason});" +
            "var initial=s.snapshot();" +
            "var step=s.dispatch({type:'move',dir:'"+(restart?"up":"down")+"'});" +
            "var current=s.snapshot();" +
            "var verified=s.verifySave();" +
            "var first=BearframeNative.read(prefix+':a');" +
            "var second=BearframeNative.read(prefix+':b');" +
            "var changed=JSON.parse(JSON.stringify(project));" +
            "changed.items.blade.power=40;" +
            "var wrong=createBearframeSession(changed,store,null,{slotPrefix:prefix});" +
            "var rejected=wrong.resume();" +
            "var noStart=wrong.start('Unsafe',47);" +
            "return JSON.stringify({initial:initial,step:step,current:current," +
            "verified:verified,rejected:rejected,noStart:noStart," +
            "preserved:first===BearframeNative.read(prefix+':a')&&" +
            "second===BearframeNative.read(prefix+':b')," +
            "tag:JSON.parse(first||second).contentTag});})()");
        JSONObject proof=new JSONObject((String)new JSONTokener(response).nextValue());
        if(proof.has("startError"))
            throw new AssertionError("Content-bound journal refused same project: "+response);
        JSONObject before=proof.getJSONObject("initial").getJSONObject("view");
        JSONObject after=proof.getJSONObject("current").getJSONObject("view");
        if(before.getInt("sequence")!=(restart?1:0)||
           after.getInt("sequence")!=(restart?2:1)||
           !proof.getJSONObject("step").getBoolean("ok")||
           !proof.getJSONObject("verified").getBoolean("ok")||
           !"incompatible-content".equals(proof.getJSONObject("rejected").getString("reason"))||
           !"incompatible-content".equals(proof.getJSONObject("noStart").getString("reason"))||
           !proof.getBoolean("preserved")||
           !proof.getString("tag").startsWith("v1:runtime_r1:"))
            throw new AssertionError("Native content mismatch enforcement failed: "+response);
        resultMeta.putString("contentBinding",
            "PASS version-tagged world save, content mismatch refusal, byte-preserving Android restart");
    }
    private void checkUnifiedPartyWorldBridge(boolean restart) throws Exception {
        Intent launch=new Intent();
        launch.setClassName("dev.bearframe.ridge","dev.bearframe.ridge.UnifiedEngineActivity");
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        screen=startActivitySync(launch);
        unifiedSnapshot();
        String setup=evalHost("(function(){" +
            "var storage={read:function(k){return BearframeNative.read(k)}," +
            "write:function(k,v){return BearframeNative.write(k,v)}};" +
            "window.__bfV2World=createBearframeSession(FRAMEWORK_PARTY_FIXTURE," +
            "storage,null,{slotPrefix:'bf:framework-party-test:v2:worldbridge'});" +
            "var s=window.__bfV2World;" +
            "return JSON.stringify("+(restart?"s.resume()":"s.start('Bridge',47)")+");})()");
        JSONObject started=new JSONObject((String)new JSONTokener(setup).nextValue());
        if(!started.getBoolean("ok"))
            throw new AssertionError("v2 world host failed to start/resume: "+setup);
        if(!restart){
            String result=evalHost("(function(){var s=window.__bfV2World;" +
                "var steps=[{type:'move',dir:'right'}," +
                "{type:'choose',id:'collect'},{type:'equip',item:'blade'}," +
                "{type:'move',dir:'right'},{type:'move',dir:'right'}," +
                "{type:'party-round',orders:[{actor:'pilot',skill:'pulse',target:'crawler'}]}];" +
                "for(var i=0;i<steps.length;i++){" +
                "var a=s.dispatch(steps[i]);if(!a.ok)return JSON.stringify({error:a.reason,step:i});}" +
                "return JSON.stringify({view:s.snapshot().view,save:s.verifySave()});})()");
            JSONObject info=new JSONObject((String)new JSONTokener(result).nextValue());
            if(info.has("error"))throw new AssertionError("v2 bridge command failed "+result);
            JSONObject view=info.getJSONObject("view");
            if(view.getInt("sequence")!=6||view.getInt("charge")!=2||
               view.getJSONObject("inventory").getInt("blade")!=1||
               !"blade".equals(view.getString("weapon"))||
               view.getJSONArray("partyActors").getJSONObject(0).getInt("attack")!=14||
               view.getJSONArray("partyActors").getJSONObject(0).getInt("mp")!=2||
               !info.getJSONObject("save").getBoolean("ok"))
                throw new AssertionError("v2 equip/party battle not committed: "+result);
        }else{
            String result=evalHost("(function(){var s=window.__bfV2World;" +
                "var before=s.snapshot().view;" +
                "var action=s.dispatch({type:'party-round'," +
                "orders:[{actor:'pilot',skill:'strike',target:'crawler'}]});" +
                "return JSON.stringify({before:before,action:action," +
                "after:s.snapshot().view,save:s.verifySave()});})()");
            JSONObject info=new JSONObject((String)new JSONTokener(result).nextValue());
            JSONObject before=info.getJSONObject("before"),after=info.getJSONObject("after");
            if(before.getInt("sequence")!=6||before.getInt("charge")!=2||
               before.getJSONArray("partyActors").getJSONObject(0).getInt("attack")!=14||
               !info.getJSONObject("action").getBoolean("ok")||
               after.getInt("sequence")!=7||
               !info.getJSONObject("save").getBoolean("ok"))
                throw new AssertionError("v2 equipped battle restart failed: "+result);
        }
        resultMeta.putString("v2world",
            "PASS native Android v2 world inventory, equipment, live combat and restart");
    }
    private void checkUnifiedPartyChoice() throws Exception {
        Intent launch=new Intent();
        launch.setClassName("dev.bearframe.ridge","dev.bearframe.ridge.UnifiedEngineActivity");
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        screen=startActivitySync(launch);
        unifiedSnapshot();
        evalHost("document.getElementById('party-start').click()");
        String prepared=evalHost("(function(){var s=document.querySelector('[data-party-skill=pilot]');" +
            "if(!s)return 'missing-select';s.value='pulse';" +
            "s.dispatchEvent(new Event('change'));" +
            "var t=document.querySelector('[data-party-target=pilot]');" +
            "if(!t||t.value!=='crawler')return 'wrong-target';" +
            "document.getElementById('party-commit').click();return 'submitted';})()");
        if(!"\"submitted\"".equals(prepared))
            throw new AssertionError("Installed party UI did not submit chosen commands: "+prepared);
        String raw=evalHost("JSON.stringify(BearframeHost.party.snapshot())");
        JSONObject after=new JSONObject((String)new JSONTokener(raw).nextValue());
        if(after.getInt("sequence")!=7||after.getInt("savedRevision")!=7||
           after.getInt("playerMp")!=2||after.getInt("targetHp")>=48)
            throw new AssertionError("Selected pulse was not durably processed: "+after);
        JSONObject world=unifiedSnapshot();
        if(world.getInt("sequence")!=0||world.getInt("savedRevision")!=0)
            throw new AssertionError("Party command changed base engine journal");
        resultMeta.putString("partyChoice","PASS chosen ability/target, UI and durable MP");
    }
    /** Inject the WebView renderer-terminated callback via the real client.
     * This is deterministic callback-path coverage, not an actual OS renderer
     * crash. It verifies durable recovery, PNG decode and fail-closed UI. */
    private void checkUnifiedRendererRecovery() throws Exception {
        Intent launch=new Intent();
        launch.setClassName("dev.bearframe.ridge","dev.bearframe.ridge.UnifiedEngineActivity");
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        screen=startActivitySync(launch);
        JSONObject before=unifiedSnapshot();
        if(before.getInt("sequence")!=0||before.getInt("savedRevision")!=0)
            throw new AssertionError("Renderer recovery started with stale journal");
        String result=evalHost("JSON.stringify(BearframeHost.navigate('down'))");
        JSONObject step=new JSONObject((String)new JSONTokener(result).nextValue());
        if(!step.getBoolean("ok"))throw new AssertionError("Cannot commit baseline step");
        JSONObject saved=unifiedSnapshot();
        if(saved.getInt("sequence")!=1||saved.getInt("savedRevision")!=1)
            throw new AssertionError("Pre-crash state not durably saved");
        WebView old=findWebView(screen.getWindow().getDecorView());
        AtomicReference<Boolean> handled=new AtomicReference<>(false);
        AtomicReference<Throwable> error=new AtomicReference<>();
        runOnMainSync(()->{
            try{handled.set(old.getWebViewClient().onRenderProcessGone(old,null));}
            catch(Throwable failure){error.set(failure);}
        });
        if(error.get()!=null)throw new AssertionError(error.get());
        if(!handled.get())throw new AssertionError("Renderer callback was not handled");
        WebView fresh=findWebView(screen.getWindow().getDecorView());
        if(fresh==null||fresh==old)
            throw new AssertionError("Renderer callback did not replace dead WebView");
        JSONObject restored=unifiedSnapshot();
        if(restored.getInt("sequence")!=1||restored.getInt("savedRevision")!=1||
           restored.getInt("y")!=2||restored.getInt("assetsLoaded")!=2)
            throw new AssertionError("Renderer replacement did not rehydrate: "+restored);
        // Verify navigation remains transactional after the new renderer boots.
        String reply=evalHost("JSON.stringify(BearframeHost.navigate('up'))");
        JSONObject advance=new JSONObject((String)new JSONTokener(reply).nextValue());
        if(!advance.getBoolean("ok"))throw new AssertionError("Recovered renderer could not dispatch");
        JSONObject after=unifiedSnapshot();
        if(after.getInt("sequence")!=2||after.getInt("savedRevision")!=2||
           after.getInt("y")!=1)
            throw new AssertionError("Recovered renderer failed durable commit: "+after);
        resultMeta.putString("renderer","PASS callback recovery, offline texture reload, journal revision 2");
    }
    /** Native AudioManager focus request/release through the installed WebView.
     * This confirms focus API behavior, not audible physical output. */
    private void checkUnifiedAudioFocus() throws Exception {
        Intent launch=new Intent();
        launch.setClassName("dev.bearframe.ridge","dev.bearframe.ridge.UnifiedEngineActivity");
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        screen=startActivitySync(launch);
        JSONObject before=unifiedSnapshot();
        String requested=evalHost("BearframeAudioFocus.request()");
        if(!"true".equals(requested))
            throw new AssertionError("Foreground audio focus request rejected: "+requested);
        if(!"true".equals(evalHost("BearframeAudioFocus.request()")))
            throw new AssertionError("Repeated audio focus request should be idempotent");
        evalHost("BearframeAudioFocus.abandon()");
        evalHost("BearframeAudioFocus.abandon()");
        JSONObject after=unifiedSnapshot();
        if(before.getInt("sequence")!=after.getInt("sequence")||
           before.getInt("savedRevision")!=after.getInt("savedRevision"))
            throw new AssertionError("Audio focus changed authoritative gameplay state");
        resultMeta.putString("focus","PASS native audio focus request, abandon and unchanged journal");
    }
    /** Real installed WebView recovery vault: deliberate preflight and consent,
     * exact archive re-read after Android process restart, legacy source is not
     * written by the new host. This is archival, NOT playable migration. */
    private void checkUnifiedArchive(boolean restart) throws Exception {
        android.content.SharedPreferences old=getTargetContext()
            .getSharedPreferences("ExpeditionActivity",android.content.Context.MODE_PRIVATE);
        if(!restart){
            JSONObject flags=new JSONObject();
            for(String id:new String[]{"bearing","E","D","H","echoAlly","gridAlly","met"})
                flags.put(id,false);
            flags.put("bearing",true);flags.put("E",true);flags.put("echoAlly",true);
            JSONObject battle=new JSONObject().put("key","H").put("hp",14).put("turn",2);
            JSONObject state=new JSONObject().put("v",1).put("name","Archive fixture")
                .put("finish","Slate").put("area","gallery").put("x",8).put("y",4)
                .put("hp",31).put("charge",2).put("weapon","lance")
                .put("flags",flags).put("battle",battle)
                .put("prompt",JSONObject.NULL).put("message","Preserve exact progress");
            if(!old.edit().putString("expedition",state.toString())
                .putString("unrelated","unchanged").commit())
                throw new AssertionError("Cannot seed original test preferences");
        }
        String original=old.getString("expedition",null);
        if(original==null)throw new AssertionError("Original source vanished");
        Intent launch=new Intent();
        launch.setClassName("dev.bearframe.ridge","dev.bearframe.ridge.UnifiedEngineActivity");
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        screen=startActivitySync(launch);
        JSONObject baseline=unifiedSnapshot();
        if(baseline.getInt("sequence")!=0||baseline.getInt("savedRevision")!=0)
            throw new AssertionError("Source archival touched live engine journal");
        if(!restart){
            if(!"true".equals(evalHost("document.getElementById('legacy-confirm').disabled")))
                throw new AssertionError("Historical archive consent button active before inspect");
            String initial=evalHost("JSON.stringify(BearframeLegacyVault.audit())");
            JSONObject absence=new JSONObject((String)new JSONTokener(initial).nextValue());
            if(!"no-archive".equals(absence.getString("reason")))
                throw new AssertionError("Historical source was archived automatically");
            evalHost("document.getElementById('legacy-preview').click()");
            if(!"false".equals(evalHost("document.getElementById('legacy-confirm').disabled")))
                throw new AssertionError("Validated source did not enable explicit consent");
            if(!original.equals(old.getString("expedition",null)))
                throw new AssertionError("Preflight mutated old save");
            evalHost("document.getElementById('legacy-confirm').click()");
        }
        String audited=evalHost("JSON.stringify(BearframeLegacyVault.audit())");
        JSONObject info=new JSONObject((String)new JSONTokener(audited).nextValue());
        if(!info.getBoolean("ok")||!info.getBoolean("sourceMatches")||
           !"Archive fixture".equals(info.getJSONObject("summary").getString("name")))
            throw new AssertionError("Historical archive was not recovered: "+info);
        Object archived=new JSONTokener(evalHost("BearframeLegacyVault.exactCopy().raw")).nextValue();
        if(!(archived instanceof String)||!original.equals(archived))
            throw new AssertionError("Recovery archive did not preserve exact source bytes");
        if(!"true".equals(evalHost("BearframeArchiveExport.hasVerifiedArchive()")) ||
           !"false".equals(evalHost("document.getElementById('legacy-export').disabled")))
            throw new AssertionError("Verified historical archive is not exportable via user picker");
        if(!original.equals(old.getString("expedition",null))||
           !"unchanged".equals(old.getString("unrelated",null)))
            throw new AssertionError("Original preference data was modified");
        JSONObject after=unifiedSnapshot();
        if(after.getInt("sequence")!=0||after.getInt("savedRevision")!=0)
            throw new AssertionError("Recovery archive mutated active simulation");
        if(restart){
            // Changing the original *test fixture* later must not replace
            // the previously archived bytes, and repeated imports fail closed.
            if(!old.edit().putString("expedition",original.replace(
                "Preserve exact progress","Advanced old progress")).commit())
                throw new AssertionError("Cannot simulate original launcher progress");
            String changed=evalHost("JSON.stringify(BearframeLegacyVault.audit())");
            JSONObject drift=new JSONObject((String)new JSONTokener(changed).nextValue());
            if(!drift.getBoolean("ok")||drift.getBoolean("sourceMatches"))
                throw new AssertionError("Source drift was not detected");
            Object still=new JSONTokener(evalHost("BearframeLegacyVault.exactCopy().raw")).nextValue();
            if(!original.equals(still))
                throw new AssertionError("Later old-save changes overwrote archived original");
            evalHost("document.getElementById('legacy-preview').click()");
            if(!"true".equals(evalHost("document.getElementById('legacy-confirm').disabled")))
                throw new AssertionError("Second archive could overwrite occupied recovery slot");
        }
        resultMeta.putString("archive","PASS exact historical archive, original source and separate journal");
    }
    /** Emulator-only historical compatibility acceptance through the installed offline WebView.
     * Explicit source archive, explicit copy, original combat, and process restart. */
    private void checkUnifiedLegacyCompat(boolean restart) throws Exception {
        android.content.SharedPreferences old=getTargetContext()
            .getSharedPreferences("ExpeditionActivity",android.content.Context.MODE_PRIVATE);
        if(!restart){
            JSONObject flags=new JSONObject();
            for(String id:new String[]{"bearing","E","D","H","echoAlly","gridAlly","met"})
                flags.put(id,false);
            flags.put("bearing",true);
            String fixture=new JSONObject().put("v",1).put("name","Legacy playable")
                .put("finish","Slate").put("area","gallery").put("x",8).put("y",4)
                .put("hp",35).put("charge",3).put("weapon","lance")
                .put("flags",flags).put("battle",new JSONObject()
                    .put("key","H").put("hp",24).put("turn",1))
                .put("prompt",JSONObject.NULL).put("message","Historical battle").toString();
            if(!old.edit().putString("expedition",fixture)
                .putString("untouched","yes").commit())
                throw new AssertionError("Cannot seed historical playable source");
        }
        String original=old.getString("expedition",null);
        if(original==null)throw new AssertionError("Original legacy game save absent");
        Intent launch=new Intent();
        launch.setClassName("dev.bearframe.ridge","dev.bearframe.ridge.UnifiedEngineActivity");
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        screen=startActivitySync(launch);
        JSONObject portable=unifiedSnapshot();
        if(portable.getInt("savedRevision")!=0||portable.getInt("sequence")!=0)
            throw new AssertionError("Compatibility test altered canonical engine");
        JSONObject early=new JSONObject((String)new JSONTokener(
            evalHost("BearframeLegacyCompat.snapshotJson()")).nextValue());
        if(early.getBoolean("active"))
            throw new AssertionError("Legacy session launched without consent");
        if(!restart){
            if(!"true".equals(evalHost(
                "document.getElementById('legacy-compat-confirm').disabled")))
                throw new AssertionError("Legacy import consent auto-enabled");
            evalHost("document.getElementById('legacy-preview').click()");
            evalHost("document.getElementById('legacy-confirm').click()");
            if(!"true".equals(evalHost(
                "JSON.parse(BearframeLegacyCompat.snapshotJson()).health.validSlots===0")))
                throw new AssertionError("Archival implicitly started playable compatibility");
            evalHost("document.getElementById('legacy-compat-preview').click()");
            if(!"false".equals(evalHost(
                "document.getElementById('legacy-compat-confirm').disabled")))
                throw new AssertionError("Archive did not enable explicit import");
            evalHost("document.getElementById('legacy-compat-confirm').click()");
        }else{
            evalHost("document.getElementById('legacy-compat-resume').click()");
        }
        JSONObject loaded=new JSONObject((String)new JSONTokener(
            evalHost("BearframeLegacyCompat.snapshotJson()")).nextValue());
        if(!loaded.getBoolean("active")||loaded.getInt("sequence")!=(restart?1:0)||
           loaded.getJSONObject("health").optInt("validSlots",0)<1)
            throw new AssertionError("Historical session not recovered: "+loaded);
        JSONObject legacy=loaded.getJSONObject("legacy");
        if(!"gallery".equals(legacy.getString("area"))||
           !"lance".equals(legacy.getString("weapon"))||
           legacy.getJSONObject("battle").getInt("hp")!=(restart?17:24))
            throw new AssertionError("Historical battle/gear state lost: "+legacy);
        String action=restart?"Pulse":"Strike";
        String did=evalHost("(function(){var buttons=document.querySelectorAll(" +
            "'#legacy-compat-actions button');for(var i=0;i<buttons.length;i++){" +
            "if(buttons[i].textContent==='"+action+"'){buttons[i].click();return true;}}return false;})()");
        if(!"true".equals(did))
            throw new AssertionError("Legacy combat action unavailable: "+action+" "+did);
        JSONObject advanced=new JSONObject((String)new JSONTokener(
            evalHost("BearframeLegacyCompat.snapshotJson()")).nextValue());
        if(advanced.getInt("sequence")!=(restart?2:1)||
           advanced.getJSONObject("legacy").getJSONObject("battle")
               .getInt("hp")!=(restart?3:17)||
           advanced.getJSONObject("health").getInt("latestSequence")!=(restart?2:1))
            throw new AssertionError("Original combat not durably committed: "+advanced);
        if(!original.equals(old.getString("expedition",null))||
           !"yes".equals(old.getString("untouched",null)))
            throw new AssertionError("Legacy compatibility overwrote original save");
        JSONObject after=unifiedSnapshot();
        if(after.getInt("sequence")!=portable.getInt("sequence")||
           after.getInt("savedRevision")!=portable.getInt("savedRevision"))
            throw new AssertionError("Legacy compatibility touched canonical journal");
        resultMeta.putString("legacyCompat",
            "PASS verified source, original combat, isolated journal and restart");
    }
    /** Validate native export of ACTUAL post-import progress, and missing-only
     * restoration from the user-selected portable JSON backup. No picker UI
     * automation; simulates Storage Access Framework result via a local URI. */
    private void checkUnifiedLegacyCompatExport() throws Exception {
        android.content.SharedPreferences old=getTargetContext()
            .getSharedPreferences("ExpeditionActivity",android.content.Context.MODE_PRIVATE);
        String original=old.getString("expedition",null);
        if(original==null)throw new AssertionError("Expected intact old launcher save");
        Intent launch=new Intent();
        launch.setClassName("dev.bearframe.ridge","dev.bearframe.ridge.UnifiedEngineActivity");
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        screen=startActivitySync(launch);
        JSONObject portable=unifiedSnapshot();
        evalHost("document.getElementById('legacy-compat-resume').click()");
        JSONObject continued=new JSONObject((String)new JSONTokener(
            evalHost("BearframeLegacyCompat.snapshotJson()")).nextValue());
        if(continued.getInt("sequence")!=2||
           continued.getJSONObject("legacy").getJSONObject("battle").getInt("hp")!=3||
           !"false".equals(evalHost(
               "document.getElementById('legacy-compat-export').disabled")))
            throw new AssertionError("Continued progress not available for export: "+continued);
        if(!"true".equals(evalHost("BearframeArchiveExport.hasPlayableCompat()")))
            throw new AssertionError("Native export cannot inspect recovered latest journal");
        java.lang.reflect.Field field=screen.getClass().getDeclaredField("exporter");
        field.setAccessible(true);
        Object exporter=field.get(screen);
        java.lang.reflect.Method latest=exporter.getClass().getDeclaredMethod("currentCompat");
        latest.setAccessible(true);
        String raw=(String)latest.invoke(exporter);
        Class<?> validator=screen.getClass().getClassLoader()
            .loadClass("dev.bearframe.ridge.LegacyV1Validator");
        java.lang.reflect.Method accepts=validator.getMethod("accepts",String.class);
        if(raw==null||!(Boolean)accepts.invoke(null,raw))
            throw new AssertionError("Latest historical state cannot be exported");
        JSONObject state=new JSONObject(raw);
        if(state.getJSONObject("battle").getInt("hp")!=3 ||
           !"Legacy playable".equals(state.getString("name")))
            throw new AssertionError("Export did not reflect post-import combat: "+state);
        java.lang.reflect.Field pending=exporter.getClass().getDeclaredField("pending");
        pending.setAccessible(true);pending.set(exporter,raw);
        java.io.File file=new java.io.File(getTargetContext().getFilesDir(),
            "historical-continued.json");
        if(file.exists()&&!file.delete())
            throw new AssertionError("Cannot reset continued export fixture");
        Intent chosen=new Intent();chosen.setData(Uri.fromFile(file));
        java.lang.reflect.Method onResult=exporter.getClass().getMethod("onResult",
            int.class,int.class,Intent.class);
        onResult.invoke(exporter,4917,Activity.RESULT_OK,chosen);
        String written=new String(java.nio.file.Files.readAllBytes(file.toPath()),
            java.nio.charset.StandardCharsets.UTF_8);
        if(!raw.equals(written))
            throw new AssertionError("Continued historical export is not byte-identical");
        // Refuse to overwrite the original until a deliberate external recovery.
        if(original.equals(raw))
            throw new AssertionError("Continued progress did not advance");
        if(!original.equals(old.getString("expedition",null)))
            throw new AssertionError("Export modified old launcher save");
        if(!old.edit().remove("expedition").commit())
            throw new AssertionError("Cannot stage a missing original preference");
        java.lang.reflect.Field restoring=exporter.getClass().getDeclaredField("restoring");
        restoring.setAccessible(true);restoring.setBoolean(exporter,true);
        onResult.invoke(exporter,4918,Activity.RESULT_OK,chosen);
        if(!raw.equals(old.getString("expedition",null)))
            throw new AssertionError("Continued progress did not recover into missing old save");
        restoring.setBoolean(exporter,true);
        onResult.invoke(exporter,4918,Activity.RESULT_OK,chosen);
        if(!raw.equals(old.getString("expedition",null)))
            throw new AssertionError("Second restore overwrote or damaged recovered progress");
        JSONObject after=unifiedSnapshot();
        if(portable.getInt("savedRevision")!=after.getInt("savedRevision") ||
           portable.getInt("sequence")!=after.getInt("sequence"))
            throw new AssertionError("File recovery touched portable simulation journal");
        JSONObject still=new JSONObject((String)new JSONTokener(
            evalHost("BearframeLegacyCompat.snapshotJson()")).nextValue());
        if(still.getInt("sequence")!=2)
            throw new AssertionError("Old-file restoration modified compatibility journal");
        resultMeta.putString("legacyCompatExport",
            "PASS verified latest continued JSON export, missing-only restore and journal isolation");
    }
    /** Real installed-host, user-selected continued file import and restart.
     * Simulates the SAF document result with a local file URI. Actual external
     * picker UI and physical phone acceptance remain separate release gates. */
    private void checkUnifiedCompatFile(boolean restart) throws Exception {
        android.content.SharedPreferences old=getTargetContext()
            .getSharedPreferences("ExpeditionActivity",android.content.Context.MODE_PRIVATE);
        if(!restart){
            JSONObject originalFlags=new JSONObject();
            for(String id:new String[]{"bearing","E","D","H","echoAlly","gridAlly","met"})
                originalFlags.put(id,false);
            String starting=new JSONObject().put("v",1).put("name","Old unchanged")
                .put("finish","Ash").put("area","pod").put("x",3).put("y",4)
                .put("hp",30).put("charge",2).put("weapon",JSONObject.NULL)
                .put("flags",originalFlags).put("battle",JSONObject.NULL)
                .put("prompt",JSONObject.NULL).put("message","Old launcher remains intact").toString();
            if(!old.edit().putString("expedition",starting)
                    .putString("unrelated","preserved").commit())
                throw new AssertionError("Cannot seed old source for file import");
        }
        String original=old.getString("expedition",null);
        if(original==null)throw new AssertionError("Original preference unexpectedly missing");
        Intent launch=new Intent();
        launch.setClassName("dev.bearframe.ridge","dev.bearframe.ridge.UnifiedEngineActivity");
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        screen=startActivitySync(launch);
        JSONObject independent=unifiedSnapshot();
        if(independent.getInt("sequence")!=0||independent.getInt("savedRevision")!=0)
            throw new AssertionError("Compatibility file affected core journal");
        JSONObject initially=new JSONObject((String)new JSONTokener(
            evalHost("BearframeLegacyCompat.snapshotJson()")).nextValue());
        if(initially.getBoolean("active")||
           !"true".equals(evalHost("document.getElementById('legacy-compat-import-confirm').disabled")))
            throw new AssertionError("External JSON was imported without explicit confirmation");
        if(!restart){
            JSONObject flags=new JSONObject();
            for(String id:new String[]{"bearing","E","D","H","echoAlly","gridAlly","met"})
                flags.put(id,false);
            flags.put("bearing",true);
            String continued=new JSONObject().put("v",1).put("name","File continuation")
                .put("finish","Slate").put("area","gallery").put("x",8).put("y",4)
                .put("hp",35).put("charge",3).put("weapon","lance")
                .put("flags",flags).put("battle",new JSONObject().put("key","H")
                    .put("hp",24).put("turn",1))
                .put("prompt",JSONObject.NULL).put("message","Imported progress").toString();
            java.lang.reflect.Field exporterField=screen.getClass().getDeclaredField("exporter");
            exporterField.setAccessible(true);
            Object exporter=exporterField.get(screen);
            java.lang.reflect.Field restoringCompat=exporter.getClass()
                .getDeclaredField("restoringCompat");
            restoringCompat.setAccessible(true);
            java.lang.reflect.Method onResult=exporter.getClass().getMethod("onResult",
                int.class,int.class,Intent.class);
            java.io.File file=new java.io.File(getTargetContext().getFilesDir(),
                "continued-selected.json");
            java.nio.file.Files.write(file.toPath(),
                continued.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            Intent selected=new Intent();selected.setData(Uri.fromFile(file));
            restoringCompat.setBoolean(exporter,true);
            onResult.invoke(exporter,4919,Activity.RESULT_OK,selected);
            boolean staged=false;
            for(int attempt=0;attempt<20;attempt++){
                if("false".equals(evalHost(
                    "document.getElementById('legacy-compat-import-confirm').disabled"))){
                    staged=true;break;
                }
                Thread.sleep(100);
            }
            if(!staged)
                throw new AssertionError("SAF selected file did not reach second consent");
            JSONObject beforeConfirm=new JSONObject((String)new JSONTokener(
                evalHost("BearframeLegacyCompat.snapshotJson()")).nextValue());
            if(beforeConfirm.getBoolean("active")||
               beforeConfirm.getJSONObject("health").getInt("occupiedSlots")!=0)
                throw new AssertionError("File preview committed without consent");
            evalHost("document.getElementById('legacy-compat-import-confirm').click()");
        }else{
            if(!"true".equals(evalHost(
                "document.getElementById('legacy-compat-import-file').disabled")))
                throw new AssertionError("Existing compatible save allowed overwrite selection");
            evalHost("document.getElementById('legacy-compat-resume').click()");
        }
        JSONObject loaded=new JSONObject((String)new JSONTokener(
            evalHost("BearframeLegacyCompat.snapshotJson()")).nextValue());
        if(!loaded.getBoolean("active")||loaded.getInt("sequence")!=(restart?1:0)||
           loaded.getJSONObject("health").getInt("validSlots")<1||
           !"File continuation".equals(loaded.getJSONObject("legacy").getString("name"))||
           loaded.getJSONObject("legacy").getJSONObject("battle")
               .getInt("hp")!=(restart?17:24))
            throw new AssertionError("Chosen historical file not recovered: "+loaded);
        if(!original.equals(old.getString("expedition",null))||
           !"preserved".equals(old.getString("unrelated",null)))
            throw new AssertionError("File import modified original launcher save");
        if(!restart){
            String action=evalHost("(function(){var buttons=document.querySelectorAll("+
                "'#legacy-compat-actions button');for(var i=0;i<buttons.length;i++){"+
                "if(buttons[i].textContent==='Strike'){buttons[i].click();return true;}}return false;})()");
            if(!"true".equals(action))
                throw new AssertionError("Recovered historical combat controls unavailable");
            JSONObject progressed=new JSONObject((String)new JSONTokener(
                evalHost("BearframeLegacyCompat.snapshotJson()")).nextValue());
            if(progressed.getInt("sequence")!=1||
               progressed.getJSONObject("legacy").getJSONObject("battle").getInt("hp")!=17)
                throw new AssertionError("Selected file could not continue combat: "+progressed);
        }
        JSONObject unchanged=unifiedSnapshot();
        if(unchanged.getInt("sequence")!=independent.getInt("sequence")||
           unchanged.getInt("savedRevision")!=independent.getInt("savedRevision"))
            throw new AssertionError("Recovered file mutated canonical engine");
        resultMeta.putString("compatFile",
            "PASS chosen document, explicit consent, original preservation, durable resume");
    }
    /** Installed Android WebView event choice -> inventory -> equipment.
     * Every action must commit through the SAME core journal. A second
     * instrumentation process checks exact restoration after force-stop. */
    private void checkUnifiedRuntimePanels(boolean restart) throws Exception {
        Intent launch=new Intent();
        launch.setClassName("dev.bearframe.ridge","dev.bearframe.ridge.UnifiedEngineActivity");
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        screen=startActivitySync(launch);
        JSONObject loaded=unifiedSnapshot();
        int initial=restart?3:0;
        if(loaded.getInt("sequence")!=initial||
           loaded.getInt("savedRevision")!=initial)
            throw new AssertionError("Runtime panel journal did not resume: "+loaded);
        if(!restart){
            if(!"true".equals(evalHost(
                "document.querySelector('[data-event-choice=collect]')===null")))
                throw new AssertionError("Unexpected starting event choice");
            if(!"true".equals(evalHost("JSON.parse(BearframeHost.snapshotJson()).inventory===null?false:"+
                "Object.keys(JSON.parse(BearframeHost.snapshotJson()).inventory).length===0")))
                throw new AssertionError("Starting inventory unexpectedly populated");
            String step=evalHost("JSON.stringify(BearframeHost.navigate('right'))");
            JSONObject moved=new JSONObject((String)new JSONTokener(step).nextValue());
            if(!moved.getBoolean("ok"))
                throw new AssertionError("Supply event navigation refused: "+step);
            JSONObject prompted=unifiedSnapshot();
            if(prompted.getInt("sequence")!=1||
               !"supply".equals(prompted.getJSONObject("prompt").getString("event")))
                throw new AssertionError("Engine did not open scripted event: "+prompted);
            if(!"true".equals(evalHost(
                "document.querySelector('[data-event-choice=collect]')!==null")))
                throw new AssertionError("Scripted supply choice missing from DOM");
            evalHost("document.querySelector('[data-event-choice=collect]').click()");
            JSONObject supplied=unifiedSnapshot();
            if(supplied.getInt("sequence")!=2||
               supplied.getJSONObject("inventory").getInt("blade")!=1||
               supplied.getJSONObject("inventory").getInt("patch")!=2||
               supplied.getJSONObject("quests").getInt("survey")!=0||
               !supplied.isNull("prompt"))
                throw new AssertionError("Choice effects were not durably committed: "+supplied);
            if(!"true".equals(evalHost(
                "document.querySelector('[data-inventory-equip=blade]')!==null")))
                throw new AssertionError("New gear not exposed by inventory panel");
            evalHost("document.querySelector('[data-inventory-equip=blade]').click()");
        }else{
            if(!"blade".equals(loaded.getString("weapon"))||
               loaded.getJSONObject("inventory").getInt("blade")!=1||
               loaded.getJSONObject("inventory").getInt("patch")!=2||
               loaded.getJSONObject("quests").getInt("survey")!=0)
                throw new AssertionError("Inventory/equipment/quest progress lost: "+loaded);
            if(!"true".equals(evalHost(
                "document.querySelector('[data-inventory-unequip]')!==null")))
                throw new AssertionError("Saved equipped item lacks remove action");
            evalHost("document.querySelector('[data-inventory-unequip]').click()");
        }
        JSONObject after=unifiedSnapshot();
        if(after.getInt("sequence")!=(restart?4:3)||
           after.getInt("savedRevision")!=(restart?4:3)||
           !"framework-test".equals(after.getString("project"))||
           (restart?!after.isNull("weapon"):
               !"blade".equals(after.getString("weapon"))))
            throw new AssertionError("Equipment action was not durably saved: "+after);
        resultMeta.putString("inventory",
            "PASS scripted event, gear, quest, saved inventory and process restart");
    }
    /** Regression for the physical-phone observation: right presses appear
     * stuck because a scripted choice or battle captures the world state.
     * Exercise actual WebView buttons, visibly explain the block, and verify
     * durable checkpoint recovery after an Android process stop. */
    private void checkUnifiedMobilePreviewFlow(boolean restart) throws Exception {
        Intent launch=new Intent();
        launch.setClassName("dev.bearframe.ridge","dev.bearframe.ridge.UnifiedEngineActivity");
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        screen=startActivitySync(launch);
        JSONObject first=unifiedSnapshot();
        if(!restart){
            if(first.getInt("sequence")!=0||
               !"explore".equals(first.getString("mode"))||
               !first.getBoolean("saveVerified"))
                throw new AssertionError("Initial mobile save not visible: "+first);
            if(!"false".equals(evalHost(
                "document.querySelector('[data-dir=right]').disabled")))
                throw new AssertionError("Start movement disabled without an event");
            evalHost("document.querySelector('[data-dir=right]').click()");
            JSONObject event=unifiedSnapshot();
            if(event.getInt("sequence")!=1||
               !"event".equals(event.getString("mode"))||
               !"supply".equals(event.getJSONObject("prompt").getString("event"))||
               !"true".equals(evalHost(
                    "document.querySelector('[data-dir=right]').disabled"))||
               !"true".equals(evalHost(
                    "document.getElementById('runtime-phase').textContent.includes('choice')"))||
               !"true".equals(evalHost(
                    "document.querySelector('[data-event-choice=collect]')!==null"))||
               !"true".equals(evalHost(
                    "document.activeElement&&document.activeElement.hasAttribute('data-event-choice')")))
                throw new AssertionError("Event prompt not explained, focused and selectable: "+event);
            evalHost("document.querySelector('[data-event-choice=collect]').click()");
            JSONObject selected=unifiedSnapshot();
            if(selected.getInt("sequence")!=2||
               !"explore".equals(selected.getString("mode"))||
               !"false".equals(evalHost(
                    "document.querySelector('[data-dir=right]').disabled")))
                throw new AssertionError("World pad did not resume after event choice: "+selected);
            evalHost("document.querySelector('[data-dir=right]').click()");
            JSONObject advanced=unifiedSnapshot();
            if(advanced.getInt("sequence")!=3||advanced.getInt("x")!=2)
                throw new AssertionError("Movement remained stuck after choice: "+advanced);
            evalHost("document.querySelector('[data-dir=right]').click()");
            JSONObject encounter=unifiedSnapshot();
            if(encounter.getInt("sequence")!=4||
               !"combat".equals(encounter.getString("mode"))||
               !"true".equals(evalHost(
                    "document.querySelector('[data-dir=right]').disabled"))||
               !"true".equals(evalHost(
                    "document.getElementById('runtime-phase').textContent.includes('combat action')"))||
               !"true".equals(evalHost(
                    "document.querySelector('[data-runtime-combat=strike]')!==null"))||
               !"true".equals(evalHost(
                    "document.activeElement&&document.activeElement.hasAttribute('data-runtime-combat')")))
                throw new AssertionError("Combat soft-lock without focused actions: "+encounter);
            evalHost("document.querySelector('[data-runtime-combat=strike]').click()");
            JSONObject progressed=unifiedSnapshot();
            if(progressed.getInt("sequence")!=5||
               !"combat".equals(progressed.getString("mode"))||
               !progressed.getBoolean("saveVerified"))
                throw new AssertionError("Combat action not durably saved: "+progressed);
        }else{
            if(first.getInt("sequence")!=5||
               !"combat".equals(first.getString("mode"))||
               !first.getBoolean("saveVerified")||
               !"true".equals(evalHost(
                    "document.querySelector('[data-runtime-combat=flee]')!==null")))
                throw new AssertionError("Interrupted battle did not resume: "+first);
            evalHost("document.querySelector('[data-runtime-combat=flee]').click()");
            JSONObject fled=unifiedSnapshot();
            if(fled.getInt("sequence")!=6||
               !"explore".equals(fled.getString("mode"))||
               !"false".equals(evalHost(
                    "document.querySelector('[data-dir=left]').disabled")))
                throw new AssertionError("Pad still blocked after combat resolution: "+fled);
            evalHost("document.querySelector('[data-dir=left]').click()");
            JSONObject walking=unifiedSnapshot();
            if(walking.getInt("sequence")!=7||walking.getInt("x")!=2)
                throw new AssertionError("World movement did not resume: "+walking);
        }
        String verified=evalHost("JSON.stringify(BearframeHost.verifySave())");
        JSONObject check=new JSONObject((String)new JSONTokener(verified).nextValue());
        if(!check.getBoolean("ok")||check.getInt("revision")!=(restart?7:5))
            throw new AssertionError("Explicit save check failed: "+verified);
        if(!"true".equals(evalHost(
            "document.getElementById('runtime-save-status').textContent.includes('Verified')")))
            throw new AssertionError("Manual save confirmation not visible");
        resultMeta.putString("mobileFlow",
            "PASS visible event and battle actions, movement unlock, verified save and restart");
    }
    /** Test-only native recovery acceptance without opening a document picker.
     * The actual restore UI always requires ACTION_OPEN_DOCUMENT user choice. */
    private void checkUnifiedRestoreNative() throws Exception {
        android.content.SharedPreferences old=getTargetContext()
            .getSharedPreferences("ExpeditionActivity",android.content.Context.MODE_PRIVATE);
        if(!old.edit().remove("expedition").putString("other","preserve").commit())
            throw new AssertionError("Cannot prepare missing source");
        JSONObject flags=new JSONObject();
        for(String id:new String[]{"bearing","E","D","H","echoAlly","gridAlly","met"})
            flags.put(id,false);
        flags.put("bearing",true);
        String raw=new JSONObject().put("v",1).put("name","Recovery test")
            .put("finish","Slate").put("area","gallery").put("x",8).put("y",4)
            .put("hp",35).put("charge",3).put("weapon","blade")
            .put("flags",flags).put("battle",JSONObject.NULL)
            .put("prompt","H").put("message","Restored old progress").toString();
        Intent launch=new Intent();
        launch.setClassName("dev.bearframe.ridge","dev.bearframe.ridge.UnifiedEngineActivity");
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        screen=startActivitySync(launch);
        JSONObject before=unifiedSnapshot();
        Object activity=screen;
        java.lang.reflect.Field field=activity.getClass().getDeclaredField("exporter");
        field.setAccessible(true);
        Object exporter=field.get(activity);
        java.lang.reflect.Method restore=exporter.getClass()
            .getDeclaredMethod("restoreIntoEmptySource",String.class);
        restore.setAccessible(true);
        Class<?> validator=activity.getClass().getClassLoader()
            .loadClass("dev.bearframe.ridge.LegacyV1Validator");
        java.lang.reflect.Method accepts=validator.getMethod("accepts",String.class);
        boolean sourceValid=(Boolean)accepts.invoke(null,raw);
        // Gallery row 4, x=0 is a LEGITIMATE '<' exit, not a wall.
        // Verify both the outer boundary wall and an interior blocked cell.
        String blocked=new JSONObject(raw).put("x",0).put("y",0).toString();
        String blockedInterior=new JSONObject(raw).put("x",7).put("y",1).toString();
        boolean blockedAccepted=(Boolean)accepts.invoke(null,blocked);
        boolean interiorAccepted=(Boolean)accepts.invoke(null,blockedInterior);
        String exit=new JSONObject(raw).put("x",0).toString();
        boolean exitAccepted=(Boolean)accepts.invoke(null,exit);
        if(!sourceValid||blockedAccepted||interiorAccepted||!exitAccepted)
            throw new AssertionError("Native legacy geometry mismatch: valid="+
                sourceValid+" wallAccepted="+blockedAccepted+
                " interiorWallAccepted="+interiorAccepted+
                " validExitAccepted="+exitAccepted);
        if(!(Boolean)restore.invoke(exporter,raw))
            throw new AssertionError("Native restore rejected valid missing-key backup");
        if(!raw.equals(old.getString("expedition",null))||
           !"preserve".equals(old.getString("other",null)))
            throw new AssertionError("Native restore did not preserve exact old JSON");
        if((Boolean)restore.invoke(exporter,raw.replace("Recovery test","Overwrite attempt")) ||
           !raw.equals(old.getString("expedition",null)))
            throw new AssertionError("Native import overwrote existing original save");
        if(!"false".equals(evalHost("BearframeArchiveExport.canRestoreIntoEmptySource()")))
            throw new AssertionError("UI did not block overwrite after restoration");
        JSONObject after=unifiedSnapshot();
        if(after.getInt("sequence")!=before.getInt("sequence")||
           after.getInt("savedRevision")!=before.getInt("savedRevision"))
            throw new AssertionError("Native restore modified new-engine journal");
        resultMeta.putString("restore","PASS native validation, restore-to-missing-only, no overwrite");
    }
    /** Exercise actual native file-byte export and missing-only restore using
     * a local test URI; the external picker UI itself is NOT exercised here.
     * Starts after the two-process archive test so later source changes exist.
     */
    private void checkUnifiedArchiveFileRoundtrip() throws Exception {
        android.content.SharedPreferences old=getTargetContext()
            .getSharedPreferences("ExpeditionActivity",android.content.Context.MODE_PRIVATE);
        if(!old.contains("expedition"))
            throw new AssertionError("Expected original launcher data before file roundtrip");
        Intent launch=new Intent();
        launch.setClassName("dev.bearframe.ridge","dev.bearframe.ridge.UnifiedEngineActivity");
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        screen=startActivitySync(launch);
        JSONObject baseline=unifiedSnapshot();
        Object rawValue=new JSONTokener(evalHost("BearframeLegacyVault.exactCopy().raw")).nextValue();
        if(!(rawValue instanceof String))
            throw new AssertionError("No checked recovery vault to export");
        String raw=(String)rawValue;
        if(!raw.contains("Archive fixture"))
            throw new AssertionError("Unexpected archive source fixture");
        java.lang.reflect.Field field=screen.getClass().getDeclaredField("exporter");
        field.setAccessible(true);
        Object exporter=field.get(screen);
        java.lang.reflect.Field pending=exporter.getClass().getDeclaredField("pending");
        pending.setAccessible(true);
        pending.set(exporter,raw);
        java.io.File file=new java.io.File(getTargetContext().getFilesDir(),"archive-test.json");
        if(file.exists()&&!file.delete())throw new AssertionError("Cannot reset file fixture");
        Intent chosen=new Intent();
        chosen.setData(Uri.fromFile(file));
        java.lang.reflect.Method result=exporter.getClass().getMethod("onResult",
            int.class,int.class,Intent.class);
        result.invoke(exporter,4917,Activity.RESULT_OK,chosen);
        if(!file.isFile())throw new AssertionError("SAF export result did not write a file");
        String bytes=new String(java.nio.file.Files.readAllBytes(file.toPath()),
            java.nio.charset.StandardCharsets.UTF_8);
        if(!raw.equals(bytes))
            throw new AssertionError("Exported historical JSON differs from archived bytes");
        if(!old.edit().remove("expedition").commit())
            throw new AssertionError("Cannot simulate absent old save");
        java.lang.reflect.Field restoring=exporter.getClass().getDeclaredField("restoring");
        restoring.setAccessible(true);restoring.setBoolean(exporter,true);
        result.invoke(exporter,4918,Activity.RESULT_OK,chosen);
        if(!raw.equals(old.getString("expedition",null))||
           !"unchanged".equals(old.getString("unrelated",null)))
            throw new AssertionError("User-file recovery did not restore original fields");
        String after=evalHost("BearframeArchiveExport.canRestoreIntoEmptySource()");
        if(!"false".equals(after))
            throw new AssertionError("Restored original was not protected against overwrite");
        JSONObject state=unifiedSnapshot();
        if(baseline.getInt("sequence")!=state.getInt("sequence")||
           baseline.getInt("savedRevision")!=state.getInt("savedRevision"))
            throw new AssertionError("File export/import touched portable-engine journal");
        resultMeta.putString("fileRoundtrip",
            "PASS archived JSON export/import byte equality and no overwrite");
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
            if(stage.equals("unified-owner-art")){
                checkUnifiedOwnerArtProfile();
                result.putAll(resultMeta);
                result.putString("route","PASS unified-owner-art");
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
            if(stage.equals("unified-compat-first") || stage.equals("unified-compat-second")){
                checkUnifiedLegacyCompat(stage.equals("unified-compat-second"));
                result.putAll(resultMeta);
                result.putString("route","PASS "+stage);
                finish(Activity.RESULT_OK,result);
                return;
            }
            if(stage.equals("unified-compat-export")){
                checkUnifiedLegacyCompatExport();
                result.putAll(resultMeta);
                result.putString("route","PASS unified-compat-export");
                finish(Activity.RESULT_OK,result);
                return;
            }
            if(stage.equals("unified-compat-file-first") ||
               stage.equals("unified-compat-file-second")){
                checkUnifiedCompatFile(stage.equals("unified-compat-file-second"));
                result.putAll(resultMeta);
                result.putString("route","PASS "+stage);
                finish(Activity.RESULT_OK,result);
                return;
            }
            if(stage.equals("unified-mobile-flow-first") ||
               stage.equals("unified-mobile-flow-second")){
                checkUnifiedMobilePreviewFlow(stage.equals("unified-mobile-flow-second"));
                result.putAll(resultMeta);
                result.putString("route","PASS "+stage);
                finish(Activity.RESULT_OK,result);
                return;
            }
            if(stage.equals("unified-inventory-first") ||
               stage.equals("unified-inventory-second")){
                checkUnifiedRuntimePanels(stage.equals("unified-inventory-second"));
                result.putAll(resultMeta);
                result.putString("route","PASS "+stage);
                finish(Activity.RESULT_OK,result);
                return;
            }
            if(stage.equals("unified-archive-file")){
                checkUnifiedArchiveFileRoundtrip();
                result.putAll(resultMeta);
                result.putString("route","PASS unified-archive-file");
                finish(Activity.RESULT_OK,result);
                return;
            }
            if(stage.equals("unified-archive-first") || stage.equals("unified-archive-second")){
                checkUnifiedArchive(stage.equals("unified-archive-second"));
                result.putAll(resultMeta);
                result.putString("route","PASS "+stage);
                finish(Activity.RESULT_OK,result);
                return;
            }
            if(stage.equals("unified-restore-native")){
                checkUnifiedRestoreNative();
                result.putAll(resultMeta);
                result.putString("route","PASS unified-restore-native");
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
            if(stage.equals("unified-level-first") ||
               stage.equals("unified-level-second")){
                checkUnifiedProgression(stage.equals("unified-level-second"));
                result.putAll(resultMeta);
                result.putString("route","PASS "+stage);
                finish(Activity.RESULT_OK,result);
                return;
            }
            if(stage.equals("unified-party-world-recruit-first") ||
               stage.equals("unified-party-world-recruit-second")){
                checkUnifiedPartyWorldRecruitment(stage.equals("unified-party-world-recruit-second"));
                result.putAll(resultMeta);
                result.putString("route","PASS "+stage);
                finish(Activity.RESULT_OK,result);
                return;
            }
            if(stage.equals("unified-party-world-memory")){
                checkUnifiedPartyWorldMemory();
                result.putAll(resultMeta);
                result.putString("route","PASS unified-party-world-memory");
                finish(Activity.RESULT_OK,result);
                return;
            }
            if(stage.equals("unified-v2-battle-controller")){
                checkUnifiedV2BattleController();
                result.putAll(resultMeta);
                result.putString("route","PASS unified-v2-battle-controller");
                finish(Activity.RESULT_OK,result);
                return;
            }
            if(stage.equals("unified-v2-controller-first") ||
               stage.equals("unified-v2-controller-second")){
                checkUnifiedControllerWorld(stage.equals("unified-v2-controller-second"));
                result.putAll(resultMeta);
                result.putString("route","PASS "+stage);
                finish(Activity.RESULT_OK,result);
                return;
            }
            if(stage.equals("unified-free-movement")){
                checkUnifiedFreeMovement();
                result.putAll(resultMeta);
                result.putString("route","PASS unified-free-movement");
                finish(Activity.RESULT_OK,result);
                return;
            }
            if(stage.equals("unified-ui-settings-first") ||
               stage.equals("unified-ui-settings-second")){
                checkUnifiedUiPreferences(stage.equals("unified-ui-settings-second"));
                result.putAll(resultMeta);
                result.putString("route","PASS "+stage);
                finish(Activity.RESULT_OK,result);
                return;
            }
            if(stage.equals("unified-jrpg-menu")){
                checkUnifiedJrpgMenu();
                result.putAll(resultMeta);
                result.putString("route","PASS unified-jrpg-menu");
                finish(Activity.RESULT_OK,result);
                return;
            }
            if(stage.equals("unified-party-screens-first") ||
               stage.equals("unified-party-screens-second")){
                checkUnifiedPartyWorldScreens(stage.equals("unified-party-screens-second"));
                result.putAll(resultMeta);
                result.putString("route","PASS "+stage);
                finish(Activity.RESULT_OK,result);
                return;
            }
            if(stage.equals("unified-party-world-canvas-first") ||
               stage.equals("unified-party-world-canvas-second")){
                checkUnifiedPartyWorldCanvas(stage.equals("unified-party-world-canvas-second"));
                result.putAll(resultMeta);
                result.putString("route","PASS "+stage);
                finish(Activity.RESULT_OK,result);
                return;
            }
            if(stage.equals("unified-party-world-ui-first") ||
               stage.equals("unified-party-world-ui-second")){
                checkUnifiedPartyWorldUi(stage.equals("unified-party-world-ui-second"));
                result.putAll(resultMeta);
                result.putString("route","PASS "+stage);
                finish(Activity.RESULT_OK,result);
                return;
            }
            if(stage.equals("unified-gear-ui-first") ||
               stage.equals("unified-gear-ui-second")){
                checkUnifiedPartyInventoryUi(stage.equals("unified-gear-ui-second"));
                result.putAll(resultMeta);
                result.putString("route","PASS "+stage);
                finish(Activity.RESULT_OK,result);
                return;
            }
            if(stage.equals("unified-landscape")){
                checkLandscapeViewport();
                checkUnifiedPresentationClock();
                result.putAll(resultMeta);
                result.putString("route","PASS unified-landscape");
                finish(Activity.RESULT_OK,result);
                return;
            }
            if(stage.equals("unified-content-first") ||
               stage.equals("unified-content-second")){
                checkUnifiedContentBinding(stage.equals("unified-content-second"));
                result.putAll(resultMeta);
                result.putString("route","PASS "+stage);
                finish(Activity.RESULT_OK,result);
                return;
            }
            if(stage.equals("unified-v2-world-first") ||
               stage.equals("unified-v2-world-second")){
                checkUnifiedPartyWorldBridge(stage.equals("unified-v2-world-second"));
                result.putAll(resultMeta);
                result.putString("route","PASS "+stage);
                finish(Activity.RESULT_OK,result);
                return;
            }
            if(stage.equals("unified-party-choice")){
                checkUnifiedPartyChoice();
                result.putAll(resultMeta);
                result.putString("route","PASS unified-party-choice");
                finish(Activity.RESULT_OK,result);
                return;
            }
            if(stage.equals("unified-party-first") || stage.equals("unified-party-second")){
                checkUnifiedParty(stage.equals("unified-party-second"));
                result.putAll(resultMeta);
                result.putString("route","PASS "+stage);
                finish(Activity.RESULT_OK,result);
                return;
            }
            if(stage.equals("unified-renderer")){
                checkUnifiedRendererRecovery();
                result.putAll(resultMeta);
                result.putString("route","PASS unified-renderer");
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
            if(stage.equals("unified-focus")){
                checkUnifiedAudioFocus();
                result.putAll(resultMeta);
                result.putString("route","PASS unified-focus");
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

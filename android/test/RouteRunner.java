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
    @Override public void onStart(){
        Bundle result=new Bundle();
        try{
            if(stage.equals("kit")){
                atlasSmoke();
                result.putString("route","PASS kit");
                finish(Activity.RESULT_OK,result);
                return;
            }
            Intent launch=getTargetContext().getPackageManager().getLaunchIntentForPackage("dev.bearframe.ridge");
            launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);screen=startActivitySync(launch);
            if(stage.equals("controller")){
                tap("Awaken");
                Object activityTitle=screen.getClass().getDeclaredField("title");
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

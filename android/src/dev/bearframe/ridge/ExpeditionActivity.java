package dev.bearframe.ridge;

import android.app.Activity;
import android.os.Bundle;
import android.content.Context;
import android.graphics.*;
import android.view.Gravity;
import android.view.View;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.widget.*;
import android.text.InputFilter;
import org.json.*;
import org.mozilla.javascript.*;
import java.io.*;
import java.util.HashMap;

public final class ExpeditionActivity extends Activity {
    private Scriptable scope;
    private Function dispatch;
    private LinearLayout content, options, pad;
    private TextView title, mode, stats, objective, story;
    private ImageView scene;
    private int controllerChoice=-1;
    private boolean controllerWorldMovement;
    private final ControllerInputRouter gamepad=new ControllerInputRouter(new ControllerInputRouter.Listener() {
        @Override public boolean navigate(String direction) { return controllerNavigate(direction); }
        @Override public boolean confirm() { return controllerConfirm(); }
        @Override public boolean cancel() { return controllerCancel(); }
        @Override public boolean menu() { return false; }
        @Override public boolean map() { return false; }
        @Override public boolean pause() { return false; }
        @Override public boolean tab(int delta) { return controllerShift(delta); }
    });
    private final HashMap<String,Bitmap> images=new HashMap<>();
    private final Paint brush=new Paint();
    private final Bitmap field=Bitmap.createBitmap(296,202,Bitmap.Config.ARGB_8888);
    private final Canvas canvas=new Canvas(field);
    private static final int BG=0xff15151d, TEXT=0xffede8f2, ACCENT=0xffcbb8e4;

    @Override public void onCreate(Bundle saved){
        super.onCreate(saved);
        gamepad.setEnabled(false); // Preserve native focus navigation during name/finish creation.
        getWindow().setStatusBarColor(BG);
        getWindow().setNavigationBarColor(BG);
        org.mozilla.javascript.Context js=org.mozilla.javascript.Context.enter();
        try{
            js.setOptimizationLevel(-1);
            js.setLanguageVersion(org.mozilla.javascript.Context.VERSION_ES6);
            scope=js.initSafeStandardObjects();
            try(Reader reader=new InputStreamReader(getAssets().open("simulation.js"),"UTF-8")){
                js.evaluateReader(scope,reader,"simulation",1,null);
            }
            dispatch=(Function)ScriptableObject.getProperty(scope,"nativeDispatch");
            for(String name:new String[]{"sleeper","pod","gallery","ridge"}){
                try(InputStream in=getAssets().open(name+".webp")){
                    images.put(name+".webp",BitmapFactory.decodeStream(in));
                }
            }
        }catch(IOException e){throw new IllegalStateException(e);}
        finally{org.mozilla.javascript.Context.exit();}
        ScrollView scroll=new ScrollView(this);
        scroll.setBackgroundColor(BG);scroll.setFillViewport(true);
        scroll.setOnApplyWindowInsetsListener((v,i)->{
            v.setPadding(i.getSystemWindowInsetLeft(),i.getSystemWindowInsetTop(),
                i.getSystemWindowInsetRight(),i.getSystemWindowInsetBottom());return i;});
        content=column();content.setPadding(dp(16),dp(10),dp(16),dp(14));scroll.addView(content);setContentView(scroll);
        String savedState=getPreferences(MODE_PRIVATE).getString("expedition","");
        JSONObject loaded=call(command("load",savedState));
        if(loaded.has("save")){play();render(loaded);}else intro(!savedState.isEmpty());
    }
    private int dp(float v){return Math.round(getResources().getDisplayMetrics().density*v);}
    private LinearLayout column(){LinearLayout l=new LinearLayout(this);l.setOrientation(LinearLayout.VERTICAL);return l;}
    private LinearLayout row(LinearLayout parent){LinearLayout l=new LinearLayout(this);l.setGravity(Gravity.CENTER);parent.addView(l);return l;}
    private TextView label(LinearLayout parent,String text,float size,int color){
        TextView v=new TextView(this);v.setText(text);v.setTextColor(color);v.setTextSize(size);v.setPadding(0,dp(3),0,dp(3));parent.addView(v);return v;
    }
    private Button button(LinearLayout parent,String text,Runnable action){
        Button b=new Button(this);b.setText(text);b.setAllCaps(false);b.setTextSize(15);
        b.setMinHeight(dp(44));b.setOnClickListener(v->action.run());parent.addView(b);return b;
    }
    private void intro(boolean unreadable){
        label(content,"BEARFRAME LABS   /   SURFACE EXPEDITION",12,ACCENT);
        label(content,"Sounding Ridge",34,TEXT).setTypeface(Typeface.SERIF);
        ImageView portrait=new ImageView(this);portrait.setImageBitmap(images.get("sleeper.webp"));
        portrait.setScaleType(ImageView.ScaleType.FIT_CENTER);content.addView(portrait,-1,dp(152));
        label(content,"Beneath the orbital city, a Guardian keeps watch beside the buried stasis berths. One visor is waking.",16,TEXT);
        if(unreadable)label(content,"The previous expedition could not be read.",14,ACCENT);
        label(content,"Chosen name",14,ACCENT);EditText name=new EditText(this);name.setSingleLine(true);name.setHint("Sleeper");
        name.setFilters(new InputFilter[]{new InputFilter.LengthFilter(18)});content.addView(name);
        label(content,"Chassis finish",14,ACCENT);
        Spinner finish=new Spinner(this);
        finish.setAdapter(new ArrayAdapter<String>(this,android.R.layout.simple_spinner_dropdown_item,new String[]{"Ash","Slate","Ivory"}));
        content.addView(finish);
        button(content,"Awaken",()->{
            JSONObject cmd=command("new","");put(cmd,"name",name.getText().toString());put(cmd,"finish",finish.getSelectedItem().toString());
            ((android.view.inputmethod.InputMethodManager)getSystemService(INPUT_METHOD_SERVICE)).hideSoftInputFromWindow(name.getWindowToken(),0);
            play();render(call(cmd));
        });
    }
    private void play(){
        gamepad.setEnabled(true);
        controllerChoice=-1;
        content.removeAllViews();label(content,"BEARFRAME LABS   /   SURFACE EXPEDITION",12,ACCENT);
        title=label(content,"",26,TEXT);title.setTypeface(Typeface.SERIF);mode=label(content,"",13,ACCENT);
        scene=new ImageView(this);scene.setAdjustViewBounds(true);scene.setImageBitmap(field);scene.setContentDescription("Expedition field");
        content.addView(scene,new LinearLayout.LayoutParams(-1,-2));
        stats=label(content,"",14,TEXT);objective=label(content,"",14,ACCENT);story=label(content,"",16,TEXT);
        options=column();content.addView(options);pad=column();content.addView(pad);
        move(row(pad),"▲","up","Move north");LinearLayout bottom=row(pad);
        move(bottom,"◀","left","Move west");move(bottom,"▼","down","Move south");move(bottom,"▶","right","Move east");
    }
    private void move(LinearLayout parent,String text,String dir,String description){
        Button b=button(parent,text,()->action("move",dir));b.setContentDescription(description);
    }
    private static void put(JSONObject obj,String key,String value){try{obj.put(key,value);}catch(JSONException e){throw new IllegalArgumentException(e);}}
    private static JSONObject command(String type,String value){JSONObject c=new JSONObject();put(c,"type",type);put(c,"value",value);return c;}
    private JSONObject call(JSONObject cmd){
        org.mozilla.javascript.Context js=org.mozilla.javascript.Context.enter();
        try{
            js.setOptimizationLevel(-1);js.setLanguageVersion(org.mozilla.javascript.Context.VERSION_ES6);
            return new JSONObject((String)dispatch.call(js,scope,scope,new Object[]{cmd.toString()}));
        }catch(JSONException e){throw new IllegalStateException(e);}
        finally{org.mozilla.javascript.Context.exit();}
    }
    private void action(String type,String value){render(call(command(type,value)));}
    private void render(JSONObject packet){
        try{
            boolean saved=getPreferences(MODE_PRIVATE).edit().putString("expedition",packet.getString("save")).commit();
            title.setText(packet.getString("title"));mode.setText(packet.getString("mode"));stats.setText(packet.getString("stats"));
            objective.setText(packet.getString("objective"));story.setText(packet.getString("message")+(saved?"":"\nSave unavailable. Keep this session open."));
            draw(packet.getJSONArray("draw"));scene.invalidate();
            options.removeAllViews();controllerChoice=-1;JSONArray choices=packet.getJSONArray("options");
            for(int i=0;i<choices.length();i++){
                JSONArray item=choices.getJSONArray(i);String type=item.getString(0),value=item.getString(1);
                Button choice=button(options,item.getString(2),()->action(type,value));
                choice.setTag(type+":"+value);
                choice.setEnabled(!item.optBoolean(3,false));
            }
            controllerWorldMovement=packet.getBoolean("pad");
            pad.setVisibility(controllerWorldMovement?View.VISIBLE:View.GONE);
        }catch(JSONException e){throw new IllegalStateException(e);}
    }
    /** Physical controllers reuse the same action handlers as touch buttons. */
    private int controllerChoiceCount(){return options==null?0:options.getChildCount();}
    private boolean controllerShift(int delta){
        if(title==null||controllerChoiceCount()==0)return false;
        int count=controllerChoiceCount(),start=controllerChoice<0?(delta>0?-1:0):controllerChoice;
        for(int i=0;i<count;i++){
            int next=(start+delta*(i+1)%count+count*4)%count;
            View candidate=options.getChildAt(next);
            if(candidate instanceof Button && candidate.isEnabled()){
                controllerChoice=next;
                for(int j=0;j<count;j++){
                    Button button=(Button)options.getChildAt(j);
                    boolean selected=j==next;
                    button.setSelected(selected);
                    button.setTypeface(selected?Typeface.DEFAULT_BOLD:Typeface.DEFAULT);
                }
                candidate.requestFocus();
                return true;
            }
        }
        return false;
    }
    private boolean controllerNavigate(String direction){
        if(title==null)return false;
        if(!controllerWorldMovement&&controllerChoiceCount()>0)
            return controllerShift("left".equals(direction)||"up".equals(direction)?-1:1);
        action("move",direction);
        return true;
    }
    private boolean controllerConfirm(){
        if(title==null)return false;
        int count=controllerChoiceCount();
        if(count==0)return false;
        if(controllerChoice<0||controllerChoice>=count||
            !options.getChildAt(controllerChoice).isEnabled()) {
            if(!controllerShift(1))return false;
        }
        return options.getChildAt(controllerChoice).performClick();
    }
    private boolean controllerCancel(){
        if(title==null)return false;
        for(int i=0;i<controllerChoiceCount();i++){
            View option=options.getChildAt(i);
            String tag=String.valueOf(option.getTag());
            if(option.isEnabled()&&("close:".equals(tag)||
                "combat:withdraw".equals(tag)))return option.performClick();
        }
        return false;
    }
    @Override public boolean dispatchKeyEvent(KeyEvent event){
        // While creating a character, native Android manages D-pad focus.
        // Treat controller South as native focused-button/selector activation.
        if(title==null && ControllerInputRouter.isController(event) &&
            event.getKeyCode()==KeyEvent.KEYCODE_BUTTON_A &&
            event.getAction()==KeyEvent.ACTION_DOWN && event.getRepeatCount()==0){
            View focused=getCurrentFocus();
            if(focused instanceof Button || focused instanceof Spinner)
                return focused.performClick();
        }
        if(gamepad.onKeyEvent(event))return true;
        return super.dispatchKeyEvent(event);
    }
    @Override public boolean onGenericMotionEvent(MotionEvent event){
        if(gamepad.onMotionEvent(event))return true;
        return super.onGenericMotionEvent(event);
    }
    @Override protected void onPause(){
        gamepad.clear();
        super.onPause();
    }
    private void color(String css){
        if(css.length()==9)css="#"+css.substring(7)+css.substring(1,7);
        brush.setColor(Color.parseColor(css));brush.setFilterBitmap(false);brush.setAntiAlias(false);
    }
    private void draw(JSONArray commands) throws JSONException{
        for(int i=0;i<commands.length();i++){
            JSONArray cmd=commands.getJSONArray(i);String op=cmd.getString(0);
            switch(op){
                case "rect": {
                    int x=cmd.getInt(1),y=cmd.getInt(2);color(cmd.getString(5));
                    canvas.drawRect(x,y,x+cmd.getInt(3),y+cmd.getInt(4),brush);break;
                }
                case "poly": {
                    JSONArray pts=cmd.getJSONArray(1);Path path=new Path();path.moveTo(pts.getInt(0),pts.getInt(1));
                    for(int j=2;j<pts.length();j+=2)path.lineTo(pts.getInt(j),pts.getInt(j+1));
                    path.close();color(cmd.getString(2));canvas.drawPath(path,brush);break;
                }
                case "save":canvas.save();break;
                case "restore":canvas.restore();break;
                case "translate":canvas.translate((float)cmd.getDouble(1),(float)cmd.getDouble(2));break;
                case "scale":canvas.scale((float)cmd.getDouble(1),(float)cmd.getDouble(2));break;
                case "image":{
                    int x=cmd.getInt(2),y=cmd.getInt(3);
                    brush.setColor(Color.WHITE);canvas.drawBitmap(images.get(cmd.getString(1)),null,
                        new Rect(x,y,x+cmd.getInt(4),y+cmd.getInt(5)),brush);break;
                }
                default:throw new IllegalArgumentException(op);
            }
        }
    }
}

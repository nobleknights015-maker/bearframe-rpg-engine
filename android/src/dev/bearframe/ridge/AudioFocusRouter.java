package dev.bearframe.ridge;

import android.app.Activity;
import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.os.Handler;
import android.os.Looper;
import android.webkit.JavascriptInterface;

/** On-demand, lifecycle-safe Android audio focus for the offline engine.
 * Never persists focus state or plays media directly. */
public final class AudioFocusRouter {
    private final Activity activity;
    private final Runnable lossCallback;
    private AudioManager manager;
    private AudioFocusRequest request;
    private boolean held;
    private final AudioManager.OnAudioFocusChangeListener listener;
    public AudioFocusRouter(Activity activity,Runnable lossCallback) {
        this.activity=activity;
        this.lossCallback=lossCallback;
        this.listener=change->{
            if(change==AudioManager.AUDIOFOCUS_GAIN)return;
            abandon();
            this.activity.runOnUiThread(this.lossCallback);
        };
    }
    @JavascriptInterface public synchronized boolean request() {
        if(held)return true;
        try {
            if(manager==null)manager=(AudioManager)activity.getSystemService(Context.AUDIO_SERVICE);
            if(manager==null)return false;
            if(request==null){
                AudioAttributes attrs=new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_GAME)
                    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build();
                request=new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                    .setAudioAttributes(attrs)
                    .setOnAudioFocusChangeListener(listener,new Handler(Looper.getMainLooper()))
                    .setAcceptsDelayedFocusGain(false).build();
            }
            held=manager.requestAudioFocus(request)==AudioManager.AUDIOFOCUS_REQUEST_GRANTED;
            return held;
        }catch(RuntimeException unavailable){held=false;return false;}
    }
    @JavascriptInterface public synchronized void abandon() {
        if(held&&manager!=null&&request!=null){
            try{manager.abandonAudioFocusRequest(request);}catch(RuntimeException ignored){}
        }
        held=false;
    }
}

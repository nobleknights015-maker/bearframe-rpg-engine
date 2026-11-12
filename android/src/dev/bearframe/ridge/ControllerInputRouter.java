package dev.bearframe.ridge;

import android.os.Handler;
import android.os.Looper;
import android.view.InputDevice;
import android.view.KeyEvent;
import android.view.MotionEvent;

/** Android gamepad adapter. Translates physical events into controller-neutral
 * navigation/confirm/cancel/menu/tab actions without depending on game rules.
 * Native D-pad and left-stick holds use one repeat loop, avoiding duplicate input.
 */
public final class ControllerInputRouter {
    public interface Listener {
        boolean navigate(String direction);
        boolean confirm();
        boolean cancel();
        boolean menu();
        boolean map();
        boolean pause();
        boolean tab(int delta);
    }

    private final Listener listener;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private String axisDirection;
    private String keyDirection;
    private String activeDirection;
    // Separate held directions allow simultaneous physical D-pad diagonals.
    private boolean upHeld,downHeld,leftHeld,rightHeld;
    private long generation = 0;
    private boolean enabled = true;
    private static final int FIRST_REPEAT_MS = 260;
    private static final int REPEAT_MS = 135;

    public ControllerInputRouter(Listener listener) {
        if (listener == null) throw new IllegalArgumentException("Controller listener required");
        this.listener = listener;
    }

    public static boolean isController(KeyEvent event) {
        return event != null && (
            event.isFromSource(InputDevice.SOURCE_GAMEPAD) ||
            event.isFromSource(InputDevice.SOURCE_JOYSTICK) ||
            event.isFromSource(InputDevice.SOURCE_DPAD));
    }

    private static String directionKey(int code) {
        switch (code) {
            case KeyEvent.KEYCODE_DPAD_UP: return "up";
            case KeyEvent.KEYCODE_DPAD_DOWN: return "down";
            case KeyEvent.KEYCODE_DPAD_LEFT: return "left";
            case KeyEvent.KEYCODE_DPAD_RIGHT: return "right";
            default: return null;
        }
    }

    private static String combine(float x,float y,float threshold) {
        String vertical = Math.abs(y)>=threshold ? (y>0 ? "down" : "up") : null;
        String horizontal = Math.abs(x)>=threshold ? (x>0 ? "right" : "left") : null;
        if (vertical!=null && horizontal!=null) return vertical+"-"+horizontal;
        return vertical!=null ? vertical : horizontal;
    }

    private String heldDirection() {
        float x=rightHeld==leftHeld ? 0 : (rightHeld ? 1 : -1);
        float y=downHeld==upHeld ? 0 : (downHeld ? 1 : -1);
        return combine(x,y,0.5f);
    }

    public void setEnabled(boolean value) {
        if (enabled == value) return;
        enabled = value;
        clear();
    }

    public void clear() {
        generation++;
        handler.removeCallbacksAndMessages(null);
        upHeld=downHeld=leftHeld=rightHeld=false;
        keyDirection = null;
        axisDirection = null;
        activeDirection = null;
    }

    private void repeat(final long token) {
        handler.postDelayed(new Runnable() {
            @Override public void run() {
                if (!enabled || token != generation || activeDirection == null) return;
                listener.navigate(activeDirection);
                handler.postDelayed(this, REPEAT_MS);
            }
        }, FIRST_REPEAT_MS);
    }

    private void updateDirection() {
        String wanted = keyDirection != null ? keyDirection : axisDirection;
        if (wanted == null ? activeDirection == null : wanted.equals(activeDirection)) return;
        generation++;
        handler.removeCallbacksAndMessages(null);
        activeDirection = wanted;
        if (enabled && wanted != null) {
            listener.navigate(wanted);
            repeat(generation);
        }
    }

    public boolean onKeyEvent(KeyEvent event) {
        if (!enabled || !isController(event)) return false;
        int code = event.getKeyCode(), action = event.getAction();
        if (action != KeyEvent.ACTION_DOWN && action != KeyEvent.ACTION_UP) return false;
        String direction = directionKey(code);
        if (direction != null) {
            if (action == KeyEvent.ACTION_DOWN && event.getRepeatCount() == 0) {
                switch (code) {
                    case KeyEvent.KEYCODE_DPAD_UP: upHeld=true;break;
                    case KeyEvent.KEYCODE_DPAD_DOWN: downHeld=true;break;
                    case KeyEvent.KEYCODE_DPAD_LEFT: leftHeld=true;break;
                    case KeyEvent.KEYCODE_DPAD_RIGHT: rightHeld=true;break;
                }
            } else if (action == KeyEvent.ACTION_UP) {
                switch (code) {
                    case KeyEvent.KEYCODE_DPAD_UP: upHeld=false;break;
                    case KeyEvent.KEYCODE_DPAD_DOWN: downHeld=false;break;
                    case KeyEvent.KEYCODE_DPAD_LEFT: leftHeld=false;break;
                    case KeyEvent.KEYCODE_DPAD_RIGHT: rightHeld=false;break;
                }
            }
            keyDirection=heldDirection();
            updateDirection();
            return true;
        }

        boolean supported = true;
        switch (code) {
            case KeyEvent.KEYCODE_BUTTON_A:
            case KeyEvent.KEYCODE_DPAD_CENTER:
            case KeyEvent.KEYCODE_BUTTON_1:
                if (action == KeyEvent.ACTION_DOWN && event.getRepeatCount() == 0) return listener.confirm();
                break;
            case KeyEvent.KEYCODE_BUTTON_B:
            case KeyEvent.KEYCODE_BUTTON_2:
                if (action == KeyEvent.ACTION_DOWN && event.getRepeatCount() == 0) return listener.cancel();
                break;
            case KeyEvent.KEYCODE_BUTTON_X:
                if (action == KeyEvent.ACTION_DOWN && event.getRepeatCount() == 0) return listener.menu();
                break;
            case KeyEvent.KEYCODE_BUTTON_Y:
            case KeyEvent.KEYCODE_BUTTON_SELECT:
                if (action == KeyEvent.ACTION_DOWN && event.getRepeatCount() == 0) return listener.map();
                break;
            case KeyEvent.KEYCODE_BUTTON_START:
                if (action == KeyEvent.ACTION_DOWN && event.getRepeatCount() == 0) return listener.pause();
                break;
            case KeyEvent.KEYCODE_BUTTON_L1:
                if (action == KeyEvent.ACTION_DOWN && event.getRepeatCount() == 0) return listener.tab(-1);
                break;
            case KeyEvent.KEYCODE_BUTTON_R1:
                if (action == KeyEvent.ACTION_DOWN && event.getRepeatCount() == 0) return listener.tab(1);
                break;
            default: supported = false;
        }
        return supported;
    }

    public boolean onMotionEvent(MotionEvent event) {
        if (!enabled || event == null ||
            !event.isFromSource(InputDevice.SOURCE_JOYSTICK) ||
            event.getActionMasked() != MotionEvent.ACTION_MOVE) return false;
        float hx = event.getAxisValue(MotionEvent.AXIS_HAT_X);
        float hy = event.getAxisValue(MotionEvent.AXIS_HAT_Y);
        float x = event.getAxisValue(MotionEvent.AXIS_X);
        float y = event.getAxisValue(MotionEvent.AXIS_Y);
        float threshold = axisDirection == null ? 0.48f : 0.30f;
        String direction = null;
        if (Math.abs(hx) >= 0.5f || Math.abs(hy) >= 0.5f) {
            direction=combine(hx,hy,0.5f);
        } else {
            direction=combine(x,y,threshold);
        }
        axisDirection = direction;
        updateDirection();
        return true;
    }
}

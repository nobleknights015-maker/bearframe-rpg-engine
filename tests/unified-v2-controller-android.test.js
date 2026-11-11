const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('unified Android native controller drives semantic v2 actions, never old game namespace',()=>{
 const java=read('android/src/dev/bearframe/ridge/UnifiedEngineActivity.java');
 for(const token of ['ControllerInputRouter','dispatchKeyEvent(KeyEvent event)',
   'onGenericMotionEvent(MotionEvent event)','routeController("navigate",direction)',
   'routeController("confirm",null)','routeController("menu",null)',
   'routeController(delta<0?"previous-tab":"next-tab",null)',
   'controller.clear()','window.BearframeHost.input'])
  assert.ok(java.includes(token),'Missing native bridge '+token);
 assert.match(java,/org\.json\.JSONObject\.quote\(type\)/);
 assert.match(java,/org\.json\.JSONObject\.quote\(direction\)/);
});
test('installed emulator stages cover D-pad, confirm, menu, shoulders, analog and restart',()=>{
 const java=read('android/test/RouteRunner.java');
 const ci=read('.github/workflows/engine-ci.yml');
 for(const token of ['checkUnifiedControllerWorld(boolean restart)',
  'gamepadKey(KeyEvent.KEYCODE_DPAD_RIGHT)',
  'gamepadKey(KeyEvent.KEYCODE_BUTTON_A)',
  'gamepadKey(KeyEvent.KEYCODE_BUTTON_X)',
  'gamepadKey(KeyEvent.KEYCODE_BUTTON_R1)',
  'gamepadKey(KeyEvent.KEYCODE_BUTTON_B)',
  'gamepadAxis(0f,0.9f)','BearframeHost.partyWorld.verifySave()',
  'unified-v2-controller-first','unified-v2-controller-second'])
  assert.ok(java.includes(token),'Missing installed input acceptance '+token);
 assert.match(ci,/stage unified-v2-controller-first/);
 assert.match(ci,/stage unified-v2-controller-second/);
});

const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
function read(p){return fs.readFileSync(path.join(root,p),'utf8');}
test('restricted Android WebView packages the original-rule legacy compat without auto-import',()=>{
 const html=read('enginehost/index.html'),boot=read('enginehost/boot.js');
 const ui=read('enginehost/legacy-compat-ui.js'),build=read('android/build.sh');
 assert.match(html,/legacy\/world\.js/);
 assert.match(html,/legacy\/engine\.js/);
 assert.match(html,/legacy-compat\.js/);
 assert.match(html,/id="legacy-compat-confirm"[^>]*disabled/);
 assert.match(html,/id="legacy-compat-resume"[^>]*disabled/);
 assert.match(boot,/attachBearframeLegacyCompatibilityUI/);
 assert.match(boot,/readLegacyExpedition\(\)/);
 for(const operation of ['preflight','commit','resume','dispatch'])
   assert.match(ui,new RegExp('compat\\.'+operation+'\\('));
 assert.match(build,/cp "\$root\/game\/engine\.js" "\$work\/assets\/enginehost\/legacy\/engine\.js"/);
 assert.match(build,/cp "\$root\/game\/world\.js" "\$work\/assets\/enginehost\/legacy\/world\.js"/);
});
test('installed emulator route requires exact recovery across Android force-stop with old source unmodified',()=>{
 const runner=read('android/test/RouteRunner.java'),ci=read('.github/workflows/engine-ci.yml');
 assert.match(runner,/checkUnifiedLegacyCompat\(boolean restart\)/);
 assert.match(runner,/getSharedPreferences\("ExpeditionActivity"/);
 assert.match(runner,/legacy-compat-preview/);
 assert.match(runner,/legacy-compat-confirm/);
 assert.match(runner,/legacy-compat-resume/);
 assert.match(runner,/Original combat not durably committed/);
 assert.match(runner,/Legacy compatibility overwrote original save/);
 assert.match(ci,/stage unified-compat-first/);
 assert.match(ci,/stage unified-compat-second/);
 assert.match(ci,/route=PASS unified-compat-second/);
});

test('continued original-format save export is checked by native checksum and missing-only restore',()=>{
 const java=read('android/src/dev/bearframe/ridge/LegacyArchiveExport.java');
 const runner=read('android/test/RouteRunner.java');
 const ci=read('.github/workflows/engine-ci.yml');
 const ui=read('enginehost/legacy-compat-ui.js');
 assert.match(java,/private String currentCompat\(\)/);
 assert.match(java,/LegacyV1Validator\.accepts\(original\)/);
 assert.match(java,/first\.sequence>=second\.sequence/);
 assert.match(java,/beginCompatExport\(\)/);
 assert.match(ui,/legacy-compat-export/);
 assert.match(runner,/checkUnifiedLegacyCompatExport\(\)/);
 assert.match(runner,/Latest historical state cannot be exported/);
 assert.match(runner,/Continued progress did not recover into missing old save/);
 assert.match(ci,/stage unified-compat-export/);
 assert.match(ci,/route=PASS unified-compat-export/);
});

const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
test('versioned engine-v1 draft contract retains explicit support and non-release boundaries',()=>{
 const contract=fs.readFileSync(path.join(__dirname,'../docs/ENGINE_V1_FEATURE_CONTRACT.md'),'utf8');
 const gate=fs.readFileSync(path.join(__dirname,'../docs/ENGINE_RELEASE_GATE.md'),'utf8');
 assert.match(contract,/bf-engine-v1-draft\.1/);
 assert.match(contract,/ENGINE RELEASE GATE OPEN/);
 assert.match(contract,/party-combat state v2/);
 assert.match(contract,/Original Rhino game saves/);
 assert.match(contract,/read-only bridge/);
 assert.match(contract,/Moto G 2025/);
 assert.match(contract,/CI APKs use disposable signing keys/);
 assert.match(contract,/not production-ready/);
 assert.match(gate,/ENGINE_V1_FEATURE_CONTRACT\.md/);
});

// Transpile syntax only. Both adapters use the same canonical simulation and drawing source.
const fs=require('node:fs'),path=require('node:path'),ts=require(process.env.TYPESCRIPT_PATH||'typescript');
const root=path.resolve(__dirname,'..');
let source=['game/world.js','game/content-validator.js','game/engine.js','game/draw.js','android/native.js'].map(f=>fs.readFileSync(path.join(root,f),'utf8')).join('\n');
fs.writeFileSync(process.argv[2],ts.transpile(source,{target:ts.ScriptTarget.ES5,module:ts.ModuleKind.None}));

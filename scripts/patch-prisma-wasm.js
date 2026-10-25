const fs = require('fs');
const path = require('path');

const wasmJsPath = path.join(__dirname, '..', 'node_modules', '.prisma', 'client', 'wasm.js');

function patch() {
  if (!fs.existsSync(wasmJsPath)) return;
  let content = fs.readFileSync(wasmJsPath, 'utf8');
  if (content.includes('new WebAssembly.Module')) {
    console.log('[patch-prisma-wasm] Already patched.');
    return;
  }

  content = content.replace(
    /config\.engineWasm\s*=\s*\{[\s\S]*?getQueryEngineWasmModule:\s*async\s*\(\)\s*=>\s*\{[\s\S]*?\}\s*\}/,
    `config.engineWasm = {
  getRuntime: () => require('./query_engine_bg.js'),
  getQueryEngineWasmModule: async () => {
    const fs = require('fs');
    const path = require('path');
    const bytes = fs.readFileSync(path.join(__dirname, 'query_engine_bg.wasm'));
    return new WebAssembly.Module(bytes);
  }
}`
  );

  fs.writeFileSync(wasmJsPath, content, 'utf8');
  console.log('[patch-prisma-wasm] Successfully patched Prisma Wasm client for Windows WDAC / Smart App Control.');
}

patch();


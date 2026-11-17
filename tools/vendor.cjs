const fs = require('node:fs');
fs.mkdirSync('vendor', { recursive: true });
for (const [source, target] of [
  ['mammoth/mammoth.browser.min.js', 'mammoth.browser.min.js'],
  ['dompurify/dist/purify.min.js', 'purify.min.js'],
  ['jszip/dist/jszip.min.js', 'jszip.min.js'],
]) fs.copyFileSync(require.resolve(source), `vendor/${target}`);
fs.copyFileSync('node_modules/mammoth/LICENSE', 'vendor/MAMMOTH-LICENSE');
fs.copyFileSync('node_modules/dompurify/LICENSE', 'vendor/DOMPURIFY-LICENSE');
fs.copyFileSync('node_modules/jszip/LICENSE.markdown', 'vendor/JSZIP-LICENSE');

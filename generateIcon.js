const fs = require('fs');
const b64 = fs.readFileSync('browser.jpg').toString('base64');
fs.mkdirSync('src/nightcordplugins/privateBrowser/components', {recursive: true});
fs.writeFileSync('src/nightcordplugins/privateBrowser/icon.ts', 'export const browserBase64 = "' + b64 + '";');

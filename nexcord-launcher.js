const { spawn, execSync } = require('child_process'); 
const path = require('path'); 
const fs = require('fs'); 
const os = require('os'); 
 
console.log('[NexCord] Launcher iniciado'); 
 
try { execSync('taskkill /F /IM Discord.exe', {stdio: 'ignore'}); } catch(e) {} 
try { execSync('taskkill /F /IM NexCord.exe', {stdio: 'ignore'}); } catch(e) {} 
 
const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'); 
const discordBase = path.join(localAppData, 'Discord'); 
let discordApp = null; 
 
if (fs.existsSync(discordBase)) { 
    const dirs = fs.readdirSync(discordBase).filter(d => /^app-\\d/.test(d)).sort().reverse(); 
    if (dirs.length > 0) discordApp = path.join(discordBase, dirs[0]); 
} 
 
if (!discordApp) { 
    console.error('[NexCord] No se encontro Discord instalado'); 
    process.exit(1); 
} 
 
console.log('[NexCord] Discord encontrado:', discordApp); 
 
const sourceApp = path.join(__dirname, 'resources', 'app'); 
const destApp = path.join(discordApp, 'resources', 'app'); 
 
if (fs.existsSync(sourceApp)) { 
    fs.cpSync(sourceApp, destApp, { recursive: true, force: true }); 
    console.log('[NexCord] Patcher copiado'); 
} 
 
const discordExe = path.join(discordApp, 'Discord.exe'); 
spawn(discordExe, [], { detached: true, stdio: 'ignore' }).unref(); 
console.log('[NexCord] Discord abierto'); 

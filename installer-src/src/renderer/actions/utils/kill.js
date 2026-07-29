/**
 * Exact port of C# KillDiscord() and StartDiscord() from Program.cs
 * — Amélioré : tue TOUS les processus Discord (helpers, renderers, Update.exe)
 *   pour s'assurer que app.asar est libéré avant le rename.
 */
const path = require("path");
const fs   = require("fs");
const {execSync, execFileSync, exec} = require("child_process");

/**
 * Determine the Discord process name from the resources path.
 * Mirrors: resPath.Contains("DiscordPTB") ? "DiscordPTB" : ...
 */
function getProcName(resPath) {
    if (resPath.includes("DiscordPTB"))          return "DiscordPTB";
    if (resPath.includes("DiscordCanary"))        return "DiscordCanary";
    if (resPath.includes("DiscordDevelopment"))   return "DiscordDevelopment";
    return "Discord";
}

/**
 * Tuer un processus par nom (force + arbre de processus enfants).
 */
function killByName(name) {
    try { execSync(`taskkill /IM "${name}" /F /T`, { stdio: "ignore" }); } catch (_) {}
}

/**
 * Vérifie si un processus est encore en cours via tasklist.
 */
function isRunning(exeName) {
    try {
        const out = execSync(`tasklist /FI "IMAGENAME eq ${exeName}" /NH`, { encoding: "utf8" });
        return out.toLowerCase().includes(exeName.toLowerCase());
    } catch (_) { return false; }
}

/**
 * Attendre (de façon synchrone-bloquante) que le processus disparaisse,
 * ou jusqu'au timeout en ms.
 */
function waitForExit(exeName, timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (!isRunning(exeName)) return true;
        const slice = Date.now() + 200;
        while (Date.now() < slice) {}
    }
    return !isRunning(exeName);
}

/**
 * Attendre (synchrone) un certain nombre de ms.
 */
function sleep(ms) {
    const end = Date.now() + ms;
    while (Date.now() < end) {}
}

/**
 * Improved KillDiscord:
 *  1. Tue le process principal
 *  2. Tue les processus Helper / Renderer (qui gardent app.asar ouvert)
 *  3. Tue Update.exe si présent dans le dossier parent
 *  4. Attend que tous les process soient partis (jusqu'à 8s)
 *  5. Attend 1.5s supplémentaires pour que Windows libère les handles
 */
export function killDiscord(resPath, log) {
    const procName = getProcName(resPath);
    const exeName  = procName + ".exe";

    if (log) log(`Fermeture de ${procName}...`);

    // ── Étape 1 : tuer le process principal et ses variantes ──
    killByName(exeName);

    // Discord crée des sous-processus avec des noms du type :
    //   Discord Helper.exe, Discord Helper (GPU).exe, etc.
    // On les tue tous.
    const helperVariants = [
        `${procName} Helper.exe`,
        `${procName} Helper (GPU).exe`,
        `${procName} Helper (Plugin).exe`,
        `${procName} Helper (Renderer).exe`,
    ];
    for (const h of helperVariants) killByName(h);

    // ── Étape 2 : tuer Update.exe dans le dossier parent (il tient app.asar) ──
    // resPath = …\DiscordCanary\app-X.X.XXXX\resources
    //  → parent      = …\DiscordCanary\app-X.X.XXXX
    //  → grandparent = …\DiscordCanary
    try {
        const appVersionDir = path.join(resPath, "..");
        const channelDir    = path.join(appVersionDir, "..");
        const updateExe     = path.join(channelDir, "Update.exe");
        if (fs.existsSync(updateExe)) {
            // Tuer par chemin complet via wmic pour être précis
            try {
                execSync(
                    `wmic process where "ExecutablePath='${updateExe.replace(/\\/g, "\\\\")}'" delete`,
                    { stdio: "ignore" }
                );
            } catch (_) {}
            // Fallback : taskkill par nom
            killByName("Update.exe");
        }
    } catch (_) {}

    // ── Étape 3 : attendre la disparition du process principal (jusqu'à 8s) ──
    const exited = waitForExit(exeName, 8000);
    if (log && !exited) log(`⚠️ ${procName} est encore actif après 8s — on continue quand même...`);

    // ── Étape 4 : pause supplémentaire pour laisser Windows libérer les handles ──
    // Windows garde parfois les handles de fichiers ouverts quelques centaines
    // de ms après la mort du process — nécessaire pour éviter EBUSY.
    sleep(1500);

    if (log) log(`✅ ${procName} fermé.`);
}

/**
 * Port of C# StartDiscord(resPath):
 *   var exe = Path.Combine(Path.GetDirectoryName(resPath), "..", "Update.exe");
 *   if (File.Exists(exe)) Process.Start(exe, "--processStart Discord.exe");
 */
export function startDiscord(resPath) {
    const procName = getProcName(resPath);
    const exeName  = procName + ".exe";
    // resPath = app-X.X.XXXX\resources  →  go up 2 levels to get to the Discord channel dir
    const updateExe = path.join(resPath, "..", "..", "Update.exe");
    if (fs.existsSync(updateExe)) {
        try {
            exec(`"${updateExe}" --processStart ${exeName}`);
        } catch (_) {}
    }
}
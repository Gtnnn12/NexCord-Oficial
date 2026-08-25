```js
/*
 * NexCord Installer
 *
 * Instala/desinstala NexCord en la instalación existente de Discord.
 *
 * IMPORTANTE:
 * - No solicita credenciales.
 * - No solicita contraseña.
 * - No solicita token.
 * - No crea una segunda sesión de Discord.
 * - Utiliza la sesión que ya existe en Discord.
 * - Utiliza únicamente el EquilotlCli.exe local.
 * - Verifica el SHA-256 del instalador antes de ejecutarlo.
 *
 * Uso:
 *   pnpm inject
 *   pnpm uninject
 *   pnpm repair
 */

import "./checkNodeVersion.js";

import { execFileSync, exec } from "child_process";
import {
    createHash
} from "crypto";
import {
    existsSync,
    mkdirSync,
    readFileSync,
    readdirSync,
    renameSync,
    rmSync
} from "fs";
import {
    dirname,
    join
} from "path";
import {
    fileURLToPath
} from "url";

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURACIÓN
// ─────────────────────────────────────────────────────────────────────────────

const BASE_DIR = join(
    dirname(fileURLToPath(import.meta.url)),
    ".."
);

const FILE_DIR = join(
    BASE_DIR,
    "dist",
    "Installer"
);

const INSTALLER_PATH = join(
    FILE_DIR,
    "EquilotlCli.exe"
);

// SHA-256 del EquilotlCli.exe que ya tienes.
// Si el archivo cambia, el instalador se detendrá.
const EXPECTED_INSTALLER_SHA256 =
    "79932382d859747318f642c3e23297c7a0174398cc489e8fb4222cc2758c16e8";

// ─────────────────────────────────────────────────────────────────────────────
// UTILIDADES
// ─────────────────────────────────────────────────────────────────────────────

function sha256File(filePath) {
    const data = readFileSync(filePath);

    return createHash("sha256")
        .update(data)
        .digest("hex")
        .toLowerCase();
}

function verifyInstaller() {
    if (!existsSync(INSTALLER_PATH)) {
        throw new Error(
            `No se encontró el instalador local:\n${INSTALLER_PATH}`
        );
    }

    console.log("[NexCord] Verificando instalador...");

    const hash = sha256File(INSTALLER_PATH);

    if (hash !== EXPECTED_INSTALLER_SHA256) {
        throw new Error(
            [
                "El hash del instalador no coincide.",
                "",
                `Esperado: ${EXPECTED_INSTALLER_SHA256}`,
                `Actual:   ${hash}`,
                "",
                "NexCord no ejecutará este archivo."
            ].join("\n")
        );
    }

    console.log("[NexCord] Instalador verificado.");
}

// ─────────────────────────────────────────────────────────────────────────────
// DISCORD
// ─────────────────────────────────────────────────────────────────────────────

function getDiscordChannels() {
    if (process.platform !== "win32") {
        return [];
    }

    const localAppData =
        process.env.LOCALAPPDATA || "";

    return [
        "Discord",
        "DiscordPTB",
        "DiscordCanary",
        "DiscordDevelopment"
    ].map(channel => ({
        channel,
        base: join(localAppData, channel)
    }));
}

function findDiscordVersions(base) {
    if (!existsSync(base)) {
        return [];
    }

    try {
        return readdirSync(base)
            .filter(name =>
                /^app-\d+\.\d+\.\d+$/.test(name)
            )
            .sort((a, b) =>
                b.localeCompare(a, undefined, {
                    numeric: true
                })
            );
    } catch {
        return [];
    }
}

function findInstalledDiscord() {
    for (const { channel, base } of getDiscordChannels()) {
        const versions = findDiscordVersions(base);

        if (versions.length === 0) {
            continue;
        }

        const version = versions[0];

        return {
            channel,
            base,
            version,
            appDir: join(base, version),
            resourcesDir: join(
                base,
                version,
                "resources"
            )
        };
    }

    throw new Error(
        "No se encontró una instalación de Discord."
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTUALIZACIONES INCOMPLETAS
// ─────────────────────────────────────────────────────────────────────────────

function cleanIncompleteDiscordUpdates() {
    if (process.platform !== "win32") {
        return;
    }

    for (const { base } of getDiscordChannels()) {
        if (!existsSync(base)) {
            continue;
        }

        let versions;

        try {
            versions = readdirSync(base)
                .filter(name =>
                    /^app-\d+\.\d+\.\d+$/.test(name)
                );
        } catch {
            continue;
        }

        for (const version of versions) {
            const versionDir = join(
                base,
                version
            );

            const resourcesDir = join(
                versionDir,
                "resources"
            );

            const appAsar = join(
                resourcesDir,
                "app.asar"
            );

            const backupAsar = join(
                resourcesDir,
                "_app.asar"
            );

            // Solo eliminar versiones realmente incompletas.
            if (
                existsSync(versionDir) &&
                !existsSync(appAsar) &&
                !existsSync(backupAsar)
            ) {
                try {
                    rmSync(
                        versionDir,
                        {
                            recursive: true,
                            force: true
                        }
                    );

                    console.log(
                        `[NexCord] Eliminada actualización incompleta: ${versionDir}`
                    );
                } catch (error) {
                    console.warn(
                        `[NexCord] No se pudo eliminar ${versionDir}: ${error.message}`
                    );
                }
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// LIMPIEZA / RESTAURACIÓN
// ─────────────────────────────────────────────────────────────────────────────

function cleanPreviousInstallation(isUninstall) {
    console.log(
        "[NexCord] Comprobando instalaciones anteriores..."
    );

    let cleaned = false;

    for (const { resourcesDir } of getDiscordChannels()) {
        if (!existsSync(resourcesDir)) {
            continue;
        }

        const appDir = join(
            resourcesDir,
            "app"
        );

        const appAsar = join(
            resourcesDir,
            "app.asar"
        );

        const backupAsar = join(
            resourcesDir,
            "_app.asar"
        );

        try {
            // Si existe nuestro app/loader anterior,
            // eliminarlo antes de reinstalar.
            if (existsSync(appDir)) {
                let isNexCordApp = false;

                try {
                    const packageJson = join(
                        appDir,
                        "package.json"
                    );

                    if (existsSync(packageJson)) {
                        const pkg = JSON.parse(
                            readFileSync(
                                packageJson,
                                "utf8"
                            )
                        );

                        isNexCordApp =
                            pkg.name === "discord" ||
                            pkg.name === "nexcord" ||
                            pkg.name === "nightcord";
                    }
                } catch {
                    isNexCordApp = false;
                }

                if (isNexCordApp && backupAsar) {
                    rmSync(
                        appDir,
                        {
                            recursive: true,
                            force: true
                        }
                    );

                    cleaned = true;

                    console.log(
                        `[NexCord] Loader anterior eliminado: ${resourcesDir}`
                    );
                }
            }

            // Desinstalación:
            // restaurar el app.asar original.
            if (
                isUninstall &&
                existsSync(backupAsar)
            ) {
                if (existsSync(appAsar)) {
                    rmSync(
                        appAsar,
                        {
                            recursive: true,
                            force: true
                        }
                    );
                }

                renameSync(
                    backupAsar,
                    appAsar
                );

                cleaned = true;

                console.log(
                    `[NexCord] Discord original restaurado: ${resourcesDir}`
                );
            }
        } catch (error) {
            console.error(
                `[NexCord] Error en ${resourcesDir}:`,
                error.message
            );
        }
    }

    if (cleaned) {
        console.log(
            "[NexCord] Limpieza completada."
        );
    } else {
        console.log(
            "[NexCord] No había instalaciones anteriores que limpiar."
        );
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// ABRIR DISCORD
// ─────────────────────────────────────────────────────────────────────────────

function launchDiscord() {
    if (process.platform !== "win32") {
        return;
    }

    const discord = findInstalledDiscord();

    const updateExe = join(
        discord.base,
        "Update.exe"
    );

    const exeName =
        `${discord.channel}.exe`;

    if (existsSync(updateExe)) {
        console.log(
            `[NexCord] Abriendo ${discord.channel}...`
        );

        exec(
            `"${updateExe}" --processStart ${exeName}`
        );

        return;
    }

    const directExe = join(
        discord.appDir,
        `${discord.channel}.exe`
    );

    if (existsSync(directExe)) {
        console.log(
            `[NexCord] Abriendo ${discord.channel}...`
        );

        exec(`"${directExe}"`);

        return;
    }

    console.warn(
        "[NexCord] No se pudo localizar el ejecutable de Discord."
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// ARGUMENTOS
// ─────────────────────────────────────────────────────────────────────────────

const argStart =
    process.argv.indexOf("--");

const args =
    argStart === -1
        ? process.argv.slice(2)
        : process.argv.slice(argStart + 1);

const isUninstall =
    args.includes("--uninstall");

const isRepair =
    args.includes("--repair");

// ─────────────────────────────────────────────────────────────────────────────
// EJECUCIÓN
// ─────────────────────────────────────────────────────────────────────────────

try {
    cleanIncompleteDiscordUpdates();

    cleanPreviousInstallation(
        isUninstall
    );

    if (isUninstall) {
        console.log(
            "[NexCord] Desinstalación completada."
        );

        process.exit(0);
    }

    if (!isRepair) {
        const patcherPath = join(
            BASE_DIR,
            "dist",
            "desktop",
            "patcher.js"
        );

        if (!existsSync(patcherPath)) {
            throw new Error(
                "No existe dist/desktop/patcher.js. Ejecuta pnpm build primero."
            );
        }
    }

    // Nunca descargar un instalador externo automáticamente.
    verifyInstaller();

    const mappedArgs = args.map(arg => {
        if (arg === "--install") {
            return "-install";
        }

        if (arg === "--repair") {
            return "-repair";
        }

        return arg;
    });

    if (
        !mappedArgs.includes("-branch") &&
        !mappedArgs.includes("--branch")
    ) {
        mappedArgs.push(
            "-branch",
            "auto"
        );
    }

    console.log(
        "[NexCord] Instalando NexCord en Discord..."
    );

    /*
     * Estas variables solamente indican al inyector
     * dónde están los archivos compilados de NexCord.
     *
     * No contienen credenciales.
     * No contienen tokens.
     * No contienen contraseñas.
     */

    execFileSync(
        INSTALLER_PATH,
        mappedArgs,
        {
            stdio: "inherit",

            env: {
                ...process.env,

                EQUICORD_USER_DATA_DIR:
                    BASE_DIR,

                EQUICORD_DIRECTORY:
                    join(
                        BASE_DIR,
                        "dist",
                        "desktop"
                    ),

                EQUICORD_DEV_INSTALL:
                    "1",

                NIGHTCORD_DIRECTORY:
                    join(
                        BASE_DIR,
                        "dist",
                        "desktop"
                    )
            }
        }
    );

    console.log(
        "[NexCord] Instalación completada."
    );

    console.log(
        "[NexCord] Se utilizará la sesión existente de Discord."
    );

    launchDiscord();
} catch (error) {
    console.error("");
    console.error(
        "[NexCord] ERROR:"
    );
    console.error(
        error?.message || error
    );

    process.exit(1);
}
```

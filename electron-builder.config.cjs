const { execSync } = require("child_process");

const {
    readFileSync,
    writeFileSync,
    existsSync,
    readdirSync,
    statSync,
    mkdirSync,
    cpSync,
    rmSync
} = require("fs");

const { join } = require("path");

const NEXCORD_VERSION = "1.26.4";
const DISCORD_VERSION = "1.0.9254";

function killNexCord() {
    for (const processName of [
        "Discord",
        "NexCord",
        "electron"
    ]) {
        try {
            execSync(
                `taskkill /F /IM ${processName}.exe`,
                {
                    stdio: "ignore",
                    shell: true
                }
            );
        } catch (_) {}
    }
}

function findDiscordApp() {
    const base = join(
        process.env.LOCALAPPDATA,
        "Discord"
    );

    if (!existsSync(base)) {
        throw new Error(
            `No existe la instalaciÃ³n de Discord: ${base}`
        );
    }

    let best = null;
    let bestVer = [0, 0, 0];

    for (const entry of readdirSync(base)) {
        const match = entry.match(
            /^app-(\d+)\.(\d+)\.(\d+)$/
        );

        if (!match) {
            continue;
        }

        const version = [
            Number(match[1]),
            Number(match[2]),
            Number(match[3])
        ];

        if (
            version[0] > bestVer[0] ||
            (
                version[0] === bestVer[0] &&
                version[1] > bestVer[1]
            ) ||
            (
                version[0] === bestVer[0] &&
                version[1] === bestVer[1] &&
                version[2] > bestVer[2]
            )
        ) {
            bestVer = version;
            best = join(base, entry);
        }
    }

    if (!best) {
        throw new Error(
            "No se encontrÃ³ ninguna instalaciÃ³n app-X.X.X de Discord."
        );
    }

    console.log(
        `[nexcord] Discord encontrado: ${best}`
    );

    return best;
}

function verifyDiscordApp(discordApp) {
    const discordExe = join(
        discordApp,
        "Discord.exe"
    );

    if (!existsSync(discordExe)) {
        throw new Error(
            `No se encontrÃ³ Discord.exe en ${discordApp}`
        );
    }

    const versionInfo = execSync(
        `powershell -NoProfile -Command "(Get-Item '${discordExe.replace(/'/g, "''")}').VersionInfo | Select-Object -ExpandProperty FileVersion"`,
        {
            encoding: "utf8",
            shell: true
        }
    ).trim();

    console.log(
        `[nexcord] Discord.exe original: ${versionInfo}`
    );

    if (versionInfo !== DISCORD_VERSION) {
        console.warn(
            `[nexcord] ADVERTENCIA: se esperaba Discord ${DISCORD_VERSION}, pero se encontrÃ³ ${versionInfo}.`
        );
    }
}

function buildNexCord() {
    console.log("[build] Compilando NexCord...");

    execSync(
        "node --require=./scripts/suppressExperimentalWarnings.js scripts/build/build.mjs --standalone",
        {
            stdio: "inherit"
        }
    );
}

function copyDirectoryContents(source, destination) {
    mkdirSync(
        destination,
        {
            recursive: true
        }
    );

    for (const item of readdirSync(source)) {
        cpSync(
            join(source, item),
            join(destination, item),
            {
                recursive: true,
                force: true
            }
        );
    }
}

function buildNexCordFromDiscord(discordApp) {
    const discordRes = join(
        discordApp,
        "resources"
    );

    const outDir = join(
        __dirname,
        "release",
        "nexcord-dist"
    );

    if (existsSync(outDir)) {
        rmSync(
            outDir,
            {
                recursive: true,
                force: true
            }
        );
    }

    mkdirSync(
        outDir,
        {
            recursive: true
        }
    );

    console.log(
        "[nexcord] Preparando copia de Discord..."
    );

    /*
     * ================================================================
     * IMPORTANTE
     * ================================================================
     *
     * NO sustituimos Discord.exe por electron.exe de node_modules.
     *
     * Discord.exe es un ejecutable propio de Discord aunque internamente
     * utilice Electron 42.7.1.
     *
     * Sustituirlo por electron.exe rompe la combinaciÃ³n:
     *
     *     Discord.exe
     *     + snapshots
     *     + mÃ³dulos
     *     + recursos
     *
     * y puede provocar EXCEPTION_BREAKPOINT dentro de V8.
     *
     * Por eso copiamos TODO el directorio original de Discord excepto
     * "resources", que reconstruiremos debajo.
     *
     * Esto conserva:
     *
     *     Discord.exe
     *     snapshot_blob.bin
     *     v8_context_snapshot.bin
     *     icudtl.dat
     *     dlls
     *     locales
     *     modules
     *     updater.node
     *     Data
     *     etc.
     */

    for (const file of readdirSync(discordApp)) {
        if (file === "resources") {
            continue;
        }

        const source = join(
            discordApp,
            file
        );

        const destination = join(
            outDir,
            file
        );

        try {
            cpSync(
                source,
                destination,
                {
                    recursive: true,
                    force: true
                }
            );
        } catch (error) {
            console.warn(
                `[nexcord] No se pudo copiar ${file}: ${error.message}`
            );
        }
    }

    /*
     * VerificaciÃ³n crÃ­tica del ejecutable.
     */

    const sourceDiscordExe = join(
        discordApp,
        "Discord.exe"
    );

    const outputDiscordExe = join(
        outDir,
        "Discord.exe"
    );

    if (!existsSync(outputDiscordExe)) {
        throw new Error(
            "No se copiÃ³ Discord.exe original."
        );
    }

    console.log(
        "[nexcord] Discord.exe original conservado."
    );

    /*
     * ================================================================
     * MODULES
     * ================================================================
     */

    const outModules = join(
        outDir,
        "modules"
    );

    const discordModules = join(
        discordApp,
        "modules"
    );

    if (existsSync(discordModules)) {
        rmSync(
            outModules,
            {
                recursive: true,
                force: true
            }
        );

        copyDirectoryContents(
            discordModules,
            outModules
        );

        console.log(
            "[nexcord] modules copiado."
        );
    }

    /*
     * ================================================================
     * RESOURCES
     * ================================================================
     */

    const outRes = join(
        outDir,
        "resources"
    );

    mkdirSync(
        outRes,
        {
            recursive: true
        }
    );

    /*
     * ================================================================
     * NIGHTCORD ASAR
     * ================================================================
     */

    const nightcordAsar = join(
        __dirname,
        "dist",
        "nightcord.asar"
    );

    if (!existsSync(nightcordAsar)) {
        throw new Error(
            "No se encontrÃ³ dist/nightcord.asar. Ejecuta primero el build."
        );
    }

    cpSync(
        nightcordAsar,
        join(
            outRes,
            "nightcord.asar"
        ),
        {
            force: true
        }
    );

    console.log(
        "[nexcord] nightcord.asar copiado."
    );

    /*
     * ================================================================
     * BUILD INFO
     * ================================================================
     */

    const buildInfoSrc = join(
        discordRes,
        "build_info.json"
    );

    if (existsSync(buildInfoSrc)) {
        const buildInfo = JSON.parse(
            readFileSync(
                buildInfoSrc,
                "utf8"
            )
        );

        buildInfo.newUpdater = false;

        writeFileSync(
            join(
                outRes,
                "build_info.json"
            ),
            JSON.stringify(
                buildInfo,
                null,
                2
            )
        );
    }

    /*
     * ================================================================
     * BOOTSTRAP
     * ================================================================
     */

    const bootstrapSrc = join(
        discordRes,
        "bootstrap"
    );

    const bootstrapDst = join(
        outRes,
        "bootstrap"
    );

    if (existsSync(bootstrapSrc)) {
        cpSync(
            bootstrapSrc,
            bootstrapDst,
            {
                recursive: true,
                force: true
            }
        );
    }

    /*
     * ================================================================
     * DISCORD ORIGINAL _app.asar
     * ================================================================
     *
     * Este archivo se conserva intacto.
     */

    console.log(
        "[nexcord] Copiando _app.asar original de Discord..."
    );

    let appAsarSrc = join(
        discordRes,
        "_app.asar"
    );

    if (!existsSync(appAsarSrc)) {
        appAsarSrc = join(
            discordRes,
            "app.asar"
        );
    }

    if (!existsSync(appAsarSrc)) {
        throw new Error(
            "No se encontrÃ³ _app.asar ni app.asar original de Discord."
        );
    }

    cpSync(
        appAsarSrc,
        join(
            outRes,
            "_app.asar"
        ),
        {
            force: true
        }
    );

    console.log(
        "[nexcord] _app.asar original conservado."
    );

    /*
     * ================================================================
     * RESOURCES/APP
     * ================================================================
     *
     * Esta es nuestra entrada de NexCord.
     */

    const outApp = join(
        outRes,
        "app"
    );

    mkdirSync(
        outApp,
        {
            recursive: true
        }
    );

    writeFileSync(
        join(
            outApp,
            "package.json"
        ),
        JSON.stringify(
            {
                name: "discord",
                version: NEXCORD_VERSION,
                main: "index.js"
          },
            null,
            2
        )
    );

    writeFileSync(
        join(
            outApp,
            "index.js"
        ),
        `"use strict";

const path = require("path");
const { app } = require("electron");

app.setAppUserModelId("com.squirrel.Discord.Discord");

require(
    path.join(
        __dirname,
        "dist",
        "desktop",
        "patcher.js"
    )
);
`
    );

    /*
     * ================================================================
     * NEXCORD DESKTOP
     * ================================================================
     */

    const outDist = join(
        outApp,
        "dist",
        "desktop"
    );

    mkdirSync(
        outDist,
        {
            recursive: true
        }
    );

    const nexcordDist = join(
        __dirname,
        "dist",
        "desktop"
    );

    for (const file of [
        "patcher.js",
        "renderer.js",
        "renderer.css",
        "renderer.js.LEGAL.txt"
    ]) {
        const source = join(
            nexcordDist,
            file
        );

        if (existsSync(source)) {
            cpSync(
                source,
                join(
                    outDist,
                    file
                ),
                {
                    force: true
                }
            );
        }
    }

    /*
     * ================================================================
     * PRELOAD
     * ================================================================
     */

    const nexcordPreload = join(
        __dirname,
        "nightcord-preload.js"
    );

    if (existsSync(nexcordPreload)) {
        cpSync(
            nexcordPreload,
            join(
                outDist,
                "preload.js"
            ),
            {
                force: true
            }
        );
    }

    /*
     * ================================================================
     * FFMPEG / YT-DLP
     * ================================================================
     */

    const binDir = join(
        __dirname,
        "static",
        "bin"
    );

    for (const file of [
        "ffmpeg.exe",
        "yt-dlp.exe"
    ]) {
        const source = join(
            binDir,
            file
        );

        if (existsSync(source)) {
            cpSync(
                source,
                join(
                    outDir,
                    file
                ),
                {
                    force: true
                }
            );
        }
    }

    /*
     * ================================================================
     * MAC
     * ================================================================
     */

    const macCursorsSrc = join(
        __dirname,
        "mac"
    );

    if (existsSync(macCursorsSrc)) {
        cpSync(
            macCursorsSrc,
            join(
                outRes,
                "mac"
            ),
            {
                recursive: true,
                force: true
            }
        );
    }

    /*
     * ================================================================
     * VERIFICACIÃ“N FINAL
     * ================================================================
     */

    const finalExe = join(
        outDir,
        "Discord.exe"
    );

    if (!existsSync(finalExe)) {
        throw new Error(
            "ERROR CRÃTICO: falta Discord.exe en nexcord-dist."
        );
    }

    const sourceSize = statSync(
        sourceDiscordExe
    ).size;

    const finalSize = statSync(
        finalExe
    ).size;

    if (sourceSize !== finalSize) {
        throw new Error(
            `ERROR CRÃTICO: Discord.exe fue alterado durante el build. Original=${sourceSize}, final=${finalSize}`
        );
    }

    console.log(
        `[nexcord] Discord.exe verificado: ${finalSize} bytes`
    );

    console.log(
        `[nexcord] Build terminado -> ${outDir}`
    );
}

function copyNexCordToPackagedApp(context) {
    const source = join(
        __dirname,
        "release",
        "nexcord-dist"
    );

    const destination = context.appOutDir;

    console.log(
        "[nexcord] Copiando NexCord al paquete final..."
    );

    if (!existsSync(source)) {
        throw new Error(
            "No existe release/nexcord-dist"
        );
    }

    for (const item of readdirSync(source)) {
        const sourcePath = join(
            source,
            item
        );

        const destinationPath = join(
            destination,
            item
        );

        try {
            cpSync(
                sourcePath,
                destinationPath,
                {
                    recursive: true,
                    force: true
                }
            );
        } catch (error) {
            throw new Error(
                `[nexcord] No se pudo copiar ${item}: ${error.message}`
            );
        }
    }

    /*
     * VerificaciÃ³n de que electron-builder no nos cambiÃ³ el ejecutable.
     */

    const sourceExe = join(
        source,
        "Discord.exe"
    );

    const destinationExe = join(
        destination,
        "Discord.exe"
    );

    if (
        existsSync(sourceExe) &&
        existsSync(destinationExe)
    ) {
        const sourceSize = statSync(
            sourceExe
        ).size;

        const destinationSize = statSync(
            destinationExe
        ).size;

        if (sourceSize !== destinationSize) {
            throw new Error(
                `[nexcord] Discord.exe cambiÃ³ durante afterPack: source=${sourceSize}, destination=${destinationSize}`
            );
        }
    }

    console.log(
        "[nexcord] NexCord copiado correctamente."
    );
}

killNexCord();

const discord = findDiscordApp();

verifyDiscordApp(discord);

buildNexCord();

buildNexCordFromDiscord(discord);

module.exports = {
    appId: "com.nexcord.app",

    productName: "NexCord",

    copyright: "Copyright 2026 NexCord",

    buildVersion: NEXCORD_VERSION,

    extraMetadata: {
        main: "index.js",
        version: NEXCORD_VERSION
    },

    asar: false,

    extraFiles: [
        {
            from: "nexcord-launcher.js",
            to: "nexcord-launcher.js"
        }
    ],
    files: [
        "instalador.ps1",
        "index.js",
        "dist/desktop/**/*",
        {
            from: "resources/app",
            to: "resources/app"
        },
        "nexcord-launcher.bat",
        "!**/*.map",
        "!**/*.ts"
    ],

    directories: {
        output: "release",
        buildResources: "desktop/assets"
    },

    win: {
        target: [
            {
                target: "nsis",
                arch: [
                    "x64"
                ]
            }
        ],

        publish: [
            {
                provider: "github",
                owner: "Gtnnn12",
                repo: "NexCord"
            }
        ],

        icon: "nexcord.ico",

        requestedExecutionLevel: "asInvoker"
    },

    nsis: {
        oneClick: false,
        allowToChangeInstallationDirectory: true,
        createDesktopShortcut: true,
        createStartMenuShortcut: true,
        shortcutName: "NexCord",
        runAfterFinish: true,
        installerIcon: "nexcord.ico",
        uninstallerIcon: "nexcord.ico",
        artifactName: "NexCord-Instalador-${version}.exe",
        runAfterFinish: true,
        language: "2052,1033",
        multiLanguageInstaller: true,
        warningsAsErrors: false
    },

    afterPack: copyNexCordToPackagedApp
};
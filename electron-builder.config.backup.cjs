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

const NEXCORD_VERSION = "1.26.3";
const DISCORD_ELECTRON_VERSION = "42.7.1";

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
            "Discord no encontrado."
        );
    }

    return best;
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
        "[nexcord] Copiando archivos de Discord..."
    );

    // -------------------------------------------------------------------------
    // Archivos principales de Discord
    // -------------------------------------------------------------------------

    for (const file of readdirSync(discordApp)) {
        if (
            file === "resources" ||
            file === "modules" ||
            file === "snapshot_blob.bin" ||
            file === "v8_context_snapshot.bin"
        ) {
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
        } catch (_) {}
    }

    // -------------------------------------------------------------------------
    // IMPORTANTE:
    // Usamos los snapshots y archivos Chromium/Electron de Electron 42.7.1.
    // NO usamos los snapshots de Discord.
    // -------------------------------------------------------------------------

    const electronDist = join(
        __dirname,
        "node_modules",
        ".pnpm",
        `electron@${DISCORD_ELECTRON_VERSION}`,
        "node_modules",
        "electron",
        "dist"
    );

    if (!existsSync(electronDist)) {
        throw new Error(
            `No se encontró Electron ${DISCORD_ELECTRON_VERSION}. Ejecuta: pnpm exec electron --version`
        );
    }

    console.log(
        `[nexcord] Usando Electron ${DISCORD_ELECTRON_VERSION}`
    );

    const electronFiles = [
        "electron.exe",
        "snapshot_blob.bin",
        "v8_context_snapshot.bin",
        "chrome_100_percent.pak",
        "chrome_200_percent.pak",
        "icudtl.dat",
        "resources.pak",
        "vk_swiftshader.dll",
        "vk_swiftshader_icd.json",
        "vulkan-1.dll",
        "d3dcompiler_47.dll",
        "dxcompiler.dll",
        "dxil.dll",
        "libEGL.dll",
        "libGLESv2.dll",
        "ffmpeg.dll"
    ];

    for (const file of electronFiles) {
        const source = join(
            electronDist,
            file
        );

        const destination = join(
            outDir,
            file === "electron.exe"
                ? "Discord.exe"
                : file
        );

        if (existsSync(source)) {
            cpSync(
                source,
                destination,
                {
                    force: true
                }
            );

            console.log(
                `[nexcord] Electron -> ${file}`
            );
        }
    }

    // -------------------------------------------------------------------------
    // Modules de Discord
    // -------------------------------------------------------------------------

    const outModules = join(
        outDir,
        "modules"
    );

    const discordModules = join(
        discordApp,
        "modules"
    );

    mkdirSync(
        outModules,
        {
            recursive: true
        }
    );

    if (existsSync(discordModules)) {
        for (const moduleName of readdirSync(discordModules)) {
            const source = join(
                discordModules,
                moduleName
            );

            if (!statSync(source).isDirectory()) {
                continue;
            }

            try {
                cpSync(
                    source,
                    join(
                        outModules,
                        moduleName
                    ),
                    {
                        recursive: true,
                        force: true
                    }
                );
            } catch (_) {}
        }
    }

    // -------------------------------------------------------------------------
    // Resources
    // -------------------------------------------------------------------------

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

    // -------------------------------------------------------------------------
    // Nightcord ASAR
    // -------------------------------------------------------------------------

    const nightcordAsar = join(
        __dirname,
        "dist",
        "nightcord.asar"
    );

    if (!existsSync(nightcordAsar)) {
        throw new Error(
            "No se encontró dist/nightcord.asar. Ejecuta primero el build."
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
        "[nexcord] Copiado nightcord.asar"
    );

    // -------------------------------------------------------------------------
    // build_info.json
    // -------------------------------------------------------------------------

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

    // -------------------------------------------------------------------------
    // Bootstrap
    // -------------------------------------------------------------------------

    const bootstrapSrc = join(
        discordRes,
        "bootstrap"
    );

    const bootstrapDst = join(
        outRes,
        "bootstrap"
    );

    if (existsSync(bootstrapSrc)) {
        mkdirSync(
            bootstrapDst,
            {
                recursive: true
            }
        );

        cpSync(
            bootstrapSrc,
            bootstrapDst,
            {
                recursive: true,
                force: true
            }
        );
    }

    // -------------------------------------------------------------------------
    // app.asar original de Discord
    // -------------------------------------------------------------------------

    console.log(
        "[nexcord] Preparando _app.asar..."
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

    if (existsSync(appAsarSrc)) {
        cpSync(
            appAsarSrc,
            join(
                outRes,
                "_app.asar"
            ),
            {
                recursive: statSync(appAsarSrc).isDirectory(),
                force: true
            }
        );
    }

    // -------------------------------------------------------------------------
    // app.asar de entrada de NexCord
    // -------------------------------------------------------------------------

    const outAppAsar = join(
        outRes,
        "app.asar"
    );

    mkdirSync(
        outAppAsar,
        {
            recursive: true
        }
    );

    writeFileSync(
        join(
            outAppAsar,
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
            outAppAsar,
            "index.js"
        ),
        `"use strict";

const path = require("path");
const { app } = require("electron");

app.setAppUserModelId("com.squirrel.Discord.Discord");

require(
    path.join(
        __dirname,
        "..",
        "app",
        "dist",
        "desktop",
        "patcher.js"
    )
);
`
    );

    // -------------------------------------------------------------------------
    // resources/app
    // -------------------------------------------------------------------------

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

    // -------------------------------------------------------------------------
    // NexCord desktop
    // -------------------------------------------------------------------------

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

    // -------------------------------------------------------------------------
    // Preload
    // -------------------------------------------------------------------------

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

    // -------------------------------------------------------------------------
    // FFmpeg / YT-DLP
    // -------------------------------------------------------------------------

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

    // -------------------------------------------------------------------------
    // macOS
    // -------------------------------------------------------------------------

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
            console.warn(
                `[nexcord] No se pudo copiar ${item}:`,
                error.message
            );
        }
    }

    console.log(
        "[nexcord] NexCord copiado correctamente."
    );
}

killNexCord();

const discord = findDiscordApp();

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

    files: [
        "index.js",
        "dist/desktop/**/*",
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
                target: "dir",
                arch: ["x64"]
            }
        ],

        icon: "nexcord.ico",

        requestedExecutionLevel: "asInvoker"
    },

    afterPack: copyNexCordToPackagedApp
};
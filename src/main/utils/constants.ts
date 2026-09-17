/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2022 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { app } from "electron";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "fs";
import { join } from "path";

const suffix = IS_DEV ? "dev" : "";

// FASE 1 — Persistencia: TODO el almacenamiento de NexCord vive en %APPDATA%\NexCord.
// Nunca dentro de la instalación de Discord (app-*/resources) porque Discord la
// reemplaza entera en cada actualización.
// Override manual permitido para desarrollo/tests, igual que antes.
export const DATA_DIR = process.env.NexCord_USER_DATA_DIR ?? join(app.getPath("appData"), "NexCord", suffix);

export const SETTINGS_DIR = join(DATA_DIR, "settings");
export const THEMES_DIR = join(DATA_DIR, "themes");
export const QUICK_CSS_PATH = join(SETTINGS_DIR, "quickCss.css");
export const SETTINGS_FILE = join(SETTINGS_DIR, "settings.json");
export const NATIVE_SETTINGS_FILE = join(SETTINGS_DIR, "native-settings.json");
export const DEV_MIGRATED = join(SETTINGS_DIR, "migration");
export const ALLOWED_PROTOCOLS = [
    "https:",
    "http:",
    "steam:",
    "spotify:",
    "tidal:",
    "itunes:",
    "vrcx:",
];

export const IS_VANILLA = /* @__PURE__ */ process.argv.includes("--vanilla");

// ---------------------------------------------------------------------------
// FASE 1 — Migración automática de datos antiguos a %APPDATA%\NexCord.
// Copia (sin borrar el origen, por seguridad) cualquier dato que siga viviendo
// en ubicaciones antiguas: %APPDATA%\discord\NexCordData o <exeDir>\NexCordData
// (instalación portable/injectada junto al ejecutable de Discord).
// Se ejecuta una sola vez por instalación: marcador DATA_DIR/.migrated-v1.
// ---------------------------------------------------------------------------
const localAppData = process.env.LOCALAPPDATA ?? app.getPath("appData");
const LEGACY_DATA_DIRS = [
    join(app.getPath("appData"), "discord", "NexCordData" + suffix),
    join(app.getPath("appData"), "Discord", "NexCordData" + suffix),
    join(localAppData, "discord", "NexCordData" + suffix),
    join(localAppData, "Discord", "NexCordData" + suffix),
    // Instalación inyectada/portable: NexCordData junto a las resources de Discord
    join(process.resourcesPath ?? "", "..", "NexCordData" + suffix),
    join(process.resourcesPath ?? "", "..", "..", "NexCordData" + suffix)
].filter(Boolean);

function migrateLegacyDataDir() {
    const marker = join(DATA_DIR, ".migrated-v1");
    if (existsSync(marker)) return;

    try {
        mkdirSync(DATA_DIR, { recursive: true });
        mkdirSync(SETTINGS_DIR, { recursive: true });
        mkdirSync(THEMES_DIR, { recursive: true });
    } catch (err) {
        console.error("[NexCord] Failed to create data dir:", err);
        return;
    }

    for (const legacyDir of LEGACY_DATA_DIRS) {
        try {
            if (!existsSync(legacyDir)) continue;

            // Copia recursiva preservando la estructura: settings/, themes/ y el resto de archivos.
            const copyDir = (src: string, dest: string) => {
                mkdirSync(dest, { recursive: true });
                for (const entry of readdirSync(src, { withFileTypes: true })) {
                    const srcPath = join(src, entry.name);
                    const destPath = join(dest, entry.name);
                    if (entry.isDirectory()) {
                        copyDir(srcPath, destPath);
                    } else if (entry.isFile()) {
                        try {
                            copyFileSync(srcPath, destPath);
                        } catch (e) {
                            console.error(`[NexCord] Migration: failed to copy ${srcPath}:`, e);
                        }
                    }
                }
            };

            copyDir(legacyDir, DATA_DIR);
            console.log("[NexCord] Migrated legacy data from", legacyDir, "to", DATA_DIR);
            // NO se borra el origen: queda como backup por si el usuario quiere volver atrás.
        } catch (err) {
            console.error(`[NexCord] Failed to migrate legacy data from ${legacyDir}:`, err);
        }
    }

    try {
        writeFileSync(marker, "migrated", "utf8");
    } catch (err) {
        console.error("[NexCord] Failed to write migration marker:", err);
    }
}

migrateLegacyDataDir();

if (IS_DEV) {
    const prodDir = join(DATA_DIR, "..");
    const settings = join(prodDir, "settings", "settings.json");
    const quickCss = join(prodDir, "settings", "quickCss.css");

    let migrated = false;
    if (existsSync(DEV_MIGRATED)) {
        const content = readFileSync(DEV_MIGRATED, "utf-8");
        migrated = content.includes("migrated");
    }

    if (!migrated) {
        setTimeout(() => {
            try {
                if (existsSync(settings)) copyFileSync(settings, SETTINGS_FILE);
                if (existsSync(quickCss)) copyFileSync(quickCss, QUICK_CSS_PATH);
                writeFileSync(DEV_MIGRATED, "migrated", "utf-8");
                app.relaunch();
                app.exit(0);
            } catch (err) {
                console.error("[NexCord] Failed to copy prod data:", err);
            }
        }, 5000);
    }
}

/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { PluginLoadTimes, PluginSettingsFlags } from "@shared/pluginState";
import type { Settings } from "@api/Settings";
import { IpcEvents } from "@shared/IpcEvents";
import { SettingsStore } from "@shared/SettingsStore";
import { mergeDefaults } from "@utils/mergeDefaults";
import { ipcMain } from "electron";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

import { DATA_DIR, NATIVE_SETTINGS_FILE, SETTINGS_DIR, SETTINGS_FILE } from "./utils/constants";

// ---------------------------------------------------------------------------
// FASE 3 — enabled-plugins.json: fuente de verdad del estado ON/OFF de cada
// plugin. Vive en %APPDATA%\NexCord\settings\enabled-plugins.json (persistente,
// nunca se borra aunque Discord se actualice).
// ---------------------------------------------------------------------------
export const ENABLED_PLUGINS_FILE = join(SETTINGS_DIR, "enabled-plugins.json");

function readEnabledPlugins(): PluginSettingsFlags {
    try {
        const parsed = JSON.parse(readFileSync(ENABLED_PLUGINS_FILE, "utf-8"));
        if (parsed && typeof parsed === "object" && parsed.plugins && typeof parsed.plugins === "object") {
            return parsed.plugins as PluginSettingsFlags;
        }
        if (parsed && typeof parsed === "object") return parsed as PluginSettingsFlags;
    } catch (err: any) {
        if (err?.code !== "ENOENT")
            console.error("Failed to read enabled-plugins.json", err);
    }
    return {};
}

const enabledPlugins = readEnabledPlugins();

// (La semilla inicial de los 10 primeros plugins la escribe el renderer en
// initPluginManager, que sí conoce la lista real de plugins del bundle.)

const saveEnabledPlugins = debounce(() => {
    try {
        writeFileSync(ENABLED_PLUGINS_FILE, JSON.stringify(enabledPlugins, null, 4), "utf-8");
    } catch (e) {
        console.error("Failed to write enabled-plugins.json", e);
    }
}, 300);

ipcMain.on(IpcEvents.GET_ENABLED_PLUGINS, e => e.returnValue = enabledPlugins);

// FASE 3 — Modo seguro: --safe-mode, NEXCORD_SAFE_MODE=1 o auto tras 2 crashes.
const SAFE_MODE_FLAG = process.argv.includes("--safe-mode") || process.env.NEXCORD_SAFE_MODE === "1";
let safeModeActive = SAFE_MODE_FLAG;
let safeModeReason = SAFE_MODE_FLAG ? "flag" : "";

const CRASH_MARKER_FILE = join(DATA_DIR, "safe-mode-crashes.json");
function readCrashMarker(): { count: number; last: number; } {
    try { return JSON.parse(readFileSync(CRASH_MARKER_FILE, "utf-8")); } catch { return { count: 0, last: 0 }; }
}
if (!safeModeActive) {
    const marker = readCrashMarker();
    // Un crash reciente (menos de 2 min) encadenado con otro anterior activa el modo seguro
    if (marker.count >= 2 && Date.now() - marker.last < 120_000) {
        safeModeActive = true;
        safeModeReason = "crashes";
    }
}
export function notifyRenderProcessGone() {
    try {
        const marker = readCrashMarker();
        const now = Date.now();
        marker.count = now - marker.last < 120_000 ? marker.count + 1 : 1;
        marker.last = now;
        writeFileSync(CRASH_MARKER_FILE, JSON.stringify(marker, null, 4), "utf-8");
    } catch { }
}

ipcMain.on(IpcEvents.GET_SAFE_MODE, e => e.returnValue = { active: safeModeActive, reason: safeModeReason });

ipcMain.on(IpcEvents.SET_PLUGIN_ENABLED, (_e, name: string, enabled: boolean) => {
    if (typeof name !== "string" || name.includes("..") || name.includes("/")) return;
    enabledPlugins[name] = { ...(enabledPlugins[name] ?? {}), enabled: !!enabled };
    saveEnabledPlugins();
});

ipcMain.on(IpcEvents.SET_ENABLED_PLUGINS, (_e, data: PluginSettingsFlags) => {
    if (!data || typeof data !== "object") return;
    for (const k of Object.keys(enabledPlugins)) delete enabledPlugins[k];
    Object.assign(enabledPlugins, data);
    saveEnabledPlugins();
});

// FASE 3 — plugin-load-times.json: tiempos de carga por plugin; >500ms marcado.
const PLUGIN_LOAD_TIMES_FILE = join(DATA_DIR, "plugin-load-times.json");

ipcMain.on(IpcEvents.SET_PLUGIN_LOAD_TIMES, (_e, times: PluginLoadTimes) => {
    if (!times || typeof times !== "object") return;
    try {
        writeFileSync(PLUGIN_LOAD_TIMES_FILE, JSON.stringify(times, null, 4), "utf-8");
    } catch (e) {
        console.error("Failed to write plugin-load-times.json", e);
    }
});

mkdirSync(SETTINGS_DIR, { recursive: true });

function readSettings<T = object>(name: string, file: string): Partial<T> {
    try {
        return JSON.parse(readFileSync(file, "utf-8"));
    } catch (err: any) {
        if (err?.code !== "ENOENT")
            console.error(`Failed to read ${name} settings`, err);

        return {};
    }
}

import { debounce } from "@shared/debounce";

export const RendererSettings = new SettingsStore(readSettings<Settings>("renderer", SETTINGS_FILE));

const saveRendererSettings = debounce(() => {
    try {
        writeFileSync(SETTINGS_FILE, JSON.stringify(RendererSettings.plain, null, 4));
    } catch (e) {
        console.error("Failed to write renderer settings", e);
    }
}, 500);

RendererSettings.addGlobalChangeListener(saveRendererSettings);

ipcMain.handle(IpcEvents.GET_SETTINGS_DIR, () => SETTINGS_DIR);
ipcMain.on(IpcEvents.GET_SETTINGS, e => e.returnValue = RendererSettings.plain);

ipcMain.handle(IpcEvents.SET_SETTINGS, (_, data: Settings, pathToNotify?: string) => {
    RendererSettings.setData(data, pathToNotify);
});

export interface NativeSettings {
    plugins: {
        [plugin: string]: {
            [setting: string]: any;
        };
    };
    customCspRules: Record<string, string[]>;
    /** User's choice on the Mellowtel bandwidth-sharing onboarding modal. */
    mellowtel?: {
        consent: "accepted" | "declined";
        version: string;
    };
}

const DefaultNativeSettings: NativeSettings = {
    plugins: {},
    customCspRules: {}
};

const nativeSettings = readSettings<NativeSettings>("native", NATIVE_SETTINGS_FILE);
mergeDefaults(nativeSettings, DefaultNativeSettings);

export const NativeSettings = new SettingsStore(nativeSettings as NativeSettings);

const saveNativeSettings = debounce(() => {
    try {
        writeFileSync(NATIVE_SETTINGS_FILE, JSON.stringify(NativeSettings.plain, null, 4));
    } catch (e) {
        console.error("Failed to write native settings", e);
    }
}, 500);

NativeSettings.addGlobalChangeListener(saveNativeSettings);

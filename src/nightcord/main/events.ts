/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { EventEmitter } from "events";

import { UserAssetType } from "./userAssets";

export const AppEvents = new EventEmitter<{
    appLoaded: [];
    userAssetChanged: [UserAssetType];
    setTrayVariant: ["tray" | "trayUnread" | "traySpeaking" | "trayIdle" | "trayMuted" | "trayDeafened"];
    voiceCallStateChanged: [boolean];
}>();

// FIX FUITE MEMOIRE : sans setMaxListeners, Node.js Ã©met un warning dÃ¨s 11 listeners
// et peut retenir les rÃ©fÃ©rences mÃªme aprÃ¨s removeListener() dans certains cas.
// On borne Ã  20 : tray (2) + appBadge (1) + ipc (1) + futurs listeners = largement suffisant.
AppEvents.setMaxListeners(20);

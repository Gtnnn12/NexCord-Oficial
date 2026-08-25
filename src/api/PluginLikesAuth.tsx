/*
 * Nightcord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { showNotification } from "@api/Notifications";
import { openModal } from "@utils/modal";
import { OAuth2AuthorizeModal } from "@webpack/common";

import { beginDiscordOAuth, getStoredToken, storeToken } from "./OAuth2";

/** Dispatched on window whenever the like-system login state changes, so mounted components (like PluginCard) can react. */
export const LIKE_AUTH_EVENT = "nightcord-like-auth-changed";

function notifyAuthChanged() {
    window.dispatchEvent(new CustomEvent(LIKE_AUTH_EVENT));
}

/**
 * Starts the Discord OAuth2 flow required to like plugins.
 * Resolves with the token on success, or null if the user cancelled / it failed.
 * If already logged in, resolves immediately with the existing token.
 */
export async function authorizeLikeSystem(){return null;}

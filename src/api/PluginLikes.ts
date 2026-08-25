/*
 * NexCord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { LIKE_AUTH_EVENT } from "./PluginLikesAuth";

export interface PluginLikeData {
    likes: number;
    likedByMe: boolean;
}

export interface PluginRatings {
    [pluginName: string]: PluginLikeData;
}

const STORAGE_KEY = "NexCordPluginLikes";

export async function fetchPluginRatings(): Promise<PluginRatings> {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    try {
        return JSON.parse(raw);
    } catch {
        return {};
    }
}

export async function togglePluginLike(pluginName: string): Promise<PluginLikeData | null> {
    const current = await fetchPluginRatings();
    const existing = current[pluginName] ?? { likes: 0, likedByMe: false };
    const updated: PluginLikeData = existing.likedByMe
        ? { likes: Math.max(0, existing.likes - 1), likedByMe: false }
        : { likes: existing.likes + 1, likedByMe: true };
    current[pluginName] = updated;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    window.dispatchEvent(new Event(LIKE_AUTH_EVENT));
    return updated;
}

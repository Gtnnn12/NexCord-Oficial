/*
 * Vencord, a Discord client mod
 * Copyright (c) 2023 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { Channel } from "@vencord/discord-types";
import { ChannelStore } from "@webpack/common";

const SMALL_CAPS: Record<string, string> = {
    "á´€": "a", "Ê™": "b", "á´„": "c", "á´…": "d", "á´‡": "e", "êœ°": "f", "É¢": "g", "Êœ": "h", "Éª": "i", "á´Š": "j",
    "á´‹": "k", "ÊŸ": "l", "á´": "m", "É´": "n", "á´": "o", "á´˜": "p", "Ç«": "q", "Ê€": "r", "êœ±": "s", "á´›": "t",
    "á´œ": "u", "á´ ": "v", "á´¡": "w", "x": "x", "Ê": "y", "á´¢": "z",
};

const ORIGINAL_NAME = Symbol("cleanChannelName.original");

let editingChannelId: string | null = null;

function computeClean(name: string, type: number): string {
    const separator = [2, 4].includes(type) ? " " : "-";
    const cleaned = name
        .normalize("NFKC")
        .replace(/[á´€Ê™á´„á´…á´‡êœ°É¢ÊœÉªá´Šá´‹ÊŸá´É´á´á´˜Ç«Ê€êœ±á´›á´œá´ á´¡xÊá´¢]/g, m => SMALL_CAPS[m])
        .replace(/[^ -~]?\p{Extended_Pictographic}[^ -~]?/ug, "")
        .replace(/-?\|-?/g, separator)
        .replace(/-?[^\p{Letter} -~]-?/ug, separator)
        .replace(/-+/g, "-")
        .replace(/(^-|-$)/g, "");
    return cleaned || name;
}

export default definePlugin({
    name: "CleanChannelName",
    authors: [Devs.AutumnVN],
    description: "Remove emoji and decoration from channel names. Reverts to the original while you're editing the channel.",
    tags: ["Appearance", "Customisation", "Chat", "Emotes", "Servers"],
    patches: [
        {
            find: "loadAllGuildAndPrivateChannelsFromDisk(){",
            replacement: {
                match: /(?<=getChannel\(\i\)\{if\(null!=\i\)return )\i\(\i\)/,
                replace: "$self.cleanChannelName($&)",
            },
        },
    ],

    flux: {
        CHANNEL_SETTINGS_INIT({ channelId }: { channelId: string; }) {
            editingChannelId = channelId;
            (ChannelStore as any).emitChange?.();
        },
        CHANNEL_SETTINGS_CLOSE() {
            editingChannelId = null;
            (ChannelStore as any).emitChange?.();
        },
    },

    cleanChannelName(channel?: Channel) {
        if (channel == null) return channel;
        const c = channel as any;

        if (c[ORIGINAL_NAME] !== undefined) return channel;

        c[ORIGINAL_NAME] = channel.name;

        Object.defineProperty(channel, "name", {
            configurable: true,
            enumerable: true,
            get() {
                if (editingChannelId === channel.id) return c[ORIGINAL_NAME];
                return computeClean(c[ORIGINAL_NAME], channel.type);
            },
            set(value: string) {
                c[ORIGINAL_NAME] = value;
            },
        });

        return channel;
    },
});

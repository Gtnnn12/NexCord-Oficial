import definePlugin from "@utils/types";
import { addServerListElement, removeServerListElement, ServerListRenderPosition } from "@api/ServerList";
import { ErrorBoundary } from "@components/index";
import { FluxDispatcher, React } from "@webpack/common";
import { forceServerListRerender } from "@nightcordplugins/_utils/serverListRefresh";

import { NightcordNewsButton, stopPolling, startPolling } from "./components/NightcordNewsButton";

export let isNewsOpen = false;

let savedPath: string | null = null;

function restoreSavedPath() {
    if (savedPath && (window.location.pathname + window.location.search + window.location.hash) !== savedPath) {
        try {
            const WP = (Vencord as any).Webpack;
            const router = WP?.findByProps?.("transitionTo", "replaceWith");
            if (router?.transitionTo) {
                router.transitionTo(savedPath);
            } else {
                window.history.replaceState(null, "", savedPath);
            }
        } catch {
            try { window.history.replaceState(null, "", savedPath); } catch {}
        }
    }
}

export function setNightcordNewsOpen(open: boolean) {
    if (isNewsOpen !== open) {
        if (open) {
            savedPath = window.location.pathname + window.location.search + window.location.hash;
        }
        isNewsOpen = open;
        FluxDispatcher.dispatch({ type: "NIGHTCORDNEWS_TOGGLE", isOpen: open });
        if (!open) {
            restoreSavedPath();
        }
    }
}

function handleDiscordNavigation() {
    if (isNewsOpen) {
        setNightcordNewsOpen(false);
    }
}

function handleOtherPluginToggle(e: any) {
    if (e.isOpen) {
        setNightcordNewsOpen(false);
    }
}

function handleGlobalClick(e: MouseEvent) {
    if (!isNewsOpen) return;
    const target = e.target as HTMLElement | null;
    if (!target) return;

    // If click is inside nightcord news button, news overlay, or its context menu, do not close
    if (target.closest("#nightcord-news-button") || target.closest("#nightcord-news-overlay") || target.closest("#nightcordnews-context-menu")) {
        return;
    }

    // If user clicked any server icon, home button, folder, or channel item in Discord's sidebar, close NightcordNews
    if (target.closest('div[class*="guilds_"]') || target.closest('nav[class*="guilds_"]') || target.closest('[data-list-item-id^="guildsnav_"]')) {
        setNightcordNewsOpen(false);
    }
}

function handleKeyDown(e: KeyboardEvent) {
    if (isNewsOpen && e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setNightcordNewsOpen(false);
    }
}

const RenderElement = () => (
    <ErrorBoundary>
        <NightcordNewsButton />
    </ErrorBoundary>
);

export default definePlugin({
    name: "NightcordNews",
    description: "Official Nightcord news and social feed with real-time ping notifications",
    enabledByDefault: true,
    authors: [{ name: "Nightcord", id: 0n }],
    dependencies: ["ServerListAPI"],
    tags: ["Utility", "Social"],

    start() {
        addServerListElement(ServerListRenderPosition.Above, RenderElement);
        forceServerListRerender();

        startPolling();

        document.addEventListener("click", handleGlobalClick, true);
        document.addEventListener("keydown", handleKeyDown, true);
        window.addEventListener("popstate", handleDiscordNavigation);

        FluxDispatcher.subscribe("CHANNEL_SELECT", handleDiscordNavigation);
        FluxDispatcher.subscribe("GUILD_SELECT", handleDiscordNavigation);
        FluxDispatcher.subscribe("QXCHAT_TOGGLE", handleOtherPluginToggle);
        FluxDispatcher.subscribe("YOUTUBE_TOGGLE", handleOtherPluginToggle);
        FluxDispatcher.subscribe("BROWSER_TOGGLE", handleOtherPluginToggle);
    },

    stop() {
        removeServerListElement(ServerListRenderPosition.Above, RenderElement);
        forceServerListRerender();

        document.removeEventListener("click", handleGlobalClick, true);
        document.removeEventListener("keydown", handleKeyDown, true);
        window.removeEventListener("popstate", handleDiscordNavigation);

        FluxDispatcher.unsubscribe("CHANNEL_SELECT", handleDiscordNavigation);
        FluxDispatcher.unsubscribe("GUILD_SELECT", handleDiscordNavigation);
        FluxDispatcher.unsubscribe("QXCHAT_TOGGLE", handleOtherPluginToggle);
        FluxDispatcher.unsubscribe("YOUTUBE_TOGGLE", handleOtherPluginToggle);
        FluxDispatcher.unsubscribe("BROWSER_TOGGLE", handleOtherPluginToggle);

        stopPolling();
        setNightcordNewsOpen(false);
    }
});

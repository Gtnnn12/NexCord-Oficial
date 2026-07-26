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

// Called when Discord itself navigates (user clicked a server/channel while the
// overlay was open). We must only CLOSE the overlay here, never restoreSavedPath —
// otherwise we'd fight the navigation the user just triggered and bounce them back
// to whatever page was open before the overlay, instead of the server they clicked.
function closeWithoutRestoring() {
    if (isNewsOpen) {
        isNewsOpen = false;
        savedPath = null;
        FluxDispatcher.dispatch({ type: "NIGHTCORDNEWS_TOGGLE", isOpen: false });
    }
}

const handleDiscordNavigation = () => {
    if (isNewsOpen) {
        closeWithoutRestoring();
    }
};

function handleOtherPluginToggle(e: any) {
    if (e.isOpen) {
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

        FluxDispatcher.subscribe("CHANNEL_SELECT", handleDiscordNavigation);
        FluxDispatcher.subscribe("GUILD_SELECT", handleDiscordNavigation);
        FluxDispatcher.subscribe("QXCHAT_TOGGLE", handleOtherPluginToggle);
        FluxDispatcher.subscribe("YOUTUBE_TOGGLE", handleOtherPluginToggle);
        FluxDispatcher.subscribe("BROWSER_TOGGLE", handleOtherPluginToggle);
    },

    stop() {
        removeServerListElement(ServerListRenderPosition.Above, RenderElement);
        forceServerListRerender();

        FluxDispatcher.unsubscribe("CHANNEL_SELECT", handleDiscordNavigation);
        FluxDispatcher.unsubscribe("GUILD_SELECT", handleDiscordNavigation);
        FluxDispatcher.unsubscribe("QXCHAT_TOGGLE", handleOtherPluginToggle);
        FluxDispatcher.unsubscribe("YOUTUBE_TOGGLE", handleOtherPluginToggle);
        FluxDispatcher.unsubscribe("BROWSER_TOGGLE", handleOtherPluginToggle);

        stopPolling();
        setNightcordNewsOpen(false);
    }
});

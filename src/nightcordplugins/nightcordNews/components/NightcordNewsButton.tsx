import { ContextMenuApi, FluxDispatcher, Menu, React, ReactDOM, Tooltip } from "@webpack/common";
import { plugins, stopPlugin } from "@api/PluginManager";
import { Settings } from "Vencord";
import { newsIconBase64 } from "../icon";
import { setNightcordNewsOpen } from "../index";

const FEED_URL = "https://social.nightcord.st/public";
const API_URLS = [
    "https://social.nightcord.st/api/v1/timelines/public?limit=20",
    "https://social.nightcord.st/api/v1/timelines/public?local=true&limit=20"
];
const LS_LAST_SEEN_KEY = "nightcord_news_last_seen_id";

let unreadCount = 0;
let lastSeenPostId = localStorage.getItem(LS_LAST_SEEN_KEY) || "";
let latestPostId = "";
let updateBadgeCallback: () => void = () => {};

export function clearUnreadCount() {
    unreadCount = 0;
    if (latestPostId) {
        lastSeenPostId = latestPostId;
        localStorage.setItem(LS_LAST_SEEN_KEY, lastSeenPostId);
    }
    setTimeout(() => updateBadgeCallback(), 0);
}

async function checkNewPosts() {
    try {
        let posts: any[] = [];
        for (const url of API_URLS) {
            try {
                const res = await fetch(url);
                if (res.ok) {
                    const data = await res.json();
                    if (Array.isArray(data) && data.length > 0) { posts = data; break; }
                }
            } catch {}
        }
        if (!Array.isArray(posts) || posts.length === 0) return;

        const currentLatestId = String(posts[0].id);
        latestPostId = currentLatestId;

        if (!lastSeenPostId) {
            lastSeenPostId = currentLatestId;
            localStorage.setItem(LS_LAST_SEEN_KEY, lastSeenPostId);
            unreadCount = 0;
        } else {
            // Only count if not open (open clears count)
            let count = 0;
            try {
                const lastSeenBig = BigInt(lastSeenPostId);
                for (const post of posts) {
                    try { if (BigInt(post.id) > lastSeenBig) count++; } catch {}
                }
            } catch {
                for (const post of posts) {
                    if (String(post.id) === lastSeenPostId) break;
                    count++;
                }
            }
            unreadCount = count;
        }
        setTimeout(() => updateBadgeCallback(), 0);
    } catch {}
}

let pollInterval: ReturnType<typeof setInterval> | null = null;
export function startPolling() {
    if (!pollInterval) {
        checkNewPosts();
        pollInterval = setInterval(checkNewPosts, 30000);
    }
}
export function stopPolling() {
    if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function NightcordNewsButton() {
    const [hovered, setHovered] = React.useState(false);
    const [isOpen, setIsOpen] = React.useState(false);
    const [, forceUpdate] = React.useState({});

    React.useEffect(() => {
        updateBadgeCallback = () => forceUpdate(Object.create(null));
        const handleToggle = (e: any) => {
            const open: boolean = !!e.isOpen;
            setIsOpen(open);
            if (open) {
                clearUnreadCount();
                // Add body class for scoped CSS (profile panel hiding, pills)
                document.body.classList.add("nightcord-news-open");
            } else {
                document.body.classList.remove("nightcord-news-open");
            }
        };
        FluxDispatcher.subscribe("NIGHTCORDNEWS_TOGGLE", handleToggle);
        return () => {
            FluxDispatcher.unsubscribe("NIGHTCORDNEWS_TOGGLE", handleToggle);
            document.body.classList.remove("nightcord-news-open");
            updateBadgeCallback = () => {};
        };
    }, []);

    // Robustly hide the account panel (avatar/username/status/mute/deafen row) while
    // the overlay is open, by walking up from the nameTag element (a stable class
    // prefix used elsewhere in this codebase) instead of guessing Discord's hashed
    // section/container class names, which can silently stop matching after updates.
    React.useEffect(() => {
        if (!isOpen) return;

        const nameTag = document.querySelector('div[class*="nameTag_"]');
        const panel = (nameTag?.closest("section") ?? nameTag?.parentElement?.parentElement) as HTMLElement | null;
        if (!panel) return;

        const prevDisplay = panel.style.display;
        panel.style.display = "none";
        return () => { panel.style.display = prevDisplay; };
    }, [isOpen]);

    const stopPropagation = (e: React.SyntheticEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.nativeEvent) e.nativeEvent.stopImmediatePropagation?.();
    };

    const handlePress = (e: any) => {
        stopPropagation(e);
        const willOpen = !isOpen;
        setNightcordNewsOpen(willOpen);
        if (willOpen) {
            // Check for new posts without reloading the iframe.
            // The iframe is always kept alive (opacity/visibility toggle) to avoid
            // the blank-page flash caused by Electron suspending the renderer.
            checkNewPosts();
        }
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        stopPropagation(e);
        const p = plugins.NightcordNews;
        ContextMenuApi.openContextMenu(e, () => (
            <Menu.Menu navId="nightcordnews-context-menu" aria-label="NightcordNews Options" onClose={ContextMenuApi.closeContextMenu}>
                <Menu.MenuGroup>
                    <Menu.MenuItem
                        id="refresh-feed"
                        label="Refresh feed"
                        action={() => {
                            ContextMenuApi.closeContextMenu();
                            checkNewPosts();
                            const iframe = document.getElementById("nightcord-news-iframe") as HTMLIFrameElement | null;
                            if (iframe) { iframe.src = ""; iframe.src = FEED_URL; }
                        }}
                    />
                    <Menu.MenuItem
                        id="mark-read"
                        label="Mark all as read"
                        action={() => {
                            ContextMenuApi.closeContextMenu();
                            clearUnreadCount();
                        }}
                    />
                    <Menu.MenuItem
                        id="disable-plugin"
                        label="Disable plugin"
                        color="danger"
                        action={() => {
                            ContextMenuApi.closeContextMenu();
                            setNightcordNewsOpen(false);
                            if (p) stopPlugin(p);
                            if (Settings.plugins.NightcordNews) Settings.plugins.NightcordNews.enabled = false;
                        }}
                    />
                </Menu.MenuGroup>
            </Menu.Menu>
        ));
    };

    const count = unreadCount;

    return (
        <>
            {/* ── Sidebar button ── */}
            <div
                id="nightcord-news-button"
                className="nightcord-news-button-container"
                onClick={stopPropagation}
                onMouseDown={stopPropagation}
                onMouseUp={stopPropagation}
                style={{ position: "relative", display: "flex", justifyContent: "center" }}
            >
                {/* Discord-style selection pill */}
                <div className="wrapper__58105 overlay__58105" aria-hidden="true">
                    <span className={`item__58105 ${isOpen ? "visible__58105 selected__58105" : hovered ? "visible__58105 hovered__58105" : ""}`} />
                </div>

                <Tooltip text={<strong>Nightcord News</strong>} position="right" hideOnClick={false}>
                    {(tooltipProps: any) => (
                        <div
                            {...tooltipProps}
                            onClick={handlePress}
                            onMouseDown={stopPropagation}
                            onMouseUp={stopPropagation}
                            onContextMenu={handleContextMenu}
                            onMouseEnter={(e: any) => { setHovered(true); tooltipProps?.onMouseEnter?.(e); }}
                            onMouseLeave={(e: any) => { setHovered(false); tooltipProps?.onMouseLeave?.(e); }}
                            className="nightcord-news-icon-btn"
                            style={{
                                width: 40,
                                height: 40,
                                borderRadius: 12,
                                backgroundColor: "var(--background-primary)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                cursor: "pointer",
                                position: "relative",
                                overflow: "visible",
                            }}
                        >
                            <style>{`
                                /* Pin the icon's background so Discord's own guild-list hover
                                   transition (applied generically to list children) can't fade
                                   its color in/out — only the selection pill should animate. */
                                .nightcord-news-icon-btn,
                                .nightcord-news-icon-btn:hover,
                                .nightcord-news-icon-btn:focus,
                                .nightcord-news-icon-btn:active {
                                    background-color: var(--background-primary) !important;
                                    transition: none !important;
                                }
                            `}</style>
                            <img
                                src={`data:image/png;base64,${newsIconBase64}`}
                                style={{ width: 32, height: 32, objectFit: "contain", borderRadius: "6px" }}
                                draggable={false}
                            />

                            {/* Red Discord-style unread badge */}
                            {count > 0 && !isOpen && (
                                <div style={{
                                    position: "absolute",
                                    bottom: -2,
                                    right: -4,
                                    backgroundColor: "#f23f43",
                                    color: "#fff",
                                    fontSize: "11px",
                                    fontWeight: 700,
                                    minWidth: 16,
                                    height: 16,
                                    borderRadius: 8,
                                    padding: "0 4px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    boxShadow: "0 0 0 3px var(--background-secondary,#2b2d31)",
                                    zIndex: 10,
                                    pointerEvents: "none",
                                    lineHeight: 1,
                                    boxSizing: "border-box" as const,
                                }}>
                                    {count}
                                </div>
                            )}
                        </div>
                    )}
                </Tooltip>
            </div>

            {/* ── Overlay portal ──
             *  We keep the portal ALWAYS mounted (never removed from DOM) so that
             *  Electron / Chromium does not suspend the iframe process when the
             *  container is hidden. Visibility is toggled via opacity + pointer-events
             *  instead of display:none, which is what caused the blank-page bug.
             * ─────────────────────────────────────────────────────────────────── */}
            {ReactDOM.createPortal(
                <div
                    id="nightcord-news-overlay"
                    style={{
                        position: "fixed",
                        top: 0,
                        left: 72,
                        bottom: 0,
                        right: 0,
                        zIndex: 999,
                        backgroundColor: "var(--background-primary)",
                        display: isOpen ? "flex" : "none",
                        flexDirection: "column"
                    }}
                >
                    {isOpen && (
                        <style>{`
                            /* Hide the scrollbar visually while allowing scroll functionality to work */
                            #nightcord-news-iframe::-webkit-scrollbar {
                                display: none !important;
                                width: 0 !important;
                                height: 0 !important;
                            }
                            /* Hide the profile bar/panels when NightcordNews is open */
                            section[class^="panels_"],
                            div[class^="container_"]:has(> div[class^="nameTag_"]) {
                                display: none !important;
                            }
                            /* Hide all native discord pills, except our own */
                            div[class*="guilds_"] [class*="pill_"] span,
                            div[class*="guilds_"] [class*="item_"],
                            [data-list-item-id="guildsnav___home"] [class*="pill_"] span,
                            [data-list-item-id="guildsnav___home"] [class*="item_"],
                            div[class*="wrapper_"][class*="overlay_"] span {
                                opacity: 0 !important;
                                visibility: hidden !important;
                                height: 0px !important;
                                transform: scale(0) !important;
                            }
                            #nightcord-news-button [class*="pill_"] span,
                            #nightcord-news-button [class*="item_"],
                            #nightcord-news-button div[class*="wrapper_"][class*="overlay_"],
                            #nightcord-news-button div[class*="wrapper_"][class*="overlay_"] span {
                                opacity: 1 !important;
                                visibility: visible !important;
                                height: 40px !important;
                                transform: none !important;
                            }
                        `}</style>
                    )}
                        {/* Top Header Bar */}
                        <div style={{
                            height: 38,
                            backgroundColor: "#111214",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "0 12px",
                            borderBottom: "1px solid #1e1f22",
                            boxSizing: "border-box",
                            WebkitAppRegion: "drag" as any,
                            flexShrink: 0,
                        }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#f2f3f5", fontSize: 14, fontWeight: 600, WebkitAppRegion: "no-drag" as any }}>
                                <img
                                    src={`data:image/png;base64,${newsIconBase64}`}
                                    style={{ width: 20, height: 20, borderRadius: 4, objectFit: "cover" }}
                                    draggable={false}
                                />
                                <span>Nightcord News & Feed</span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 4, WebkitAppRegion: "no-drag" as any }}>
                                {/* Refresh */}
                                <button
                                    title="Refresh"
                                    style={{ background: "transparent", color: "#b5bac1", border: "none", borderRadius: 4, padding: 6, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.1s, color 0.1s" }}
                                    onMouseOver={(e: any) => { e.currentTarget.style.backgroundColor = "#383a40"; e.currentTarget.style.color = "#dbdee1"; }}
                                    onMouseOut={(e: any) => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = "#b5bac1"; }}
                                    onClick={(e) => {
                                        e.preventDefault(); e.stopPropagation();
                                        checkNewPosts();
                                        const iframe = document.getElementById("nightcord-news-iframe") as HTMLIFrameElement | null;
                                        if (iframe) { iframe.src = ""; iframe.src = FEED_URL; }
                                    }}
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
                                </button>
                                {/* Open externally */}
                                <button
                                    title="Open in browser"
                                    style={{ background: "transparent", color: "#b5bac1", border: "none", borderRadius: 4, padding: 6, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.1s, color 0.1s" }}
                                    onMouseOver={(e: any) => { e.currentTarget.style.backgroundColor = "#383a40"; e.currentTarget.style.color = "#dbdee1"; }}
                                    onMouseOut={(e: any) => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = "#b5bac1"; }}
                                    onClick={(e) => {
                                        e.preventDefault(); e.stopPropagation();
                                        try { (VencordNative as any)?.native?.openExternal?.(FEED_URL); } catch { window.open(FEED_URL, "_blank"); }
                                    }}
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                                </button>
                                {/* Close */}
                                <button
                                    title="Close"
                                    style={{ background: "transparent", color: "#b5bac1", border: "none", borderRadius: 4, padding: 6, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.1s, color 0.1s" }}
                                    onMouseOver={(e: any) => { e.currentTarget.style.backgroundColor = "#da373c"; e.currentTarget.style.color = "#ffffff"; }}
                                    onMouseOut={(e: any) => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = "#b5bac1"; }}
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setNightcordNewsOpen(false); }}
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                                </button>
                            </div>
                        </div>

                        {/* Mastodon feed iframe – always rendered so Electron keeps the
                            process alive. Visibility is controlled by the parent div. */}
                        <iframe
                            id="nightcord-news-iframe"
                            src={FEED_URL}
                            style={{
                                width: "100%",
                                height: "100%",
                                border: "none",
                                display: "block",
                                flex: 1,
                                /* Thin Discord-style scrollbar for webkit (host frame) */
                                colorScheme: "dark",
                            } as React.CSSProperties}
                            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
                        />
                    </div>,
                document.body
            )}
        </>
    );
}

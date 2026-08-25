import "./styles.css";

import { addContextMenuPatch, NavContextMenuPatchCallback, removeContextMenuPatch } from "@api/ContextMenu";
import { definePluginSettings } from "@api/Settings";
import { t } from "../autoTranslateNightcord";
import { FormSwitch } from "@components/FormSwitch";
import { ModalCloseButton, ModalContent, ModalHeader, ModalRoot, openModal } from "@utils/modal";
import definePlugin, { OptionType } from "@utils/types";
import { findStoreLazy } from "@webpack";
import { Button, GuildStore, Menu, React, RestAPI, Select, Toasts, useMemo, useRef, UserStore, useState, IconUtils } from "@webpack/common";
import { Forms } from "@webpack/common";
const F = Forms as any;

const PermissionStore = findStoreLazy("PermissionStore");
const ADMIN_BIT = 0x8n;

function getToken(): string {
    try {
        const mod = (window as any).Vencord?.Webpack?.findByProps?.("getToken");
        return mod?.getToken?.() ?? "";
    } catch { return ""; }
}

function hasAdmin(guildId: string): boolean {
    try {
        const guild = GuildStore.getGuild(guildId);
        if (!guild) return false;
        const me = UserStore.getCurrentUser();
        if (guild.ownerId === me.id) return true;
        const perms = PermissionStore.getGuildPermissions({ id: guildId });
        if (typeof perms === "bigint") return (perms & ADMIN_BIT) === ADMIN_BIT;
        return false;
    } catch { return false; }
}

async function apiCall(method: "get" | "post" | "patch" | "del", url: string, body?: any): Promise<any> {
    const opts: any = { url };
    if (body) opts.body = body;
    const res = await (RestAPI as any)[method](opts);
    if (res.status === 429) {
        const retryAfter = res.body?.retry_after ?? 3;
        await new Promise(r => setTimeout(r, Math.min(retryAfter * 1000, 20000)));
        return apiCall(method, url, body);
    }
    if (!res.ok) {
        const msg = res.body?.message || res.text || `HTTP ${res.status}`;
        throw new Error(msg);
    }
    return res?.body;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

interface CloneOptions {
    roles: boolean;
    clearRoles: boolean;
    channels: boolean;
    permissions: boolean;
    icon: boolean;
    emojis: boolean;
    embeds: boolean;
    guildSettings: boolean;
}

type LogFn = (text: string, type?: "ok" | "err" | "warn" | "info") => void;
type ProgressFn = (p: number) => void;

let _cancelled = false;
function cancel() { _cancelled = true; }

function mapPermOverwrites(overwrites: any[], roleMapping: Map<string, string>) {
    return overwrites
        .filter(ow => roleMapping.has(ow.id))
        .map(ow => ({
            id: roleMapping.get(ow.id)!,
            type: ow.type,
            allow: String(ow.allow),
            deny: String(ow.deny),
        }));
}

async function cloneServer(sourceId: string, targetId: string, options: CloneOptions, log: LogFn, progress: ProgressFn) {
    _cancelled = false;
    const token = getToken();
    if (!token) { log("Token no encontrado", "err"); return; }

    const sourceGuild = GuildStore.getGuild(sourceId);
    if (!sourceGuild) { log("Servidor origen no encontrado", "err"); return; }

    log(`Clonando "${sourceGuild.name}"...`, "info");
    progress(5);

    if (options.guildSettings && !_cancelled) {
        try {
            await apiCall("patch", `/guilds/${targetId}`, {
                name: sourceGuild.name,
                description: sourceGuild.description,
                verification_level: sourceGuild.verificationLevel,
                default_message_notifications: sourceGuild.defaultMessageNotifications,
                explicit_content_filter: sourceGuild.explicitContentFilter,
                afk_timeout: sourceGuild.afkTimeout,
            });
            log("Ajustes copiados", "ok");
        } catch (e: any) { log(`Error ajustes: ${e.message}`, "err"); }
        await sleep(300);
        progress(15);
    }

    if (options.icon && sourceGuild.icon && !_cancelled) {
        try {
            const url = IconUtils?.getGuildIconURL({ id: sourceId, icon: sourceGuild.icon, size: 512 }) ?? "";
            if (url) {
                const resp = await fetch(url);
                const blob = await resp.blob();
                const base64 = await new Promise<string>(resolve => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.readAsDataURL(blob);
                });
                await apiCall("patch", `/guilds/${targetId}`, { icon: base64 });
                log("Icono copiado", "ok");
            }
        } catch (e: any) { log(`Error icono: ${e.message}`, "err"); }
        await sleep(300);
        progress(25);
    }

    const roleMapping = new Map<string, string>();

    if (options.roles && !_cancelled) {
        try {
            const sourceRoles: any[] = await apiCall("get", `/guilds/${sourceId}/roles`);
            const targetRoles: any[] = await apiCall("get", `/guilds/${targetId}/roles`);

            if (options.clearRoles) {
                for (const role of targetRoles) {
                    if (_cancelled) break;
                    if (role.name === "@everyone" || role.managed) continue;
                    try { await apiCall("del", `/guilds/${targetId}/roles/${role.id}`); await sleep(200); } catch {}
                }
            }

            const everyoneSource = sourceRoles.find(r => r.name === "@everyone");
            const everyoneTarget = targetRoles.find(r => r.name === "@everyone");
            if (everyoneSource && everyoneTarget) {
                roleMapping.set(everyoneSource.id, everyoneTarget.id);
                if (options.permissions) {
                    try { await apiCall("patch", `/guilds/${targetId}/roles/${everyoneTarget.id}`, { permissions: String(everyoneSource.permissions) }); } catch {}
                }
            }

            const sorted = sourceRoles.filter(r => r.name !== "@everyone").sort((a, b) => b.position - a.position);
            for (const role of sorted) {
                if (_cancelled) break;
                try {
                    const body: any = { name: role.name, color: role.color, hoist: role.hoist, mentionable: role.mentionable };
                    if (options.permissions) body.permissions = String(role.permissions);
                    const created = await apiCall("post", `/guilds/${targetId}/roles`, body);
                    roleMapping.set(role.id, created.id);
                    log(`Rol creado: ${role.name}`, "ok");
                    await sleep(300);
                } catch (e: any) { log(`Error rol "${role.name}": ${e.message}`, "err"); }
            }
            progress(45);
        } catch (e: any) { log(`Error roles: ${e.message}`, "err"); }
    }

    if (options.channels && !_cancelled) {
        try {
            const channels: any[] = await apiCall("get", `/guilds/${sourceId}/channels`);
            const categories = channels.filter(c => c.type === 4).sort((a, b) => a.position - b.position);
            const others = channels.filter(c => c.type !== 4).sort((a, b) => a.position - b.position);
            const channelMapping = new Map<string, string>();

            // Crear categorías
            for (const cat of categories) {
                if (_cancelled) break;
                try {
                    const body: any = { name: cat.name, type: 4 };
                    if (options.permissions && Array.isArray(cat.permission_overwrites) && cat.permission_overwrites.length) {
                        body.permission_overwrites = mapPermOverwrites(cat.permission_overwrites, roleMapping);
                    }
                    const created = await apiCall("post", `/guilds/${targetId}/channels`, body);
                    channelMapping.set(cat.id, created.id);
                    log(`Categoría: ${cat.name}`, "ok");
                    await sleep(300);
                } catch (e: any) { log(`Error categoría "${cat.name}": ${e.message}`, "err"); }
            }

            // Crear canales no-categoría
            for (const ch of others) {
                if (_cancelled) break;
                try {
                    const body: any = {
                        name: ch.name,
                        type: ch.type,
                        topic: ch.topic || undefined,
                        nsfw: ch.nsfw || false,
                    };

                    if (ch.parent_id && channelMapping.has(ch.parent_id)) {
                        body.parent_id = channelMapping.get(ch.parent_id);
                    }

                    // Añadir campos según tipo de canal
                    if (ch.type === 2 || ch.type === 13) { // voz o stage
                        if (ch.bitrate) body.bitrate = ch.bitrate;
                        if (ch.user_limit) body.user_limit = ch.user_limit;
                    }

                    if (ch.type === 15) { // foro
                        body.available_tags = ch.available_tags?.map((tag: any) => ({
                            name: tag.name,
                            emoji: tag.emoji_name ? { emoji_name: tag.emoji_name } : undefined,
                            moderated: tag.moderated ?? false,
                        })) ?? [];
                    }

                    if (ch.rate_limit_per_user) body.rate_limit_per_user = ch.rate_limit_per_user;
                    if (ch.default_thread_rate_limit_per_user) body.default_thread_rate_limit_per_user = ch.default_thread_rate_limit_per_user;

                    if (options.permissions && Array.isArray(ch.permission_overwrites) && ch.permission_overwrites.length) {
                        body.permission_overwrites = mapPermOverwrites(ch.permission_overwrites, roleMapping);
                    }

                    const created = await apiCall("post", `/guilds/${targetId}/channels`, body);
                    channelMapping.set(ch.id, created.id);
                    log(`Canal: #${ch.name}`, "ok");
                    await sleep(300);
                } catch (e: any) {
                    log(`Error canal "${ch.name}": ${e.message}`, "err");
                }
            }

            progress(75);
        } catch (e: any) {
            log(`Error canales: ${e.message}`, "err");
        }
    }

    if (options.emojis && !_cancelled) {
        try {
            const emojis: any[] = await apiCall("get", `/guilds/${sourceId}/emojis`);
            log(`Copiando ${emojis.length} emojis...`, "info");
            let count = 0;
            for (const emoji of emojis) {
                if (_cancelled) break;
                let done = false;
                for (let attempt = 1; attempt <= 2; attempt++) {
                    if (_cancelled) break;
                    try {
                        const url = IconUtils?.getEmojiURL({ id: emoji.id, animated: emoji.animated, size: 128 }) ?? "";
                        if (!url) throw new Error("Sin URL");
                        const resp = await fetch(url);
                        const blob = await resp.blob();
                        const base64 = await new Promise<string>(resolve => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve(reader.result as string);
                            reader.readAsDataURL(blob);
                        });
                        await apiCall("post", `/guilds/${targetId}/emojis`, { name: emoji.name, image: base64, roles: [] });
                        done = true;
                        count++;
                        log(`Emoji: ${emoji.name}`, "ok");
                        await sleep(1000);
                        break;
                    } catch (e: any) {
                        if (attempt < 2 && (e.message.includes("429") || e.message.includes("timeout"))) {
                            log(`Reintentando ${emoji.name}...`, "warn");
                            await sleep(2000);
                        } else {
                            log(`Emoji falló: ${emoji.name} - ${e.message}`, "err");
                            break;
                        }
                    }
                }
            }
            progress(95);
        } catch (e: any) { log(`Error emojis: ${e.message}`, "err"); }
    }

    progress(100);
    log("¡Clonación terminada!", "ok");
}

function ServerClonerUI() {
    const [sourceId, setSourceId] = useState("");
    const [targetId, setTargetId] = useState("");
    const [opts, setOpts] = useState<CloneOptions>({ roles: true, clearRoles: true, channels: true, permissions: true, icon: false, emojis: true, embeds: false, guildSettings: true });
    const [running, setRunning] = useState(false);
    const [progress, setProgress] = useState(0);
    const [logs, setLogs] = useState<Array<{ text: string; type: string }>>([]);
    const logRef = useRef<HTMLDivElement>(null);

    const allGuilds = useMemo(() => Object.values(GuildStore.getGuilds() as Record<string, any>)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(g => ({ label: g.name, value: g.id })), []);
    const adminGuilds = useMemo(() => allGuilds.filter(g => hasAdmin(g.value)), [allGuilds]);

    React.useEffect(() => {
        if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
    }, [logs]);

    function addLocalLog(text: string, type: "ok" | "err" | "warn" | "info" = "info") {
        setLogs(prev => [...prev, { text, type }]);
    }
    function setLocalProgress(p: number) {
        setProgress(Math.max(0, Math.min(100, Math.round(p))));
    }

    async function startClone() {
        if (!sourceId || !targetId || running) return;
        if (sourceId === targetId) { addLocalLog("Origen y destino no pueden ser iguales", "err"); return; }
        setRunning(true);
        setProgress(0);
        setLogs([]);
        try {
            await cloneServer(sourceId, targetId, opts, addLocalLog, setLocalProgress);
        } catch (e: any) {
            addLocalLog(`Error fatal: ${e?.message || e}`, "err");
        }
        setRunning(false);
    }

    function stopClone() {
        cancel();
        setRunning(false);
        addLocalLog("Cancelado por el usuario", "warn");
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <F.FormSection>
                <F.FormTitle>{t("Servidor origen")}</F.FormTitle>
                <Select options={allGuilds} placeholder={t("Elige servidor...")} isSelected={v => v === sourceId} select={v => setSourceId(v)} serialize={v => v} />
            </F.FormSection>

            <F.FormSection>
                <F.FormTitle>{t("Servidor destino (ADMIN)")}</F.FormTitle>
                {adminGuilds.length === 0 ? <F.FormText>No hay servidores con ADMIN</F.FormText> :
                <Select options={adminGuilds} placeholder={t("Elige servidor...")} isSelected={v => v === targetId} select={v => setTargetId(v)} serialize={v => v} />}
            </F.FormSection>

            <F.FormDivider />

            <F.FormSection>
                <F.FormTitle>{t("Opciones")}</F.FormTitle>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <FormSwitch title="Roles" value={opts.roles} onChange={v => setOpts(prev => ({ ...prev, roles: v }))} disabled={running} hideBorder />
                    <FormSwitch title="Permisos" value={opts.permissions} onChange={v => setOpts(prev => ({ ...prev, permissions: v }))} disabled={running} hideBorder />
                    <FormSwitch title="Borrar roles existentes" value={opts.clearRoles} onChange={v => setOpts(prev => ({ ...prev, clearRoles: v }))} disabled={running} hideBorder />
                    <FormSwitch title="Canales" value={opts.channels} onChange={v => setOpts(prev => ({ ...prev, channels: v }))} disabled={running} hideBorder />
                    <FormSwitch title="Emojis" value={opts.emojis} onChange={v => setOpts(prev => ({ ...prev, emojis: v }))} disabled={running} hideBorder />
                    <FormSwitch title="Ajustes" value={opts.guildSettings} onChange={v => setOpts(prev => ({ ...prev, guildSettings: v }))} disabled={running} hideBorder />
                    <FormSwitch title="Icono" value={opts.icon} onChange={v => setOpts(prev => ({ ...prev, icon: v }))} disabled={running} hideBorder />
                </div>
            </F.FormSection>

            <F.FormDivider />

            <div style={{ display: "flex", gap: 8 }}>
                <Button size={Button.Sizes.MEDIUM} color={running ? Button.Colors.PRIMARY : Button.Colors.BRAND} disabled={!sourceId || !targetId || running} onClick={startClone} style={{ flex: 1 }}>
                    {running ? "Clonando..." : "Comenzar"}
                </Button>
                {running && <Button size={Button.Sizes.MEDIUM} color={Button.Colors.RED} onClick={stopClone}>Detener</Button>}
            </div>

            {running && (
                <div className="sc-progress-bar">
                    <div className="sc-progress-fill" style={{ width: `${progress}%` }} />
                </div>
            )}

            {logs.length > 0 && (
                <div className="sc-log-area" ref={logRef}>
                    {logs.map((l, i) => <div key={i} className={`sc-log-${l.type}`}>{l.text}</div>)}
                </div>
            )}
        </div>
    );
}

function ServerClonerModal({ rootProps, guildId }: { rootProps: any; guildId: string }) {
    return (
        <ModalRoot {...rootProps} size="large">
            <ModalHeader separator={false}>
                <F.FormTitle tag="h4" style={{ margin: 0 }}>Server Cloner</F.FormTitle>
                <ModalCloseButton onClick={rootProps.onClose} />
            </ModalHeader>
            <ModalContent style={{ paddingBottom: 24 }}>
                <ServerClonerUI />
            </ModalContent>
        </ModalRoot>
    );
}

const patchGuildContext: NavContextMenuPatchCallback = (children, { guild }) => {
    if (!children || !Array.isArray(children)) return;
    try {
        if (!guild) return;
        children.push(
            <Menu.MenuItem
                id="server-cloner"
                key="server-cloner"
                label="Server Cloner"
                action={() => openModal(props => <ServerClonerModal rootProps={props} guildId={guild.id} />)}
            />
        );
    } catch (e) {
        console.error("[ServerCloner] patch error:", e);
    }
};

const settings = definePluginSettings({
    cloner: { type: OptionType.COMPONENT, description: "", component: ServerClonerUI as any },
});

export default definePlugin({
    name: "ServerCloner",
    enabledByDefault: false,
    description: "Clona servidores de forma rápida y estable.",
    authors: [{ name: "NexCord", id: 0n }],
    settings,
    start() { addContextMenuPatch("guild-context", patchGuildContext); },
    stop() { removeContextMenuPatch("guild-context", patchGuildContext); }
});
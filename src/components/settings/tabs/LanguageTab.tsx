/*
 * NexCord, a Discord client mod
 * Copyright (c) 2026 NexCord contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { LANGUAGES, LANGUAGE_FLAGS, Language, t } from "@api/i18n";
import { useSettings } from "@api/Settings";
import { Divider } from "@components/Divider";
import { FormSwitch } from "@components/FormSwitch";
import { Heading } from "@components/Heading";
import { Notice } from "@components/Notice";
import { Paragraph } from "@components/Paragraph";
import { SettingsTab, wrapTab } from "@components/settings/tabs/BaseTab";
import { Margins } from "@utils/margins";
import { findByProps, findByPropsLazy } from "@webpack";
import { FluxDispatcher, ConfirmModal } from "@webpack/common";
import { SafeSearchableSelect } from "@components/SafeSearchableSelect";
import { openModal } from "@utils/modal";

const FLAG_ICON_STYLE: React.CSSProperties = { width: 20, height: 15, borderRadius: 2, verticalAlign: "middle", objectFit: "cover" };

const DISCORD_LOCALE_MAP: Record<Language, string> = {
    en: "en-US",
    fr: "fr",
    ar: "ar",
    es: "es-ES",
    ru: "ru",
    zh: "zh-CN"
};

function syncDiscordLocale(lang: Language) {
    try {
        const targetLocale = DISCORD_LOCALE_MAP[lang] ?? lang;

        // 1. UserSettingsProtoUtils (updates Discord client setting persistently)
        const UserSettingsProtoUtils = findByProps("updateAsync") as any;
        if (UserSettingsProtoUtils?.updateAsync) {
            Promise.resolve(UserSettingsProtoUtils.updateAsync("localization", (pref: any) => {
                if (pref) pref.locale = { value: targetLocale };
            }, 0)).catch(() => {
                // Try "locale" if "localization" fails
                Promise.resolve(UserSettingsProtoUtils.updateAsync("locale", (pref: any) => {
                    if (pref) pref.locale = { value: targetLocale };
                }, 0)).catch(e => console.error("[NexCord] Failed to update locale proto:", e));
            });
        }

        // 2. HTTP PATCH fallback to ensure the backend saves the language change
        const api = findByProps("patch", "post") as any;
        if (api && typeof api.patch === "function") {
            api.patch({
                url: "/users/@me/settings",
                body: { locale: targetLocale }
            }).catch((e: any) => console.error("[NexCord] Failed to PATCH settings:", e));
        }

        // 3. LocaleActionCreators (updates Discord client UI language instantly)
        const localeModule = findByProps("setLocale") as any;
        if (localeModule && typeof localeModule.setLocale === "function") {
            localeModule.setLocale(targetLocale);
        }
    } catch (e) {
        console.error("[NexCord] Failed to sync Discord language:", e);
    }
}

const LANG_PREVIEW: Record<Language, { label: string; sample: string; }> = {
    en: { label: "English", sample: "Plugins Â· Themes Â· Updater Â· Sync" },
    fr: { label: "FranÃ§ais", sample: "Plugins Â· ThÃ¨mes Â· Mises Ã  jour Â· Synchronisation" },
    es: { label: "EspaÃ±ol", sample: "Plugins Â· Temas Â· Actualizador Â· SincronizaciÃ³n" },
    ru: { label: "Ð ÑƒÑÑÐºÐ¸Ð¹", sample: "ÐŸÐ»Ð°Ð³Ð¸Ð½Ñ‹ Â· Ð¢ÐµÐ¼Ñ‹ Â· ÐžÐ±Ð½Ð¾Ð²Ð»ÐµÐ½Ð¸Ñ Â· Ð¡Ð¸Ð½Ñ…Ñ€Ð¾Ð½Ð¸Ð·Ð°Ñ†Ð¸Ñ" },
    zh: { label: "ä¸­æ–‡", sample: "æ’ä»¶ Â· ä¸»é¢˜ Â· æ›´æ–° Â· åŒæ­¥" },
    ar: { label: "Ø§Ù„Ø¹Ø±Ø¨ÙŠØ©", sample: "Ø¥Ø¶Ø§ÙØ§Øª Â· Ø³Ù…Ø§Øª Â· Ù…Ø­Ø¯Ø« Â· Ù…Ø²Ø§Ù…Ù†Ø©" },
};

const languageOptions = (Object.keys(LANGUAGES) as Language[]).map(lang => ({
    label: LANG_PREVIEW[lang]?.label ?? LANGUAGES[lang],
    value: lang,
}));

function FlagIcon({ lang }: { lang: Language; }) {
    if (!LANGUAGE_FLAGS[lang]) {
        return <div style={{...FLAG_ICON_STYLE, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px"}}>{LANGUAGE_FLAGS[lang]}</div>;
    }
    return <img src={LANGUAGE_FLAGS[lang]} alt={lang} style={FLAG_ICON_STYLE} />;
}

function LanguageTab() {
    const settings = useSettings(["language", "syncDiscordLanguage"]);
    const current = (settings.language as Language) ?? "en";

    function selectLang(lang: Language) {
        settings.language = lang;
        if (settings.syncDiscordLanguage) {
            syncDiscordLocale(lang);
        }
        
        Alerts.show({
            title: t("Restart required!"),
            body: t("NexCord language has been changed. Discord must be restarted for all translations to take effect. Restart now?"),
            confirmText: t("Restart now"),
            cancelText: t("Later"),
            onConfirm: () => location.reload()
        });
    }

    return (
        <SettingsTab>
            <Heading className={Margins.top16}>{t("Interface Language")}</Heading>
            <Paragraph className={Margins.bottom16}>
                {t("Choose the language for NexCord's interface. Plugin names and Discord's own UI are not affected.")}
            </Paragraph>

            <Notice.Info className={Margins.bottom20}>
                {t("Translations are community-maintained and may be incomplete. If you'd like to help translate NexCord, contributions are welcome!")}
            </Notice.Info>

            {/* Dropdown sÃ©lectif â€” mÃªme composant/pattern que "Cloud Backend" dans CloudTab */}
            <div className={Margins.bottom8}>
                <SafeSearchableSelect
                    options={languageOptions}
                    value={languageOptions.find(o => o.value === current)?.value}
                    onChange={v => selectLang(v as Language)}
                    closeOnSelect={true}
                    renderOptionPrefix={o => o?.value ? <FlagIcon lang={o.value as Language} /> : null}
                />
            </div>

            <Paragraph className={`${Margins.bottom16} ${Margins.top8}`} style={{ color: "var(--text-muted)", fontSize: 13 }}>
                {current && LANG_PREVIEW[current] ? LANG_PREVIEW[current].sample : ""}
            </Paragraph>

            {/* Option de synchronisation de la langue de Discord */}
            <div className={Margins.top16}>
                <FormSwitch
                    title={t("Synchronize Discord Language")}
                    description={t("Automatically change Discord's client language when changing NexCord language.")}
                    value={settings.syncDiscordLanguage ?? false}
                    onChange={v => {
                        settings.syncDiscordLanguage = v;
                        if (v) {
                            syncDiscordLocale(current);
                        }
                    }}
                    hideBorder
                />
            </div>

            <Divider className={Margins.top8} />

            <Notice.Warning className={Margins.top16}>
                <strong>{t("Reload required")}</strong> â€” {t("Please reload Discord after changing the language for all changes to take effect.")}
            </Notice.Warning>
        </SettingsTab>
    );
}

export default wrapTab(LanguageTab, "Language");

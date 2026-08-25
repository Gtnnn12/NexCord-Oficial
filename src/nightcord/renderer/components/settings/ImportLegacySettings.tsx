/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { BaseText } from "@NexCord/types/components";
import { React, useRef, useState } from "@webpack/common";

import { cl } from "./Settings";

function detectSource(json: any): "equicord" | "vencord" | "NexCord" | "unknown" {
    if (!json || typeof json !== "object") {
        return "unknown";
    }

    const settings = json.settings;

    if (!settings || typeof settings !== "object") {
        return "unknown";
    }

    const plugins = settings.plugins || {};
    const pluginNames = Object.keys(plugins);

    if (pluginNames.some(name => ["EquicordHelper", "EquicordCSS"].includes(name))) {
        return "equicord";
    }

    if (pluginNames.some(name => ["NexCordHelper", "equicordHelper"].includes(name))) {
        return "NexCord";
    }

    if (pluginNames.length > 0) {
        return "vencord";
    }

    return "unknown";
}

function cleanForNexCord(json: any): any {
    if (!json || typeof json !== "object") {
        return json;
    }

    const cleaned = JSON.parse(JSON.stringify(json));
    const settings = cleaned.settings;

    if (!settings || !settings.plugins) {
        return cleaned;
    }

    const legacyOnlyPlugins = [
        "EquicordHelper",
        "EquicordCSS",
        "VencordHelper"
    ];

    for (const name of legacyOnlyPlugins) {
        delete settings.plugins[name];
    }

    return cleaned;
}

export function ImportLegacySettingsButton({ settings: _settings }: { settings: any }) {
    const [dragging, setDragging] = useState(false);
    const [status, setStatus] = useState<null | "success" | "error" | "loading">(null);
    const [message, setMessage] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    async function processFile(file: File) {
        setStatus("loading");
        setMessage("Analysing file...");

        try {
            const text = await file.text();
            const json = JSON.parse(text);
            const source = detectSource(json);

            const sourceLabel =
                source === "equicord"
                    ? "Equicord"
                    : source === "vencord"
                        ? "Vencord"
                        : source === "NexCord"
                            ? "NexCord"
                            : "Unknown";

            const cleaned = cleanForNexCord(json);

            await VencordNative.settings.set(cleaned.settings ?? {});

            if (cleaned.quickCss) {
                await VencordNative.quickCss.set(cleaned.quickCss);
            }

            setStatus("success");
            setMessage(
                "Settings from " +
                sourceLabel +
                " imported successfully. Restart NexCord to apply them."
            );
        } catch (error: any) {
            setStatus("error");
            setMessage(
                "Import error: " +
                (error?.message ?? String(error))
            );
        }
    }

    function handleDrop(event: React.DragEvent) {
        event.preventDefault();
        setDragging(false);

        const file = event.dataTransfer.files?.[0];

        if (file) {
            void processFile(file);
        }
    }

    function handleFileInput(event: React.ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];

        if (file) {
            void processFile(file);
        }
    }

    return (
        <div className={cl("category")}>
            <BaseText
                size="lg"
                weight="semibold"
                tag="h3"
                className={cl("category-title")}
            >
                Import Equicord / Vencord Settings
            </BaseText>

            <BaseText
                size="sm"
                style={{
                    marginBottom: "12px",
                    opacity: 0.7
                }}
            >
                Drag and drop your Equicord or Vencord backup JSON file here
                to import your settings into NexCord.
            </BaseText>

            <div
                onDragOver={event => {
                    event.preventDefault();
                    setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
                style={{
                    border: "2px dashed " + (dragging ? "#5865f2" : "#4e5058"),
                    borderRadius: "8px",
                    padding: "28px",
                    textAlign: "center",
                    cursor: "pointer",
                    background: dragging
                        ? "rgba(88,101,242,0.08)"
                        : "rgba(255,255,255,0.03)",
                    transition: "all 0.15s ease",
                    marginBottom: "12px"
                }}
            >
                <div
                    style={{
                        fontSize: "32px",
                        marginBottom: "8px"
                    }}
                >
                    JSON
                </div>

                <BaseText
                    size="sm"
                    style={{
                        opacity: 0.6
                    }}
                >
                    {dragging
                        ? "Release to import..."
                        : "Drag and drop a JSON file here, or click to browse"}
                </BaseText>

                <input
                    ref={inputRef}
                    type="file"
                    accept=".json,application/json"
                    style={{
                        display: "none"
                    }}
                    onChange={handleFileInput}
                />
            </div>

            {status && (
                <BaseText
                    size="sm"
                    style={{
                        padding: "10px 14px",
                        borderRadius: "6px",
                        background:
                            status === "success"
                                ? "rgba(59,165,93,0.15)"
                                : status === "error"
                                    ? "rgba(237,66,69,0.15)"
                                    : "rgba(88,101,242,0.1)",
                        color:
                            status === "success"
                                ? "#3ba55d"
                                : status === "error"
                                    ? "#ed4245"
                                    : "#5865f2",
                        marginTop: "4px"
                    }}
                >
                    {message}
                </BaseText>
            )}
        </div>
    );
}
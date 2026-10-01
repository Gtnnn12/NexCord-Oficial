/*
 * FASE 3 — tipos compartidos entre main y renderer para enabled-plugins.json
 * y el log de tiempos de carga de plugins.
*/

export type PluginSettingsFlags = Record<string, { enabled?: boolean; [key: string]: any; }>;
export type PluginLoadTimes = Record<string, number>;
export type SafeModeInfo = { active: boolean; reason: string };

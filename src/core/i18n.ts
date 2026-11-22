/**
 * Core UI localization primitives (browser-safe, zero runtime dependencies).
 *
 * Runtime default is Simplified Chinese ("zh-CN"), switchable to English ("en")
 * at any time via Settings → Appearance / General (stored in appearance.locale).
 */

export const UI_LOCALES = ["zh-CN", "en"] as const;
export type UiLocale = (typeof UI_LOCALES)[number];

export const DEFAULT_UI_LOCALE: UiLocale = "zh-CN";

export const UI_LOCALE_OPTIONS: ReadonlyArray<{
	id: UiLocale;
	label: string;
	nativeLabel: string;
}> = [
	{ id: "zh-CN", label: "简体中文 (Simplified Chinese)", nativeLabel: "简体中文" },
	{ id: "en", label: "English", nativeLabel: "English" },
];

export function isUiLocale(value: unknown): value is UiLocale {
	return value === "zh-CN" || value === "en";
}

export function formatTemplate(
	template: string,
	params?: Record<string, string | number>,
): string {
	if (!params) return template;
	return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key: string) =>
		key in params ? String(params[key]) : match,
	);
}

export function translateText(
	locale: UiLocale,
	en: string,
	zh: string,
	params?: Record<string, string | number>,
): string {
	return formatTemplate(locale === "zh-CN" ? zh : en, params);
}

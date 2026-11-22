"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { translateText, type UiLocale } from "@/src/core";
import { useAppearance } from "@/components/settings/appearance";
import {
	formatRelativeTime,
	translateCacheRetention,
	translatePhase,
	translatePluginDescription,
	translatePluginName,
	translateRuntimeError,
	translateSlotName,
	translateThemeName,
	translateThinkingLevel,
} from "@/lib/i18n/glossary";

export interface I18nContextValue {
	locale: UiLocale;
	isZh: boolean;
	/** Translate inline bilingual copy with optional `{placeholder}` interpolation. */
	tr: (en: string, zh: string, params?: Record<string, string | number>) => string;
	/** Translate known server/core runtime error strings. */
	tError: (error: string) => string;
	/** Domain translators */
	tPhase: (phase: string) => string;
	tSlot: (slot: string) => string;
	tThinking: (level: string) => string;
	tCacheRetention: (value: string) => string;
	tThemeName: (id: string, fallback: string) => string;
	tPluginName: (id: string, fallback: string) => string;
	tPluginDescription: (id: string, fallback: string) => string;
	formatTimeAgo: (iso: string, now?: Date) => string;
}

export function createI18nValue(locale: UiLocale): I18nContextValue {
	return {
		locale,
		isZh: locale === "zh-CN",
		tr: (en, zh, params) => translateText(locale, en, zh, params),
		tError: (error) => translateRuntimeError(locale, error),
		tPhase: (phase) => translatePhase(locale, phase),
		tSlot: (slot) => translateSlotName(locale, slot),
		tThinking: (level) => translateThinkingLevel(locale, level),
		tCacheRetention: (value) => translateCacheRetention(locale, value),
		tThemeName: (id, fallback) => translateThemeName(locale, id, fallback),
		tPluginName: (id, fallback) => translatePluginName(locale, id, fallback),
		tPluginDescription: (id, fallback) => translatePluginDescription(locale, id, fallback),
		formatTimeAgo: (iso, now = new Date()) => formatRelativeTime(iso, now, locale),
	};
}

/**
 * Fallback context when a component is rendered bare without <I18nProvider>
 * (such as upstream SSR/unit tests): defaults to "en" so existing English
 * assertions stay 100% intact. The live app mounts <I18nProvider> in
 * app/layout.tsx with appearance.locale (defaulting to "zh-CN").
 */
const DEFAULT_CONTEXT_VALUE: I18nContextValue = createI18nValue("en");

const I18nContext = createContext<I18nContextValue>(DEFAULT_CONTEXT_VALUE);

export function I18nProvider({
	children,
	locale: explicitLocale,
}: {
	children: ReactNode;
	/** Optional explicit locale override (primarily for tests). */
	locale?: UiLocale;
}) {
	const { appearance } = useAppearance();
	const locale = explicitLocale ?? appearance.locale;
	const value = useMemo(() => createI18nValue(locale), [locale]);
	return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
	return useContext(I18nContext);
}

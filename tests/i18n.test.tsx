import React from "react";
(globalThis as Record<string, unknown>).React = React;

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
	DEFAULT_UI_LOCALE,
	FACTORY_SETTINGS,
	UI_LOCALES,
	formatTemplate,
	isUiLocale,
	resolveSettings,
	sanitizeUserSettings,
	translateText,
	type ChatListItem,
} from "../src/core/index.ts";
import { parseAppearanceSettingsBody } from "../src/server/settings-body.ts";
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
} from "../lib/i18n/glossary.ts";
import { I18nProvider } from "../components/i18n.tsx";
import { SessionRow } from "../components/sidebar.tsx";
import { SettingsDialogBody } from "../components/settings/settings-dialog.tsx";
import { InterfaceLanguageRow } from "../components/settings/appearance-section.tsx";
import { PhaseDivider } from "../components/phase-divider.tsx";
import { CompactionMomentDivider } from "../components/compaction-divider.tsx";
import { AbortTurnBody } from "../components/abort-turn-dialog.tsx";
import { KnowledgeSummary } from "../components/minimal-home.tsx";
import { MalformedQuestion } from "../components/malformed-question.tsx";

const require = createRequire(import.meta.url);
const appearanceChrome = require("../electron/appearance-chrome.cjs") as {
	normalizeLocale: (value: unknown) => string;
	readLocale: (dataDir: string) => string;
};

function makeChat(overrides: Partial<ChatListItem> = {}): ChatListItem {
	return {
		id: "c1",
		title: "Linear Algebra",
		kind: "teach",
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-01-02T12:00:00.000Z",
		messageCount: 4,
		phase: "teach",
		pendingQuestion: false,
		pendingProblem: false,
		busy: false,
		compacting: false,
		...overrides,
	};
}

describe("core i18n primitives and settings persistence", () => {
	it("defaults runtime UI locale to zh-CN and validates supported locales", () => {
		assert.deepEqual([...UI_LOCALES], ["zh-CN", "en"]);
		assert.equal(DEFAULT_UI_LOCALE, "zh-CN");
		assert.equal(FACTORY_SETTINGS.appearance.locale, "zh-CN");
		assert.equal(isUiLocale("zh-CN"), true);
		assert.equal(isUiLocale("en"), true);
		assert.equal(isUiLocale("fr"), false);
		assert.equal(isUiLocale(null), false);
		assert.equal(formatTemplate("Deleted {n} items", { n: 3 }), "Deleted 3 items");
		assert.equal(translateText("zh-CN", "Save", "保存"), "保存");
		assert.equal(translateText("en", "Save", "保存"), "Save");
	});

	it("sanitizes, parses, and resolves appearance.locale cleanly", () => {
		const validEn = sanitizeUserSettings({ version: 1, appearance: { locale: "en" } });
		assert.equal(validEn?.appearance?.locale, "en");
		assert.equal(resolveSettings(validEn).appearance.locale, "en");

		const validZh = sanitizeUserSettings({ version: 1, appearance: { locale: "zh-CN" } });
		assert.equal(validZh?.appearance?.locale, "zh-CN");
		assert.equal(resolveSettings(validZh).appearance.locale, "zh-CN");

		const invalid = sanitizeUserSettings({ version: 1, appearance: { locale: "jp" } });
		assert.equal(invalid?.appearance?.locale, undefined);
		assert.equal(resolveSettings(invalid).appearance.locale, "zh-CN");

		const parsedOk = parseAppearanceSettingsBody({ locale: "en" });
		assert.equal(parsedOk.ok, true);
		if (parsedOk.ok) assert.equal(parsedOk.settings.locale, "en");

		const parsedBad = parseAppearanceSettingsBody({ locale: "de" });
		assert.equal(parsedBad.ok, false);
	});

	it("translates shared glossary terms, runtime errors, and relative times", () => {
		assert.equal(translatePluginName("zh-CN", "flashcards", "Flashcards"), "闪卡");
		assert.equal(translatePluginName("en", "flashcards", "Flashcards"), "Flashcards");
		assert.match(translatePluginDescription("zh-CN", "coding-questions", ""), /编程题/);
		assert.equal(translatePhase("zh-CN", "probe"), "探测");
		assert.equal(translatePhase("zh-CN", "plan"), "规划");
		assert.equal(translatePhase("zh-CN", "teach"), "教学");
		assert.equal(translateSlotName("zh-CN", "strong"), "强推理");
		assert.equal(translateSlotName("zh-CN", "cheap"), "轻量经济");
		assert.equal(translateSlotName("zh-CN", "vision"), "视觉多模态");
		assert.equal(translateThinkingLevel("zh-CN", "high"), "高");
		assert.equal(translateCacheRetention("zh-CN", "long"), "长期");
		assert.equal(translateThemeName("zh-CN", "default", "Default"), "默认深色");
		assert.equal(
			translateRuntimeError("zh-CN", "No model configured — set up your models first"),
			"尚未配置模型 — 请先完成模型设置",
		);
		assert.equal(
			translateRuntimeError("zh-CN", "No OpenAI key is set — add one in Settings → Keys"),
			"尚未设置 OpenAI 密钥 — 请在「设置 → 模型提供商」中添加",
		);
		const now = new Date("2026-01-02T12:00:00.000Z");
		assert.equal(formatRelativeTime("2026-01-02T11:59:40.000Z", now, "zh-CN"), "刚刚");
		assert.equal(formatRelativeTime("2026-01-02T11:55:00.000Z", now, "zh-CN"), "5 分钟前");
		assert.equal(formatRelativeTime("2026-01-02T09:00:00.000Z", now, "zh-CN"), "3 小时前");
		assert.equal(formatRelativeTime("2025-12-31T12:00:00.000Z", now, "zh-CN"), "2 天前");
	});
});

describe("zh-CN SSR rendering across core UI surfaces", () => {
	it("renders Sidebar SessionRow in Chinese under I18nProvider locale=zh-CN", () => {
		const waiting = renderToStaticMarkup(
			<I18nProvider locale="zh-CN">
				<SessionRow chat={makeChat({ pendingQuestion: true })} active={false} onOpen={() => {}} />
			</I18nProvider>,
		);
		assert.match(waiting, /等待输入/);

		const compactPractice = renderToStaticMarkup(
			<I18nProvider locale="zh-CN">
				<SessionRow chat={makeChat({ kind: "practice", busy: true })} active={false} compact onOpen={() => {}} />
			</I18nProvider>,
		);
		assert.match(compactPractice, /aria-label="练习会话"/);
		assert.match(compactPractice, /处理中/);

		const compacting = renderToStaticMarkup(
			<I18nProvider locale="zh-CN">
				<SessionRow chat={makeChat({ compacting: true })} active={false} onOpen={() => {}} />
			</I18nProvider>,
		);
		assert.match(compacting, /正在压缩上下文/);
	});

	it("renders Settings navigation and language switcher in both zh-CN and en", () => {
		const zhSettings = renderToStaticMarkup(
			<I18nProvider locale="zh-CN">
				<SettingsDialogBody onClose={() => {}} />
			</I18nProvider>,
		);
		for (const label of ["模型提供商", "智能体", "外观", "知识图谱", "快捷键", "通用", "内置插件", "社区插件"]) {
			assert.ok(zhSettings.includes(label), `expected Chinese nav label: ${label}`);
		}

		const zhLangRow = renderToStaticMarkup(
			<I18nProvider locale="zh-CN">
				<InterfaceLanguageRow value="zh-CN" onChange={() => {}} />
			</I18nProvider>,
		);
		assert.ok(zhLangRow.includes("界面语言"));
		assert.ok(zhLangRow.includes('data-testid="locale-zh-CN"'));
		assert.ok(zhLangRow.includes('data-testid="locale-en"'));

		const enSettings = renderToStaticMarkup(
			<I18nProvider locale="en">
				<SettingsDialogBody onClose={() => {}} />
			</I18nProvider>,
		);
		assert.ok(enSettings.includes("Providers"));
		assert.ok(enSettings.includes("Appearance"));
	});

	it("renders session dividers, dialogs, minimal home, and malformed question in Chinese", () => {
		const phaseHtml = renderToStaticMarkup(
			<I18nProvider locale="zh-CN">
				<PhaseDivider phase="teach" />
			</I18nProvider>,
		);
		assert.ok(phaseHtml.includes("教学"));

		const compactHtml = renderToStaticMarkup(
			<I18nProvider locale="zh-CN">
				<CompactionMomentDivider data={{ content: "", details: { tokensBefore: 48000, firstKeptMessageId: "1", at: "2026-01-01T00:00:00.000Z" } }} />
			</I18nProvider>,
		);
		assert.ok(compactHtml.includes("上下文已压缩"));

		const abortHtml = renderToStaticMarkup(
			<I18nProvider locale="zh-CN">
				<AbortTurnBody mode="turn" busy={false} onConfirm={() => {}} onClose={() => {}} />
			</I18nProvider>,
		);
		assert.ok(abortHtml.includes("中止当前回复？"));
		assert.ok(abortHtml.includes("取消"));

		const emptyHome = renderToStaticMarkup(
			<I18nProvider locale="zh-CN">
				<KnowledgeSummary propositions={0} chains={0} teachSessions={0} practiceSessions={0} importedNotes={0} />
			</I18nProvider>,
		);
		assert.match(emptyHome, /知识|会话/);

		const malformed = renderToStaticMarkup(
			<I18nProvider locale="zh-CN">
				<MalformedQuestion onRetry={() => {}} reason="Invalid JSON body" />
			</I18nProvider>,
		);
		assert.ok(malformed.includes("无效的 JSON 请求体"));
	});
});

describe("Electron locale persistence helper", () => {
	it("defaults to zh-CN when settings.json is absent and respects stored en", () => {
		const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lh-i18n-electron-"));
		try {
			assert.equal(appearanceChrome.normalizeLocale(undefined), "zh-CN");
			assert.equal(appearanceChrome.normalizeLocale("en"), "en");
			assert.equal(appearanceChrome.normalizeLocale("zh-CN"), "zh-CN");
			assert.equal(appearanceChrome.readLocale(tmp), "zh-CN");

			fs.writeFileSync(path.join(tmp, "settings.json"), JSON.stringify({ appearance: { locale: "en" } }));
			assert.equal(appearanceChrome.readLocale(tmp), "en");

			fs.writeFileSync(path.join(tmp, "settings.json"), JSON.stringify({ appearance: { locale: "zh-CN" } }));
			assert.equal(appearanceChrome.readLocale(tmp), "zh-CN");
		} finally {
			fs.rmSync(tmp, { recursive: true, force: true });
		}
	});
});

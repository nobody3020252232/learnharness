"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { CLAUDE_CODE_MINIMUM_VERSION, type ClaudeCodeStatus, type UiLocale, type UserSettings } from "@/src/core";
import { useI18n } from "@/components/i18n";
import { notifySettingsSaved, useSettingsSaved } from "@/components/settings-signal";
import { Button } from "@/components/ui/button";
import { Toggle } from "./controls";

export function claudeCodeStatusLabel(status: ClaudeCodeStatus | null, locale: UiLocale = "en"): string {
	const zh = locale === "zh-CN";
	switch (status?.state) {
		case "not-found": return zh ? "未找到" : "Not found";
		case "meets-minimum": return zh ? `版本 ${status.version} · 满足最低要求` : `Version ${status.version} · meets minimum`;
		case "update-required": return zh ? `版本 ${status.version} · 需要更新` : `Version ${status.version} · update required`;
		default: return zh ? "无法检查版本" : "Version could not be checked";
	}
}

export function ClaudeCodeInstallationStatus() {
	const { tr, isZh, locale } = useI18n();
	const [enabled, setEnabled] = useState(false);
	const [loaded, setLoaded] = useState(false);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<"load" | "save" | null>(null);
	const [status, setStatus] = useState<ClaudeCodeStatus | null>(null);
	const [busy, setBusy] = useState(false);
	const request = useRef<AbortController | null>(null);
	const settingsRead = useRef<AbortController | null>(null);
	const settingsWrite = useRef<AbortController | null>(null);

	const read = useCallback(async () => {
		settingsRead.current?.abort();
		const controller = new AbortController();
		settingsRead.current = controller;
		setLoaded(false);
		try {
			const response = await fetch("/api/settings", { cache: "no-store", signal: controller.signal });
			if (!response.ok) throw new Error("settings unavailable");
			const body = await response.json() as { settings: UserSettings | null };
			if (!controller.signal.aborted) {
				setEnabled(body.settings?.claudeCode?.enabled === true);
				setLoaded(true);
				setError(null);
			}
		} catch {
			if (!controller.signal.aborted) setError("load");
		}
	}, []);
	useEffect(() => {
		void read();
		return () => { settingsRead.current?.abort(); settingsWrite.current?.abort(); };
	}, [read]);
	useSettingsSaved((section) => { if (section === "claudeCode") void read(); });

	const save = async (next: boolean) => {
		const controller = new AbortController();
		settingsWrite.current = controller;
		settingsRead.current?.abort();
		setSaving(true);
		setError(null);
		try {
			const response = await fetch("/api/settings/claudeCode", { method: "PUT", headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ enabled: next }), signal: controller.signal });
			if (!response.ok) throw new Error("settings write failed");
			const body = await response.json() as { settings: UserSettings };
			if (typeof body.settings?.claudeCode?.enabled !== "boolean") throw new Error("invalid settings response");
			if (!controller.signal.aborted) {
				setEnabled(body.settings.claudeCode.enabled);
				notifySettingsSaved("claudeCode");
			}
		} catch {
			if (!controller.signal.aborted) setError("save");
		} finally {
			if (!controller.signal.aborted) setSaving(false);
		}
	};

	const refresh = useCallback(async () => {
		if (!enabled) return;
		request.current?.abort();
		const controller = new AbortController();
		request.current = controller;
		setBusy(true);
		try {
			const response = await fetch("/api/claude-code", { cache: "no-store", signal: controller.signal, headers: { "x-learnharness-claude-code": "1" } });
			if (!response.ok) throw new Error("status unavailable");
			const value = await response.json() as ClaudeCodeStatus;
			if (!["not-found", "meets-minimum", "update-required", "version-unchecked"].includes(value.state)
				|| value.minimumVersion !== CLAUDE_CODE_MINIMUM_VERSION
				|| (value.version !== null && (typeof value.version !== "string" || !/^\d+\.\d+\.\d+$/.test(value.version)))) throw new Error("invalid status");
			if (!controller.signal.aborted) setStatus(value);
		} catch {
			if (!controller.signal.aborted) setStatus(null);
		} finally {
			if (!controller.signal.aborted) setBusy(false);
		}
	}, [enabled]);
	useEffect(() => {
		if (enabled) void refresh();
		else { request.current?.abort(); setStatus(null); setBusy(false); }
		return () => request.current?.abort();
	}, [enabled, refresh]);

	return <div className="space-y-2" data-testid="claude-code-installation">
		<div className="flex items-center gap-3">
			<span className="font-prose text-(length:--lh-prose-size) text-foreground">Claude Code</span>
			<Toggle label="Claude Code" testid="toggle-claude-code" checked={enabled} disabled={!loaded || saving} onChange={(next) => void save(next)} />
		</div>
		{error && <p role="alert" className="text-xs text-error">
			{error === "load"
				? tr("Could not load Claude Code settings.", "无法加载 Claude Code 设置。")
				: tr("Could not save Claude Code settings.", "无法保存 Claude Code 设置。")}
		</p>}
		{enabled && <>
			<div className="flex flex-wrap items-center gap-3">
				<span role="status" className="text-xs text-muted-foreground">{busy ? tr("Checking…", "正在检查…") : claudeCodeStatusLabel(status, locale)}</span>
				<Button type="button" size="xs" variant="outline" className="cursor-pointer disabled:cursor-not-allowed" disabled={busy} onClick={() => void refresh()} data-testid="claude-code-check-again">{tr("Check again", "重新检查")}</Button>
			</div>
			<p className="text-xs leading-relaxed text-muted-foreground">
				{isZh
					? <><strong className="font-medium">请先在终端中安装并完成 Claude Code 登录认证，随后在此选择 Claude Code 模型。</strong>LearnHarness 会在需要时自动拉起，无需常驻后台进程。</>
					: <><strong className="font-medium">Install and authenticate Claude Code in your terminal, then select a Claude Code model here.</strong> LearnHarness starts it when needed—no background process required.</>}
			</p>
			<p className="text-xs leading-relaxed text-muted-foreground">
				{isZh
					? <>仅检查安装情况与版本，不检查认证状态、模型权限或额度。计费由 Claude Code 自行管理，要求 v{CLAUDE_CODE_MINIMUM_VERSION}+。<a href="https://code.claude.com/docs/en/setup" target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-foreground">安装指南 ↗</a></>
					: <>Checks installation/version only—not authentication, model access, or quota. Claude Code controls billing. Requires v{CLAUDE_CODE_MINIMUM_VERSION}+. <a href="https://code.claude.com/docs/en/setup" target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-foreground">Setup ↗</a></>}
			</p>
			<p className="text-xs leading-relaxed text-muted-foreground">{tr("Verify AI claims independently—they may be inaccurate, incomplete, misleading, or outdated.", "请独立核实 AI 的陈述——其内容可能存在不准确、不完整、误导性或过时的情况。")}</p>
		</>}
	</div>;
}

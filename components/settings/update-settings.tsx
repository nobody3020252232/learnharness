"use client";

import { useEffect, useState } from "react";
import type { UiLocale } from "@/src/core";
import { useI18n } from "@/components/i18n";
import { Button } from "@/components/ui/button";
import { BrailleSpinner } from "@/components/braille-spinner";
import { SettingsRow, Toggle } from "./controls.tsx";

/** Observational snapshot from electron/main.cjs; never updater permission. */
export type UpdateState = {
	status: "idle" | "checking" | "downloading" | "up-to-date" | "downloaded" | "error" | "disabled";
	version: string | null;
	revision: number;
};

export const APP_VERSION = process.env.LH_VERSION ?? "";
const HOMEPAGE = process.env.LH_HOMEPAGE ?? "";
export const MANUAL_UPDATE_HINT = "Checking downloads available updates. Downloaded updates install when you quit the app.";
export const AUTO_UPDATE_HINT = "Check at startup and every 24 hours. Turning this off does not stop updates already in progress or ready to install.";
const UPDATE_ERROR = "Couldn’t check for updates. Try again later.";

/** Subscribe before requesting the snapshot. IPC replies and pushes can
 * cross; a revision prevents an older reply from hiding a newer event.
 * The banner shares this read-only observer so late loads recover too. */
export function useUpdateState() {
	const [state, setState] = useState<UpdateState | null>(null);
	const [failed, setFailed] = useState(false);
	useEffect(() => {
		const lh = window.lh;
		if (!lh) return;
		let live = true;
		let revision = -1;
		const accept = (next: UpdateState) => {
			if (!live || next.revision < revision) return;
			revision = next.revision;
			setState(next);
			setFailed(false);
		};
		const off = lh.onUpdateStatus?.(accept);
		void lh.getUpdateState?.().then(accept).catch(() => {
			if (live && revision === -1) setFailed(true);
		});
		return () => { live = false; off?.(); };
	}, []);
	return { state, failed };
}

export function updateStatusText(state: UpdateState | null, locale: UiLocale = "en"): string | null {
	const zh = locale === "zh-CN";
	switch (state?.status) {
		case "checking": return zh ? "正在检查更新…" : "Checking for updates…";
		case "downloading":
			return state.version
				? (zh ? `正在下载版本 ${state.version}…` : `Downloading version ${state.version}…`)
				: (zh ? "正在下载更新…" : "Downloading an update…");
		case "up-to-date": return zh ? "上次检查未发现更新版本。" : "No newer version was found at the last check.";
		case "downloaded":
			return state.version
				? (zh ? `版本 ${state.version} 已准备就绪，将在你退出应用时安装。` : `Version ${state.version} is ready. It will install when you quit the app.`)
				: (zh ? "更新已准备就绪，将在你退出应用时安装。" : "An update is ready. It will install when you quit the app.");
		case "error": return zh ? "无法检查更新，请稍后重试。" : UPDATE_ERROR;
		default: return null;
	}
}

/** Version information is useful everywhere; update controls only belong
 * to a shell with an available updater. Opening this row never checks. */
export function UpdateSettings({
	autoUpdate,
	onAutoUpdateChange,
	version = APP_VERSION,
	homepage = HOMEPAGE,
}: {
	autoUpdate: boolean;
	onAutoUpdateChange: (on: boolean) => void;
	version?: string;
	homepage?: string;
}) {
	const { tr, locale } = useI18n();
	const { state, failed } = useUpdateState();
	const [checkFailed, setCheckFailed] = useState(false);
	useEffect(() => setCheckFailed(false), [state]);
	const active = state !== null && state.status !== "disabled";
	const busy = state?.status === "checking" || state?.status === "downloading";
	const status = state?.status === "downloaded" ? updateStatusText(state, locale)
		: failed || checkFailed ? tr(UPDATE_ERROR, "无法检查更新，请稍后重试。") : updateStatusText(state, locale);
	const releaseNotes = version && homepage ? `${homepage}/releases/tag/v${version}` : null;
	const check = () => {
		setCheckFailed(false);
		void window.lh?.checkForUpdates?.().catch(() => setCheckFailed(true));
	};

	return (
		<>
			<SettingsRow
				label={tr("Version {version}", "版本 {version}", { version: version || tr("unknown", "未知") })}
				testid="row-version"
				hint={
					<>
						{status && <span className="block" role="status" data-testid="update-status">{status}</span>}
						{active && <span className="block">{tr(MANUAL_UPDATE_HINT, "检查更新后会自动下载可用版本。已下载的更新将在你退出应用时安装。")}</span>}
						{releaseNotes && <a href={releaseNotes} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:text-foreground hover:underline" data-testid="release-notes">{tr("Release notes", "更新日志")}</a>}
					</>
				}
			>
				{active && (state.status === "downloaded" ? (
					<Button type="button" size="xs" className="cursor-pointer" data-testid="update-restart" onClick={() => window.lh?.installUpdate?.()}>{tr("Restart", "重启更新")}</Button>
				) : (
					<Button type="button" size="xs" variant="outline" className="cursor-pointer disabled:cursor-not-allowed" data-testid="update-check" disabled={busy} aria-busy={busy} onClick={check}>
						{busy && <BrailleSpinner label={state.status === "downloading" ? tr("Downloading update", "正在下载更新") : tr("Checking for updates", "正在检查更新")} />}
						{tr("Check for updates", "检查更新")}
					</Button>
				))}
			</SettingsRow>
			{active && (
				<SettingsRow label={tr("Automatic updates", "自动更新")} hint={tr(AUTO_UPDATE_HINT, "启动时及每 24 小时检查一次更新。关闭此项不会停止正在进行或已准备就绪的更新。")} testid="row-auto-update">
					<Toggle checked={autoUpdate} label={tr("auto update", "自动更新")} testid="toggle-auto-update" onChange={onAutoUpdateChange} />
				</SettingsRow>
			)}
		</>
	);
}

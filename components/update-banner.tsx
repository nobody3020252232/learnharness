"use client";

/**
 * The auto-update banner (Wave C, owner 2026-10-10: silent download +
 * restart-banner UX). The shell pushes "lh:update-status" once a staged
 * update exists (electron/main.cjs update-downloaded). Snapshot retrieval
 * also covers a late load. The card offers Restart alongside Settings.
 * Browser builds have no window.lh and never see a push: renders null.
 *
 * Dismissing hides this version for the mounted window only; the update
 * still installs on quit (autoInstallOnAppQuit) or via Settings.
 */

import { useState } from "react";
import { XIcon } from "lucide-react";
import { useI18n } from "@/components/i18n";
import { useUpdateState } from "@/components/settings/update-settings.tsx";

export default function UpdateBanner() {
	const { tr } = useI18n();
	const { state: ready } = useUpdateState();
	const [dismissedVersion, setDismissedVersion] = useState<string | null>();
	if (ready?.status !== "downloaded" || ready.version === dismissedVersion) return null;
	return (
		<div
			data-testid="update-banner"
			className="fixed right-4 bottom-4 z-50 flex items-center gap-3 rounded-lg border border-border bg-popover px-4 py-3 shadow-lg"
		>
			<div className="text-sm">
				<span className="font-medium">
					{ready.version
						? tr("LearnHarness {version} is ready", "LearnHarness {version} 已准备就绪", { version: ready.version })
						: tr("LearnHarness update is ready", "LearnHarness 更新已准备就绪")}
				</span>
				<span className="text-muted-foreground">{tr(" — restart to finish installing.", " — 重启应用即可完成安装。")}</span>
			</div>
			<button
				type="button"
				onClick={() => window.lh?.installUpdate?.()}
				className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent/80"
			>
				{tr("Restart", "重启")}
			</button>
			<button
				type="button"
				aria-label={tr("Dismiss update notification", "关闭更新通知")}
				onClick={() => setDismissedVersion(ready.version)}
				className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
			>
				<XIcon className="size-4" aria-hidden="true" />
			</button>
		</div>
	);
}

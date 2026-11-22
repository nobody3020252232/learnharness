"use client";
/**
 * THE THEME PICKER (theme wave, 2026-11-04): a grid of theme cards — the
 * presets, then the imported customs, then the dashed "Import JSON" card —
 * under a header that names the active theme and offers "Export JSON".
 *
 * Each card previews its theme with literal colors (never the page's live
 * tokens): an "Aa ai" sample on the theme background (text + accent ink)
 * and four dots — surface, accent, error, success. Picking a card only
 * changes `appearance.theme`; overrides ride along untouched. Imports POST
 * the file's JSON to /api/themes (the server validates; its error shows in
 * the import card). Export downloads the ACTIVE theme with every override
 * applied — re-importing it reproduces what is on screen.
 */

import { useRef, useState } from "react";
import { CheckIcon, DownloadIcon, Trash2Icon, UploadIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { exportThemeFile, type AppearanceSettings, type Theme } from "@/src/core";
import { useI18n } from "@/components/i18n";

/** The selected card's frame: a 2px gap in the dialog surface, then a 1px
 *  ring in the theme accent (the check by the name does the rest). */
const SELECTED_FRAME = "shadow-[0_0_0_2px_var(--card),0_0_0_3px_var(--lh-accent)]";

function Dot({ color, edge }: { color: string; edge?: string }) {
	return (
		<span
			aria-hidden
			className="size-3 rounded-full"
			style={{ background: color, ...(edge ? { border: `1px solid ${edge}` } : {}) }}
		/>
	);
}

/** The literal-color miniature: never reads the page tokens. */
function Preview({ theme }: { theme: Theme }) {
	const c = theme.colors;
	return (
		<span
			aria-hidden
			className="flex h-11 items-center justify-between rounded-md border px-3"
			style={{ background: c.background, borderColor: c.border }}
		>
			<span className="font-prose text-xl font-semibold" style={{ color: c.text }}>
				Aa <i className="font-normal" style={{ color: c.accent }}>ai</i>
			</span>
			<span className="flex gap-1.5">
				<Dot color={c.surface} edge={c.border} />
				<Dot color={c.accent} />
				<Dot color={c.error} />
				<Dot color={c.success} />
			</span>
		</span>
	);
}

/** Save a JSON file through a transient object URL (browser + Electron). */
function downloadJson(filename: string, data: unknown) {
	const url = URL.createObjectURL(new Blob([`${JSON.stringify(data, null, "\t")}\n`], { type: "application/json" }));
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}

/** The Theme row of Settings → Appearance (see the file header). */
export function ThemeCards({
	themes,
	active,
	appearance,
	onSelect,
	onRemoved,
	onImported,
}: {
	/** Presets, then customs (the provider's catalog). */
	themes: readonly Theme[];
	/** The active theme — its card is pressed. */
	active: Theme;
	/** The record delta — the export applies its overrides. */
	appearance: AppearanceSettings | undefined;
	onSelect: (id: string) => void;
	/** After a successful DELETE (the catalog must be re-read). */
	onRemoved: (theme: Theme) => void;
	/** After a successful import (the catalog must be re-read). */
	onImported: (theme: Theme) => void;
}) {
	const { tr, tThemeName, tError } = useI18n();
	const fileRef = useRef<HTMLInputElement>(null);
	const [importError, setImportError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	const modeLabel = (mode: "dark" | "light") => (mode === "dark" ? tr("dark", "深色") : tr("light", "浅色"));
	const activeName = tThemeName(active.id, active.name);

	const importFile = async (file: File) => {
		setImportError(null);
		let body: unknown;
		try {
			body = JSON.parse(await file.text());
		} catch {
			setImportError(tr("{name} is not valid JSON", "{name} 不是有效的 JSON 文件", { name: file.name }));
			return;
		}
		setBusy(true);
		try {
			const res = await fetch("/api/themes", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(body),
			});
			const out = (await res.json().catch(() => ({}))) as { theme?: Theme; error?: string };
			if (!res.ok || !out.theme) {
				setImportError(out.error ? tError(out.error) : tr("import failed ({status})", "导入失败（{status}）", { status: res.status }));
				return;
			}
			onImported(out.theme);
		} catch {
			setImportError(tr("import failed (network)", "导入失败（网络错误）"));
		} finally {
			setBusy(false);
		}
	};

	const remove = async (theme: Theme) => {
		const res = await fetch(`/api/themes/${encodeURIComponent(theme.id)}`, { method: "DELETE" }).catch(() => null);
		if (res?.ok) onRemoved(theme);
	};

	return (
		<div data-testid="row-theme" className="flex flex-col gap-3 py-1">
			<div className="flex items-end justify-between gap-4">
				<span className="min-w-0">
					<span className="block font-prose text-(length:--lh-prose-size)">{tr("Theme", "主题")}</span>
					<span data-testid="theme-hint" className="block text-xs text-muted-foreground/70">
						{tr("{name} · {mode} · sets every color below", "{name} · {mode} · 应用于下方全部颜色", {
							name: activeName,
							mode: modeLabel(active.mode),
						})}
					</span>
				</span>
				<button
					type="button"
					data-testid="theme-export"
					onClick={() => downloadJson(`${active.id}.json`, exportThemeFile(active, appearance))}
					className="flex h-7 shrink-0 items-center gap-2 rounded-sm border border-border bg-background px-2 font-ui text-xs text-foreground transition-colors hover:border-muted-foreground/50"
				>
					<DownloadIcon className="size-3.5" />
					{tr("Export JSON", "导出 JSON")}
				</button>
			</div>
			<div className="grid grid-cols-3 gap-3">
				{themes.map((theme) => {
					const selected = theme.id === active.id;
					const displayName = tThemeName(theme.id, theme.name);
					return (
						<div key={theme.id} className="relative min-w-0">
							<button
								type="button"
								data-testid={`theme-card-${theme.id}`}
								aria-pressed={selected}
								onClick={() => onSelect(theme.id)}
								className={cn(
									"flex w-full flex-col gap-2.5 rounded-lg border border-border bg-background p-3 text-left transition-colors",
									selected ? SELECTED_FRAME : "hover:border-muted-foreground/50",
								)}
							>
								<Preview theme={theme} />
								<span className={cn("flex items-center justify-between gap-2", !theme.builtin && "pr-6")}>
									<span className="flex min-w-0 items-center gap-1.5 font-prose text-base">
										{selected && <CheckIcon className="size-3.5 shrink-0" strokeWidth={2.5} />}
										<span className="truncate">{displayName}</span>
									</span>
									<span className="shrink-0 rounded-sm border border-border px-1.5 font-ui text-xs uppercase tracking-wider text-muted-foreground">
										{theme.builtin ? modeLabel(theme.mode) : tr("custom", "自定义")}
									</span>
								</span>
							</button>
							{!theme.builtin && (
								<button
									type="button"
									aria-label={tr("Remove {name}", "移除 {name}", { name: displayName })}
									data-testid={`theme-remove-${theme.id}`}
									onClick={() => void remove(theme)}
									className="absolute right-3 bottom-3 flex size-5 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:text-error"
								>
									<Trash2Icon className="size-3.5" />
								</button>
							)}
						</div>
					);
				})}
				<button
					type="button"
					data-testid="theme-import"
					disabled={busy}
					onClick={() => fileRef.current?.click()}
					className="flex min-h-27 flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-muted-foreground/50 p-3 text-center font-ui text-xs text-muted-foreground transition-colors hover:text-foreground"
				>
					<UploadIcon className="size-4" />
					<span>{tr("Import JSON", "导入 JSON")}</span>
					{importError ? (
						<span data-testid="theme-import-error" className="text-error">{importError}</span>
					) : (
						<span className="text-muted-foreground/70">{tr("name · mode · colors", "名称 · 模式 · 配色")}</span>
					)}
				</button>
				<input
					ref={fileRef}
					type="file"
					accept=".json,application/json"
					hidden
					data-testid="theme-import-file"
					onChange={(e) => {
						const file = e.target.files?.[0];
						e.target.value = ""; // the same file can be picked again
						if (file) void importFile(file);
					}}
				/>
			</div>
		</div>
	);
}

"use client";

import { RefreshCw, Settings } from "lucide-react";
import { useI18n } from "@/components/i18n";
import { usePlugins } from "@/components/plugins";
import type { FrontendPlugin } from "@/components/plugin-manager";
import { Button } from "@/components/ui/button";
import { SettingsRow, SettingsSection, Toggle } from "./controls";

export const PLUGIN_TRUST_WARNING = "Only enable plugins you trust. Plugins run trusted local code with broad file and network access; they are not sandboxed. A broken plugin may require restarting LearnHarness.";

export function PluginsSection({ onOpenSettings, origin = "community" }: { onOpenSettings?: (pluginId: string) => void; origin?: "core" | "community" }) {
	const { tr, isZh, tError } = useI18n();
	const { manager, snapshot } = usePlugins();
	const core = origin === "core";
	const plugins = snapshot.plugins.filter(plugin => plugin.info.origin === origin);
	return <SettingsSection title={core ? tr("Core plugins", "内置插件") : tr("Community plugins", "社区插件")} testid={core ? "section-core-plugins" : "section-plugins"}>
		{!core && <>
		<p className="font-prose text-sm text-muted-foreground">{tr(PLUGIN_TRUST_WARNING, "请仅启用你信任的插件。插件以受信任的本地代码运行，拥有广泛的文件与网络访问权限，未进行沙箱隔离。出现故障的插件可能需要重启 LearnHarness。")}</p>
		<details data-testid="plugin-install-help" className="text-xs text-muted-foreground">
			<summary className="w-fit cursor-pointer list-none text-muted-foreground underline underline-offset-2 hover:text-foreground [&::-webkit-details-marker]:hidden">{tr("How to install a plugin", "如何安装插件")}</summary>
			<ol className="mt-2 list-decimal space-y-2 pl-5">
				<li>{tr("Clone or copy the plugin into the directory below, using its plugin ID as the folder name.", "将插件克隆或复制到下方目录中，并以插件 ID 作为文件夹名称。")}</li>
				<li>{isZh
					? <>对于源码项目，请按仓库说明安装依赖并运行 <code>npm run build</code>。预构建包已包含 <code>dist/manifest.json</code>，无需构建。</>
					: <>For source projects, follow the repository’s dependency setup and run <code>npm run build</code>. Prebuilt packages already contain <code>dist/manifest.json</code> and need no build.</>}</li>
				<li>{tr("Refresh the list, then enable the plugin. New plugins are disabled by default.", "刷新列表后启用插件。新插件默认处于禁用状态。")}</li>
				<li>{isZh
					? <>修改已加载的代码后请重启 LearnHarness。更新插件时请保留与 <code>dist/</code> 同级的 <code>data/</code> 目录。</>
					: <>Restart LearnHarness after changing loaded code. Preserve <code>data/</code> beside <code>dist/</code> when updating.</>}</li>
			</ol>
		</details>
		<div data-testid="plugin-authoring-help" className="space-y-2 border-t border-border/60 pt-3">
			<h3 className="text-xs uppercase tracking-widest">{tr("Build a plugin", "开发插件")}</h3>
			<p className="font-prose text-sm text-muted-foreground">{tr("Download the authoring skill for your coding agent.", "下载供你的编程 Agent 使用的插件开发技能包。")}</p>
			<Button variant="outline" size="sm" asChild><a href="/plugin-authoring/learnharness-plugins.zip" download={`learnharness-plugins-${process.env.LH_VERSION ?? "authoring"}.zip`} data-testid="download-plugin-authoring">{tr("Download authoring skill", "下载开发技能包")}</a></Button>
		</div>
		<div data-testid="plugin-directory" className="border-t border-border/60 pt-3">
			<p className="text-xs text-muted-foreground">{tr("Plugins directory", "插件目录")}</p>
			<div className="mt-1 flex items-center gap-3">
				<code className="min-w-0 flex-1 break-all text-xs select-text">{snapshot.directory}</code>
				<Button variant="outline" size="icon-sm" aria-label={tr("Refresh plugins", "刷新插件")} title={tr("Refresh plugins", "刷新插件")} aria-busy={snapshot.refreshing}
					disabled={!manager || snapshot.refreshing || snapshot.plugins.some(plugin => plugin.busy)} onClick={() => void manager?.refresh()}>
					<RefreshCw aria-hidden="true" className={snapshot.refreshing ? "animate-spin" : undefined} />
				</Button>
			</div>
		</div>
		{snapshot.conflicts.map(conflict => <p role="alert" key={conflict.id} className="break-words text-xs text-destructive">{tError(conflict.error)}</p>)}
		</>}
		{snapshot.error && <p role="alert" className="text-xs text-destructive">{tError(snapshot.error)}</p>}
		{snapshot.loading ? <p role="status" className="text-xs text-muted-foreground">{tr("Loading plugins…", "正在加载插件…")}</p>
			: plugins.length === 0 ? <p className="text-xs text-muted-foreground">{core ? tr("No Core plugins available.", "暂无可用的内置插件。") : tr("No community plugins installed.", "尚未安装社区插件。")}</p>
				: plugins.map(plugin => <PluginRow key={plugin.info.id} plugin={plugin}
					onSettings={() => onOpenSettings?.(plugin.info.id)} />)}
	</SettingsSection>;
}

function PluginRow({ plugin, onSettings }: { plugin: FrontendPlugin; onSettings: () => void }) {
	const { tr, tPluginName, tPluginDescription, tError } = useI18n();
	const { manager, snapshot } = usePlugins();
	const { info } = plugin;
	const rawName = info.manifest?.name ?? info.id;
	const name = tPluginName(info.id, rawName);
	const description = info.manifest?.description ? tPluginDescription(info.id, info.manifest.description) : undefined;
	const toggleTestid = `toggle-${`Enable ${rawName}`.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
	return <div className="border-t border-border/60 pt-3" data-testid={`plugin-${info.id}`}>
		<SettingsRow label={name} hint={[info.origin === "community" ? info.manifest?.version : undefined, plugin.busy ? tr("Saving…", "正在保存…") : plugin.error ? tr("Error", "错误") : plugin.phase === "loading" ? tr("Loading…", "正在加载…") : info.enabled ? tr("Enabled", "已启用") : tr("Disabled", "已禁用")].filter(Boolean).join(" · ")}>
			<div className="flex shrink-0 items-center gap-2">
				{info.enabled && <button type="button" aria-label={tr("Settings for {name}", "{name} 的设置", { name })} title={tr("Settings for {name}", "{name} 的设置", { name })}
					className="flex size-7 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
					onClick={onSettings}><Settings className="size-3.5" aria-hidden="true" /></button>}
				<Toggle label={tr("Enable {name}", "启用 {name}", { name })} testid={toggleTestid} checked={info.enabled} disabled={!manager || plugin.busy || snapshot.refreshing || (!info.manifest && !info.enabled)} onChange={enabled => void manager?.setEnabled(info.id, enabled)} />
			</div>
		</SettingsRow>
		{description && <p className="mt-1 font-prose text-sm text-muted-foreground">{description}</p>}
		{plugin.error && <p role="alert" className="mt-2 break-words text-xs text-destructive">{tError(plugin.error)}</p>}
	</div>;
}

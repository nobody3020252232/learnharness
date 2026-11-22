"use client";

import Link from "next/link";
import { useRef } from "react";
import { usePathname } from "next/navigation";
import { SurfaceRegion, usePageSurfaceBoundary } from "./plugin-surfaces";
import { PluginMountPoint, usePlugins } from "@/components/plugins";
import { SettingsIcon } from "lucide-react";
import { TopBar } from "@/components/top-bar";
import { PluginTopBarActions } from "@/components/plugin-chrome";
import { usePluginShortcutPage } from "@/components/plugin-shortcuts";
import { Hint } from "@/components/ui/hint";
import { useSettingsDialog } from "@/components/settings/settings-dialog";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/i18n";

export function PluginViewScreen({ pluginId, viewId }: { pluginId: string; viewId: string }) {
	const { tr, tError, tPluginName } = useI18n();
	const { snapshot } = usePlugins();
	const { open } = useSettingsDialog();
	const pathname = usePathname();
	const bodyRef = useRef<HTMLDivElement>(null);
	const viewPath = `/plugins/${encodeURIComponent(pluginId)}/${encodeURIComponent(viewId)}`;
	const surfaceTarget = usePageSurfaceBoundary({ active: pathname === viewPath, viewKey: viewPath, bodyRef });
	const plugin = snapshot.plugins.find(item => item.info.id === pluginId);
	const view = plugin?.views.find(item => item.id === viewId);
	const loading = snapshot.loading || plugin?.phase === "loading";
	usePluginShortcutPage(viewPath, () => view && plugin?.info.enabled && pathname === viewPath
		? { surface: "plugin-view", pluginId, viewId } : undefined);
	const unavailable = !plugin
		? tr("Plugin is not installed.", "插件未安装。")
		: !plugin.info.enabled
			? tr("This plugin is disabled.", "此插件已禁用。")
			: tr("This plugin view is not available.", "此插件视图不可用。");
	const pluginDisplayName = plugin?.info.manifest?.name ? tPluginName(plugin.info.id, plugin.info.manifest.name) : undefined;
	const heading = view?.name
		? (view.name === plugin?.info.manifest?.name ? tPluginName(pluginId, view.name) : view.name)
		: (pluginDisplayName ?? tr("Plugin", "插件"));
	return <div className="flex h-dvh min-w-0 flex-col">
		<TopBar>
			<h1 data-plugin-chrome-title className="min-w-0 truncate font-title text-3xl tracking-tight">{heading}</h1>
			<div className="min-w-4 flex-1" aria-hidden="true" />
			<PluginTopBarActions context={{ placement: "top-bar", surface: "plugin-view", pluginId, viewId }} />
			<Hint label={tr("Plugin settings", "插件设置")} side="bottom">
				<Button variant="ghost" size="icon" aria-label={tr("Plugin settings", "插件设置")} title={tr("Plugin settings", "插件设置")} className="shrink-0" onClick={() => open(`plugin:${pluginId}`)}><SettingsIcon className="size-4" /></Button>
			</Hint>
		</TopBar>
		<div ref={bodyRef} className="relative flex min-h-0 min-w-0 flex-1 flex-col">
			<div data-plugin-view-scroll="" className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
				{snapshot.error && <p role="alert" className="px-5 py-3 text-xs text-destructive">{tError(snapshot.error)}</p>}
				{plugin?.error && <p role="alert" className="px-5 py-3 text-xs text-destructive">{tError(plugin.error)}</p>}
				{loading ? <p role="status" className="px-5 py-4 text-xs text-muted-foreground">{tr("Loading plugin…", "正在加载插件…")}</p>
					: view && plugin?.info.enabled ? <PluginMountPoint key={`${pluginId}/${viewId}/${plugin.info.revision}`} pluginId={pluginId} mount={view.mount} label={view.name} />
						: <div className="px-5 py-4 text-sm text-muted-foreground"><p>{unavailable}</p><Link href="/" className="mt-3 inline-block underline">{tr("Back to home", "返回首页")}</Link></div>}
			</div>
			<SurfaceRegion target={surfaceTarget} />
		</div>
	</div>;
}

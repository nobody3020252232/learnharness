"use client";

import type { FrontendPlugin } from "@/components/plugin-manager";
import { useI18n } from "@/components/i18n";
import { PluginMountPoint } from "@/components/plugins";
import { PluginSettingsRows } from "@/components/plugin-ui-host";
import { SettingsSection } from "./controls";

/** Plugin persistence belongs to the registration; the host only presents it. */
export function PluginSettingsPage({ plugin }: { plugin: FrontendPlugin }) {
	const { tr, tPluginName, tError } = useI18n();
	const { info, settings } = plugin;
	const name = tPluginName(info.id, info.manifest?.name ?? info.id);
	return <SettingsSection title={name} testid={`section-plugin-${info.id}`}>
		{plugin.error && <p role="alert" className="break-words text-xs text-destructive">{tError(plugin.error)}</p>}
		{plugin.phase === "loading" ? <p role="status" className="text-xs text-muted-foreground">{tr("Loading plugin settings…", "正在加载插件设置…")}</p>
			: plugin.phase === "error" ? !plugin.error && <p role="alert" className="text-xs text-destructive">{tr("Plugin settings could not be loaded.", "无法加载插件设置。")}</p>
				: !settings ? <p className="text-xs text-muted-foreground">{tr("No settings available.", "暂无可用设置。")}</p>
					: typeof settings === "function" ? <PluginMountPoint pluginId={info.id} mount={settings} label={tr("{name} settings", "{name} 设置", { name })} />
						: <PluginSettingsRows schema={settings} />}
	</SettingsSection>;
}

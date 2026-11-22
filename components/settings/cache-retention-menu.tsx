"use client";

import type { CacheRetention } from "@earendil-works/pi-ai";
import type { UiLocale } from "@/src/core";
import { useI18n } from "@/components/i18n";

const OPTIONS = [
	{
		value: undefined,
		compact: "default",
		compactZh: "默认",
		label: "Pi default",
		labelZh: "Pi 默认",
		description: "Leave the option unset. Pi’s normal behavior and environment override apply.",
		descriptionZh: "不显式设置，沿用 Pi 的默认策略及环境变量覆盖。",
	},
	{
		value: "none",
		compact: "not requested",
		compactZh: "不请求",
		label: "Don’t request caching",
		labelZh: "不请求缓存",
		description: "Pass Pi’s native none preference. Providers may still cache automatically.",
		descriptionZh: "向 Pi 传递原生的 none 偏好；部分提供商仍可能自动缓存。",
	},
	{
		value: "short",
		compact: "short",
		compactZh: "短期",
		label: "Short retention",
		labelZh: "短期保留",
		description: "Pass Pi’s native short preference. The duration depends on the provider and model.",
		descriptionZh: "向 Pi 传递原生的 short 偏好，具体保留时长取决于提供商与模型。",
	},
	{
		value: "long",
		compact: "long",
		compactZh: "长期",
		label: "Long retention",
		labelZh: "长期保留",
		description: "Pass Pi’s native long preference. Cache-write costs may be higher.",
		descriptionZh: "向 Pi 传递原生的 long 偏好，缓存写入费用可能更高。",
	},
] as const;

export function cacheRetentionLabel(value: CacheRetention | undefined, locale: UiLocale = "en"): string {
	const option = OPTIONS.find((entry) => entry.value === value)!;
	return locale === "zh-CN" ? `缓存：${option.compactZh}` : `Cache: ${option.compact}`;
}

export function CacheRetentionMenu({ value, onPick }: {
	value: CacheRetention | undefined;
	onPick: (value: CacheRetention | undefined) => void;
}) {
	const { tr } = useI18n();
	return <>
		<div className="border-b border-border px-2 pb-2">
			<p className="text-card-foreground">{tr("Cache retention", "缓存保留")}</p>
			<p className="mt-1 text-muted-foreground">{tr("Controls the cache-retention preference sent to Pi. Support and duration depend on the provider and model. This does not guarantee a cache hit.", "控制发送给 Pi 的缓存保留偏好。实际支持情况与保留时长取决于模型提供商与模型，不保证一定命中缓存。")}</p>
		</div>
		{OPTIONS.map((option) => <button
			key={option.value ?? "default"}
			type="button"
			data-testid={`cache-retention-option-${option.value ?? "default"}`}
			aria-pressed={value === option.value}
			onClick={() => onPick(option.value)}
			className={`rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted ${value === option.value ? "bg-muted/60" : ""}`}
		>
			<span className="flex justify-between gap-2 text-card-foreground"><span>{tr(option.label, option.labelZh)}</span>{value === option.value && <span aria-hidden>✓</span>}</span>
			<span className="mt-1 block text-muted-foreground">{tr(option.description, option.descriptionZh)}</span>
		</button>)}
	</>;
}

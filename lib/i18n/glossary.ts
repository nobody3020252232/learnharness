import { translateText, type UiLocale } from "@/src/core";

/**
 * Shared domain terminology & runtime-string translators (server errors,
 * phases, model slots, thinking levels, core plugins, relative time).
 */

export const CORE_PLUGIN_META: Readonly<
	Record<string, { name: { en: string; zh: string }; description: { en: string; zh: string } }>
> = {
	flashcards: {
		name: { en: "Flashcards", zh: "闪卡" },
		description: {
			en: "Generate fact-recall cues from your knowledge graph and review them with FSRS-6. Generation uses your configured model and may incur cost. Native only; no Anki integration.",
			zh: "从你的知识图谱生成记忆回顾卡片，并使用 FSRS-6 间隔重复算法复习。生成卡片会调用你配置的模型并可能产生费用。仅限本地原生功能，不集成 Anki。",
		},
	},
	"coding-questions": {
		name: { en: "Coding questions", zh: "编程题" },
		description: {
			en: "Teaching questions and coding practice with syntax highlighting and automatic tests using your installed tools. Runs local code with your user permissions; not sandboxed.",
			zh: "支持语法高亮与自动测试的教学编程题和编程练习，基于本机已安装的工具链运行。代码将以当前用户权限在本地执行，无沙箱隔离。",
		},
	},
	"drawing-pad": {
		name: { en: "Drawing Pad", zh: "画板" },
		description: {
			en: "Draw over read-only question references and send your working with learner submissions.",
			zh: "在只读题目参考图上进行手绘演算，并将作图过程随答题一起提交。",
		},
	},
	"rich-code-blocks": {
		name: { en: "Rich code blocks", zh: "富代码块" },
		description: {
			en: "Static chemical structures, musical notation and technical diagrams from SMILES, ABC and TikZ code blocks.",
			zh: "将 SMILES、ABC 与 TikZ 代码块渲染为静态化学结构式、乐谱与专业示意图。",
		},
	},
	"ui-showcase": {
		name: { en: "UI Showcase", zh: "界面组件展示" },
		description: {
			en: "Interactive gallery of LearnHarness plugin UI components and surfaces.",
			zh: "LearnHarness 插件 UI 组件与交互界面的展示画廊。",
		},
	},
};

export function translatePluginName(locale: UiLocale, id: string, fallback: string): string {
	const entry = CORE_PLUGIN_META[id];
	if (!entry) return fallback;
	return locale === "zh-CN" ? entry.name.zh : entry.name.en;
}

export function translatePluginDescription(locale: UiLocale, id: string, fallback: string): string {
	const entry = CORE_PLUGIN_META[id];
	if (!entry) return fallback;
	return locale === "zh-CN" ? entry.description.zh : entry.description.en;
}

export function translatePhase(locale: UiLocale, phase: string): string {
	if (locale !== "zh-CN") {
		if (phase === "probe") return "Probing";
		if (phase === "plan") return "Planning";
		if (phase === "teach") return "Teaching";
		return phase;
	}
	if (phase === "probe") return "探测";
	if (phase === "plan") return "规划";
	if (phase === "teach") return "教学";
	return phase;
}

export function translateSlotName(locale: UiLocale, slot: string): string {
	if (locale !== "zh-CN") {
		if (slot === "strong") return "Strong";
		if (slot === "cheap") return "Cheap";
		if (slot === "vision") return "Vision";
		return slot;
	}
	if (slot === "strong") return "强推理";
	if (slot === "cheap") return "轻量经济";
	if (slot === "vision") return "视觉多模态";
	return slot;
}

export function translateThinkingLevel(locale: UiLocale, level: string): string {
	if (locale !== "zh-CN") return level;
	switch (level) {
		case "off": return "关闭";
		case "minimal": return "极低";
		case "low": return "低";
		case "medium": return "中";
		case "high": return "高";
		case "xhigh": return "极高";
		case "max": return "最大";
		default: return level;
	}
}

export function translateCacheRetention(locale: UiLocale, value: string): string {
	if (locale !== "zh-CN") {
		switch (value) {
			case "none": return "Off";
			case "short": return "Short";
			case "long": return "Long";
			default: return value;
		}
	}
	switch (value) {
		case "none": return "关闭";
		case "short": return "短期";
		case "long": return "长期";
		default: return value;
	}
}

export function translateThemeName(locale: UiLocale, id: string, fallback: string): string {
	if (locale !== "zh-CN") return fallback;
	switch (id) {
		case "default": return "默认深色";
		case "ivory": return "象牙白";
		case "pastel": return "柔和粉彩";
		default: return fallback;
	}
}

/**
 * Translate well-known backend/core English error strings into Chinese while
 * preserving dynamic parts (provider names, HTTP statuses, etc.).
 */
export function translateRuntimeError(locale: UiLocale, error: string): string {
	if (locale !== "zh-CN" || !error) return error;

	if (error === "No model configured — set up your models first") {
		return "尚未配置模型 — 请先完成模型设置";
	}
	if (error.startsWith("No model configured — set up your models first")) {
		return error.replace("No model configured — set up your models first", "尚未配置模型 — 请先完成模型设置");
	}
	if (error === "Claude Code is unavailable. Enable and set it up in Settings → Providers.") {
		return "Claude Code 当前不可用。请在「设置 → 模型提供商」中启用并完成配置。";
	}
	const keyMissing = /^No (.+?) key is set — add one in Settings → Keys$/.exec(error);
	if (keyMissing) {
		return `尚未设置 ${keyMissing[1]} 密钥 — 请在「设置 → 模型提供商」中添加`;
	}
	if (error === "Invalid JSON body") return "无效的 JSON 请求体";
	if (error === "Request failed") return "请求失败";
	if (error === "Network error") return "网络错误";
	if (error === "Failed to load") return "加载失败";
	if (error === "Failed to save") return "保存失败";
	if (error === "Failed to save settings") return "保存设置失败";
	if (error === "Failed to load settings") return "加载设置失败";
	if (error === "Failed to connect") return "连接失败";
	if (error === "Session not found") return "未找到该会话";
	if (error === "Turn aborted") return "当前回复已中止";
	return error;
}

export function formatRelativeTime(iso: string, now: Date, locale: UiLocale): string {
	const d = new Date(iso);
	const diff = now.getTime() - d.getTime();
	if (diff < 60_000) return translateText(locale, "just now", "刚刚");
	if (diff < 3_600_000) {
		const m = Math.floor(diff / 60_000);
		return translateText(locale, `${m}m ago`, `${m} 分钟前`);
	}
	if (diff < 86_400_000) {
		const h = Math.floor(diff / 3_600_000);
		return translateText(locale, `${h}h ago`, `${h} 小时前`);
	}
	if (diff < 7 * 86_400_000) {
		const days = Math.floor(diff / 86_400_000);
		return translateText(locale, `${days}d ago`, `${days} 天前`);
	}
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

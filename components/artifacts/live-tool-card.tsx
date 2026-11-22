"use client";

import { ChevronRight } from "lucide-react";
import { BrailleSpinner } from "@/components/braille-spinner";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { useI18n } from "@/components/i18n";
import { toolActivityLabel } from "@/src/core";
import type { ArtifactPartProps } from "@/src/core";

const ACTIVITY_ZH: Readonly<Record<string, string>> = {
	"Reading a file…": "正在读取文件…",
	"Listing a directory…": "正在列出目录…",
	"Finding files…": "正在查找文件…",
	"Searching file contents…": "正在搜索文件内容…",
	"Dispatching research…": "正在派发调研任务…",
	"Building a demo…": "正在构建交互演示…",
	"Making a visual…": "正在绘制图解…",
	"Reading a PDF…": "正在阅读 PDF…",
	"Drawing up the plan…": "正在制定学习规划…",
	"Concluding the assessment…": "正在总结探测评估…",
	"Writing a question…": "正在编写题目…",
	"Working…": "正在处理…",
};

/**
 * The LIVE tool-input card (owner, streaming round 2026-10-01): what a
 * tool call looks like while the agent WRITES it. A tool part sits in
 * `input-streaming` for its whole execution (the bridge defers
 * input-available to tool_execution_end), so this card IS the working
 * state — spinner + shimmered activity label in the header (the retired
 * transcript bottom line's text, same recipe as the thinking row), and
 * the streaming input itself watchable on expand. The moment the call
 * settles, the part re-renders through the artifact registry and the
 * quiet settled card replaces this one.
 *
 * The one working-state grammar everywhere (owner): Braille spinner +
 * Shimmer(duration 1) — the thinking row, this card, the sidebar row.
 */
interface StreamingToolPart {
	type: string;
	state: string;
	toolCallId: string;
	input?: unknown;
}

export function LiveToolCard({ part }: ArtifactPartProps) {
	const { tr, isZh } = useI18n();
	const p = part as StreamingToolPart;
	const tool = p.type.replace(/^tool-/, "");
	const inp = (p.input ?? {}) as Record<string, unknown>;
	// The headline argument (ToolCallCard's rule, shown as given): path for
	// read/ls, pattern for find/grep, session for list_propositions.
	let arg = "";
	if (typeof inp.path === "string" && inp.path) arg = inp.path;
	else if (typeof inp.pattern === "string" && inp.pattern) arg = inp.pattern;
	else if (typeof inp.session === "string" && inp.session) arg = inp.session;

	const hasInput = p.input != null && Object.keys(inp).length > 0;
	const rawActivity = toolActivityLabel(tool);
	const activity = isZh ? (ACTIVITY_ZH[rawActivity] ?? rawActivity) : rawActivity;

	return (
		<details
			data-testid="live-tool-card"
			data-tool={tool}
			className="group my-1 w-full max-w-2xl select-none"
		>
			<summary className="flex cursor-pointer list-none items-center gap-2 text-xs text-muted-foreground [&::-webkit-details-marker]:hidden">
				<BrailleSpinner label={tr("{activity} — live", "{activity} — 进行中", { activity })} />
				<Shimmer duration={1} className="text-xs">
					{activity}
				</Shimmer>
				{arg && <span className="truncate">{arg}</span>}
				<ChevronRight className="size-3 shrink-0 opacity-50 transition-transform group-open:rotate-90" />
			</summary>
			<div className="mt-2 rounded-xl border bg-card p-3 text-xs">
				<div className="mb-1 font-medium uppercase tracking-wide text-muted-foreground">{tr("Input (streaming)", "输入参数（流式传输中）")}</div>
				<pre className="max-h-32 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed">
					{hasInput ? JSON.stringify(p.input, null, 2) : "…"}
				</pre>
			</div>
		</details>
	);
}

"use client";

import { CircleX } from "lucide-react";
import type { PdfResult, ResearchResult, SubagentArtifactData } from "@/src/core";
import type { LhViewMessage, PluginBackgroundResult, SubagentResultMeta } from "@/src/core";
import { isSubagentFailure } from "@/src/core";
import { DemoOutputCard } from "@/components/artifacts/demo-card";
import { PdfBriefCard, ResearchBriefCard } from "@/components/artifacts/job-card";
import { VisualOutputCard } from "@/components/artifacts/visual-card";
import { PluginWorkerCard } from "@/components/artifacts/plugin-worker-card";
import { WorkerResultDetails } from "@/components/artifacts/worker-result-presentation";
import { useI18n } from "@/components/i18n";

/**
 * The sub-agent result delivery card (contracts.ts "THE ASYNC PROTOCOL" §4).
 *
 * When a background job completes, the wake pipeline injects a STEER message
 * into the transcript: a user-role UIMessage whose data part
 * ("data-subagent-artifact") carries the result. It renders as an artifact —
 * NEVER a learner bubble, never wrapped in a message container:
 *
 *   research — a quiet "Research complete" one-liner that expands on demand
 *     (native <details>) to the full persisted brief + sources: the brief is
 *     too long to inline by default and the teacher's wake turn weaves it
 *     into the lesson anyway. Failures keep the failure card (the brief
 *     explains what went wrong).
 *   demo / visual — the artifact itself (sandboxed iframe / sanitized SVG).
 *     The sub-agent's verification notes are model-facing glue and do NOT
 *     render; only a failure note does.
 *   plugin — the separate later task outcome, with an optional registered
 *     tool renderer and a persisted readable fallback (the call keeps its ack).
 */
export function SubagentSteerCard({ message }: { message: LhViewMessage }) {
	const { tr, tError } = useI18n();
	const artifactPart = message.parts.find((p) => p.type === "data-subagent-artifact");
	const data = artifactPart?.data as SubagentArtifactData | undefined;
	// The abort steer (2026-09 dock semantics): its message-type part is
	// data-subagent-aborted (the custom-message scheme — the part, not
	// metadata, is the marker) — a quiet chip, mirroring the complete-badge.
	if (!data) {
		const aborted = message.parts.find((p) => p.type === "data-subagent-aborted") as
			| { data?: { kind?: string; failure?: string } }
			| undefined;
		// Recovery/delivery failures share this marker family, but are not
		// learner aborts and do not invent an outcome for an unreadable task.
		if (typeof aborted?.data?.failure === "string") return (
			<div data-testid="job-delivery-failure" role="alert" className="space-y-1 rounded-xl border bg-card p-4 text-sm">
				<p className="font-medium">{tr("Background job recovery/delivery failed", "后台任务恢复或投递失败")}</p>
				<p className="whitespace-pre-wrap break-words text-muted-foreground">{tError(aborted.data.failure)}</p>
			</div>
		);
		if (aborted?.data) return <AbortedBadge kind={aborted.data.kind ?? "job"} />;
		return (
				<div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
				{tr("A sub-agent finished, but its result could not be displayed.", "子代理已完成，但结果无法显示。")}
			</div>
		);
	}
	switch (data.kind) {
		case "plugin": {
			const meta = (message.metadata as { subagentResult?: SubagentResultMeta } | undefined)?.subagentResult;
			return <PluginWorkerCard result={data.result as PluginBackgroundResult} toolCallId={meta?.toolCallId ?? ""} />;
		}
		case "research":
			return isSubagentFailure("research", data.result as ResearchResult) ? (
				<ResearchBriefCard output={data.result} />
			) : (
				<ResearchCompleteBadge result={data.result as ResearchResult} />
			);
		case "pdf":
			return isSubagentFailure("pdf", data.result as PdfResult) ? (
				<PdfBriefCard output={data.result} />
			) : (
				<PdfCompleteBadge result={data.result as PdfResult} />
			);
		case "demo":
			return <DemoOutputCard output={data.result} messageId={message.id} initialInverted={data.ui?.inverted ?? false} />;
		case "visual":
			return <VisualOutputCard output={data.result} messageId={message.id} initialInverted={data.ui?.inverted ?? false} />;
	}
}

/** The aborted-job chip: mirrors the complete-badge one-liner — the
 * teacher's wake turn acknowledges the abort in the lesson itself,
 * this just marks what happened. */
function AbortedBadge({ kind }: { kind: string }) {
	const { tr } = useI18n();
	const kindLabel =
		kind === "research" ? tr("research", "调研")
			: kind === "pdf" ? "PDF"
				: kind === "demo" ? tr("demo", "交互演示")
					: kind === "visual" ? tr("visual", "图解")
						: kind === "plugin" ? tr("plugin", "插件")
							: kind === "job" ? tr("job", "任务")
								: kind;
	return (
		<div data-testid="job-aborted-badge" className="flex items-center gap-2 text-xs text-muted-foreground">
			<CircleX className="size-3.5" />
			<span className="font-medium uppercase tracking-wide">{kindLabel}</span>
			<span>{tr("aborted by the learner", "已被学习者中止")}</span>
		</div>
	);
}

/** Quiet one-liner, the research-badge idiom ported to PDF: the brief is
 * too long to inline by default and the teacher's wake turn weaves it in;
 * the badge marks delivery, the collapsed details carries the full text
 * + consulted pages. */
function PdfCompleteBadge({ result }: { result: PdfResult }) {
	const { tr } = useI18n();
	// The honest count is READ pages (extract/render — sources v1 split);
	// the ?? is runtime tolerance for pre-split persisted steers.
	const readPages = result.pagesRead ?? result.pagesConsulted;
	return (
		<WorkerResultDetails testId="pdf-complete-badge" heading={<>
				<span className="font-medium uppercase tracking-wide">PDF</span>
				<span>{tr("reading complete", "阅读完成")}</span>
				{readPages.length > 0 && (
					<span>
						{readPages.length === 1
							? tr("· read {n} page", "· 已读 {n} 页", { n: readPages.length })
							: tr("· read {n} pages", "· 已读 {n} 页", { n: readPages.length })}
					</span>
				)}
			</>}>
			<PdfBriefCard output={result} />
		</WorkerResultDetails>
	);
}

/** Quiet one-liner, the dispatch-settled idiom — the lesson lives in the
 * teacher's wake turn; the badge just marks delivery. The persisted brief
 * rides along in a collapsed <details> (the wave-1 "view full research"
 * affordance): full markdown + sources, one click away, no extra fetch —
 * the artifact part in the record is the single source of truth. */
function ResearchCompleteBadge({ result }: { result: ResearchResult }) {
	const { tr } = useI18n();
	return (
		<WorkerResultDetails testId="research-complete-badge" heading={<>
				<span className="font-medium uppercase tracking-wide">{tr("Research", "调研")}</span>
				<span>{tr("complete", "已完成")}</span>
				{result.sources.length > 0 && <span>{tr("· {n} sources", "· {n} 项来源", { n: result.sources.length })}</span>}
			</>}>
			<ResearchBriefCard output={result} />
		</WorkerResultDetails>
	);
}

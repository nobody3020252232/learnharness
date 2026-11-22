"use client";

import type { ReactElement, ReactNode } from "react";
import { HostDialog } from "@/components/host-dialog";
import { useBackdropDismiss } from "@/components/backdrop-dismiss";
import { useI18n } from "@/components/i18n";

/**
 * The ESC-abort guard (owner, 2026-10-02): the global Esc → abort chain
 * opens this confirm popup EVERYWHERE — mid-stream aborts and pending-
 * question dismissals alike. Esc on the popup itself cancels (claimed —
 * it must never chain into another abort), which is also why Chat's
 * abort handler ignores events while this dialog is open: two window
 * listeners fire per Esc and stopPropagation alone cannot order them.
 *
 * MINIMAL, the delete-node dialog's tone: title, one line, Cancel +
 * action. No busy state — both actions are local (a fetch that fires
 * and forgets, an answer submit whose own machinery shows progress).
 *
 * What "abort" means is mode-dependent: from a running turn it kills
 * the turn (partial stays); from a pending question there is no turn to
 * kill — abort IS dismissal (A2, 2026-10-03): the silent route writes
 * the skipped toolResult and wakes NOTHING; the session pauses until
 * the user's next plain message, which carries the dismissal to the
 * model in its context.
 */

/** What Esc is aborting — drives copy and the confirm action. */
export type AbortMode = "turn" | "question" | "problem";

const COPY: Record<AbortMode, { title: [string, string]; line: [string, string]; action: [string, string] }> = {
	turn: {
		title: ["Abort this turn?", "中止当前回复？"],
		line: ["The partial answer stays in the transcript.", "已生成的部分内容将保留在对话记录中。"],
		action: ["Abort", "中止"],
	},
	question: {
		title: ["Dismiss this question?", "跳过此问题？"],
		line: ["Skipped — the teacher moves on without it.", "将跳过此题，教师会继续后续内容。"],
		action: ["Dismiss", "跳过"],
	},
	problem: {
		title: ["Discard this problem?", "放弃此练习题？"],
		line: ["The problem is dropped — no solution is revealed.", "将放弃此题，不会展示参考解答。"],
		action: ["Discard", "放弃"],
	},
};

/** The dialog's pure body — exported for SSR pins (the delete-node
 * pattern). The wrapper owns effects + the portal. */
export function AbortTurnBody({
	mode,
	onClose,
	onConfirm,
	busy = false,
	renderFrame,
}: {
	mode: AbortMode;
	onClose: () => void;
	onConfirm: () => void;
	/** The dismiss doubles as the abort when a turn is still running
	 * (owner, 2026-10-04): the line says so. */
	busy?: boolean;
	renderFrame?: (frame: ReactElement<{ children: ReactNode }>) => ReactNode;
}) {
	const { tr } = useI18n();
	const backdropDismiss = useBackdropDismiss(onClose);
	const raw = COPY[mode];
	const title = tr(raw.title[0], raw.title[1]);
	const line = tr(raw.line[0], raw.line[1]);
	const action = tr(raw.action[0], raw.action[1]);
	const frame = (
			<div
				className="mx-4 w-full max-w-sm rounded-xl border bg-card p-5 shadow-lg"
				onClick={(e) => e.stopPropagation()}
			>
				<h2 className="text-sm font-semibold text-card-foreground" data-testid="abort-turn-title">
					{title}
				</h2>
				<p className="mt-1.5 text-xs text-muted-foreground" data-testid="abort-turn-line">
					{line}
					{busy && mode !== "turn" ? tr(" The working turn stops too.", " 正在进行的回复也会同步停止。") : ""}
				</p>
				<div className="mt-4 flex justify-end gap-2">
					<button
						type="button"
						data-testid="abort-turn-cancel"
						onClick={onClose}
						className="rounded-sm px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
					>
						{tr("Cancel", "取消")}
					</button>
					<button
						type="button"
						data-testid="abort-turn-confirm"
						onClick={onConfirm}
						// Destructive red — the app's established destructive pair.
						className="rounded-sm border border-destructive/50 bg-destructive/10 px-3 py-1.5 text-xs text-destructive transition-colors hover:bg-destructive/20"
					>
						{action}
					</button>
				</div>
			</div>
	);
	if (renderFrame) return renderFrame(frame);
	return <div role="dialog" aria-modal="true" aria-label={title} data-testid="abort-turn-dialog"
		className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
		{...backdropDismiss}>{frame}</div>;
}

export function AbortTurnDialog({
	mode,
	onClose,
	onConfirm,
	busy = false,
}: {
	/** What Esc is aborting; null = closed (nothing rendered). */
	mode: AbortMode | null;
	onClose: () => void;
	onConfirm: (mode: AbortMode) => void;
	busy?: boolean;
}) {
	const { tr } = useI18n();
	if (mode === null) return null;
	const dialogTitle = tr(COPY[mode].title[0], COPY[mode].title[1]);
	return <AbortTurnBody mode={mode} onClose={onClose} onConfirm={() => onConfirm(mode)} busy={busy}
		renderFrame={(frame) => <HostDialog open frame={frame} aria-label={dialogTitle}
			onClose={() => { onClose(); return "closed"; }}
			backdropProps={{ className: "fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm", "data-testid": "abort-turn-dialog" }}>
			{frame.props.children}
		</HostDialog>} />;
}

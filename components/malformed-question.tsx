"use client";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/i18n";

/** Recovery belongs to the transcript, never the answer dock. The caller
 * only offers it for the current saved malformed batch, not failed/aborted
 * generations or historical attempts. */
export function MalformedQuestion({ onRetry, disabled, reason }: {
	onRetry?: () => void;
	disabled?: boolean;
	reason?: string;
}) {
	const { tr, tError } = useI18n();
	const displayReason = reason ? tError(reason) : undefined;
	return (
		<div data-testid="malformed-question" className="my-2 rounded-xl border border-dashed bg-card/60 p-3 text-sm text-muted-foreground">
			<p>{tr("This question could not be displayed.", "此题目无法显示。")}{onRetry ? tr(" Retry it or send a message to continue.", " 请重试，或发送消息以继续。") : ""}</p>
			{onRetry && <Button type="button" variant="outline" size="xs" className="mt-2" disabled={disabled}
				title={displayReason ?? tr("Requests a replacement from the model.", "向模型请求重新生成一道题目。")} data-testid="retry-malformed-question" onClick={onRetry}>
				{tr("Retry question", "重试题目")}
			</Button>}
			{displayReason && <p className="mt-1 text-xs">{displayReason}</p>}
		</div>
	);
}

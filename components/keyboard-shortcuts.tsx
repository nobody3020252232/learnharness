"use client";

/**
 * Keyboard shortcuts — window-bubble fallback and registry dispatch.
 * Shared interaction layers own early event snapshots and dismissal:
 *
 * - Tab is DEAD: browser tab-focus navigation is abandoned by owner decision
 *   (2026-09-17). Provider capture prevents native defaults without stopping
 *   leaf handlers. Explicit field/row and thinking cycles remain scoped.
 * - Escape reaches dictation cancellation / turn abort only if no original
 *   layer or leaf editor owned it. Closing a layer never exposes this
 *   fallback to the same physical key.
 * - Global actions dispatch lh:kbd-<action> window events; surfaces that are
 *   mounted listen (the lh:chat-renamed pattern). A surface that isn't
 *   mounted simply doesn't listen — an F2 on the graph view is a no-op, not
 *   an error. Actions live in src/core/keyboard.ts (registry + persisted
 *   overrides), the ONE table the settings milestone will render as its
 *   editor.
 *
 * Listeners attach at the WINDOW level (bubble's last stop) so every
 * component-level handler — popovers' own Esc, the composer's Esc — gets the
 * event first and can claim it with stopPropagation.
 */

import { useEffect, useId, useRef, useState } from "react";
import { HostDialog } from "@/components/host-dialog";
import { useOptionalInteractionLayers } from "@/components/interaction-layers";
import { useRouter } from "next/navigation";
import {
	actionForBinding,
	bindingForAction,
	eventBinding,
	formatBinding,
	isTypingSurface,
	kbdEventForAction,
	KEYBOARD_ACTIONS,
} from "@/src/core";
import { pluginQuestionKeySuppressed, composingQuestionKey } from "./plugin-question-keys";
import { isDictationActive } from "@/components/dictation";
import { dispatchFocusedPluginShortcut, hasLegacyInteractionForeground, isInteractionScopeEligible } from "@/components/plugin-input-focus";
import { useSettingsDialog } from "@/components/settings/settings-dialog.tsx";
import { usePlugins } from "./plugins";
import { dispatchPluginActionShortcut, pluginShortcutScopeLabel, usePluginShortcutRows } from "./plugin-shortcuts";
import { useI18n } from "@/components/i18n";
import type { KeyAction } from "@/src/core";

// Re-exported for the contract pin (tests/keyboard-toggle-sidebar.test.ts):
// the dispatcher composes event names through the ONE helper — a second
// spelling here is how the ⌘B bug happened.
export { kbdEventForAction };

export function KeyboardShortcuts() {
	const router = useRouter();
	const [cheatOpen, setCheatOpen] = useState(false);
	const { open: openSettings } = useSettingsDialog();
	const controller = useOptionalInteractionLayers();
	const { manager } = usePlugins();

	// Router + cheat + settings state inside a ref so the keydown listener
	// (attached once) never goes stale.
	const handlersRef = useRef<{
		router: ReturnType<typeof useRouter>;
		setCheatOpen: (v: boolean) => void;
		openSettings: () => void;
	}>({ router, setCheatOpen, openSettings });
	handlersRef.current = { router, setCheatOpen, openSettings };

	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			if (pluginQuestionKeySuppressed(e) || composingQuestionKey(e)) return;
			// Provider capture already suppressed native Tab without stopping
			// target propagation. Keep the legacy unprovided fixture fallback.
			if (e.key === "Tab") {
				if (!controller) e.preventDefault();
				if (e.shiftKey) {
					if (!dispatchFocusedPluginShortcut("cycle-thinking", controller))
						window.dispatchEvent(new CustomEvent("lh:kbd-cycle-thinking"));
				}
				// Plain Tab cycles the active surface's text fields (owner,
				// keyboard round 2026-10-06) — forward-only, wrapping; each
				// composer-bearing page answers with its own chain. The quiz
				// dock's rows↔thinking claim stops propagation at document
				// level, so a claimed Tab never reaches this dispatch.
				else if (!e.metaKey && !e.ctrlKey && !e.altKey)
					window.dispatchEvent(new CustomEvent("lh:kbd-cycle-fields"));
				return;
			}

			if (e.key === "Escape") {
				// The provider snapshots before leaf handlers. A closed/blocked
				// original owner never exposes this fallback to the same event.
				if (e.defaultPrevented || (controller ? controller.isEscapeOwned(e) : hasLegacyInteractionForeground(document))) return;
				// THE ONE-ESC LAW (owner, keyboard round 2026-10-06): one
				// Esc, one action, on the topmost active layer. Field-level
				// handlers claim at their element (focus in a field: the
				// field's action); every SURFACED layer (popovers, plan,
				// overlays, dialogs) claims at the DOCUMENT level, which
				// fires before this window listener — so reaching here means
				// NOTHING is surfaced and no field is focused. This chain is
				// the fallback, bottom-up: dictation (a live capture, not a
				// surface — it survives Esc that closes a plan or overlay),
				// then abort the turn (a server-side turn has no client
				// request to abort — the abort seam in Chat decides what's
				// honestly stoppable, layered by escAbortTarget).
				if (isDictationActive()) {
					e.preventDefault();
					window.dispatchEvent(new CustomEvent("lh:kbd-cancel-dictation"));
					return;
				}
				window.dispatchEvent(new CustomEvent("lh:kbd-abort-turn"));
				return;
			}

			// ── Registry dispatch. Leaf editors/rebinding keep their claims.
			if (e.defaultPrevented) return;
			const action = actionForBinding(eventBinding(e));
			if (!action) { dispatchPluginActionShortcut(e, manager, controller); return; }

			// The input guard: inside a typing surface only mod/alt combos
			// fire (they never type a character). Bare keys — "?" included —
			// pass through so the field keeps them. Tab already returned above.
			if (isTypingSurface(e) && !(e.metaKey || e.ctrlKey || e.altKey)) return;

			// Dispatch: global commands we own run here; surface commands
			// ride the window event for the mounted surface to catch.
			switch (action) {
				case "new-session":
					handlersRef.current.router.push("/chat/new");
					break;
				case "open-settings":
					// Settings-app wave: the dialog is the surface, the URL is
					// gone — /settings redirects to the draft shell.
					handlersRef.current.openSettings();
					break;
				case "jump-graph":
					handlersRef.current.router.push("/");
					break;
				case "cheat-sheet":
					handlersRef.current.setCheatOpen(true);
					break;
				case "toggle-question-thread":
					// The chat view owns it (only while a question waits); claim the
					// chord so a browser tab's own ⌘J (Downloads) never fires too.
					e.preventDefault();
					window.dispatchEvent(new CustomEvent(kbdEventForAction(action)));
					break;
				case "find":
					// The mounted surface owns Find (session text / graph nodes).
					// Claim Mod+F so Chromium's whole-window finder cannot open too.
					e.preventDefault();
					window.dispatchEvent(new CustomEvent(kbdEventForAction(action)));
					break;
				default:
					if (dispatchFocusedPluginShortcut(action, controller)) break;
					// Core dictation is a background-page service, not a modal
					// command. A foreground plugin gets its focused claim above.
					if (action === "toggle-dictation" && !isInteractionScopeEligible(document.body, controller)) break;
					window.dispatchEvent(new CustomEvent(kbdEventForAction(action)));
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [controller, manager]);

	return <CheatSheet open={cheatOpen} onClose={() => setCheatOpen(false)} />;
}

const KEYBOARD_ACTION_ZH: Record<KeyAction, string> = {
	"toggle-dictation": "切换语音听写",
	"open-settings": "打开设置",
	"open-model-picker": "模型选择器",
	"cycle-thinking": "切换推理强度",
	"toggle-sidebar": "切换会话侧边栏",
	"sessions-search": "搜索会话",
	"jump-graph": "前往知识图谱",
	"new-session": "新建会话",
	"rename-session": "重命名会话",
	"toggle-user-thinking": "展开/收起我的思考",
	"toggle-question-thread": "题目 · 旁白求助（支线讨论）",
	find: "查找",
	"cheat-sheet": "快捷键速查表",
	"question-focus": "题目 · 切换思考与选项焦点",
	"question-next-row": "题目 · 下一行",
	"question-prev-row": "题目 · 上一行",
	"question-pick-row": "题目 · 选中当前行",
	"question-submit": "题目 · 提交",
};

/** The ? overlay — the registry rendered as a table (grouped by scope).
 *  Until the settings milestone ships an editor, this is how shortcuts
 *  stay discoverable. */
function CheatSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
	const { tr, isZh, tPluginName } = useI18n();
	const headingId = useId();
	const { rows: pluginRows } = usePluginShortcutRows();
	const scopes = ["global", "chat", "graph"] as const;
	const scopeLabels: Record<(typeof scopes)[number], string> = {
		global: tr("Global", "全局"),
		chat: tr("Chat", "会话"),
		graph: tr("Graph view", "知识图谱"),
	};
	const formatPluginScope = (row: (typeof pluginRows)[number]) => {
		if (!isZh) return pluginShortcutScopeLabel(row);
		const scope = row.shortcut.scope;
		if (scope === "app") return "全局";
		return [
			...(scope.sessions ?? []).map((kind) => (kind === "teaching" ? "教学" : "练习")),
			...(scope.views?.length ? [`视图：${scope.views.join(", ")}`] : []),
		].join(" · ");
	};
	return (
		<HostDialog open={open} onClose={() => { onClose(); return "closed"; }} aria-labelledby={headingId}
			backdropProps={{
				"data-testid": "cheat-sheet",
				className: "fixed inset-0 z-50 flex items-center justify-center bg-black/50",
			}}
			frame={<div
				className="max-h-[80vh] w-full max-w-[36rem] overflow-y-auto rounded-xl border bg-card p-5 shadow-2xl"
				onClick={(e) => e.stopPropagation()}
			/>}
		>
				<div className="mb-4 flex items-baseline justify-between">
					<span id={headingId} role="heading" aria-level={2} className="text-sm font-medium text-card-foreground">{tr("Keyboard shortcuts", "快捷键")}</span>
					<span className="text-xs text-muted-foreground">{tr("Esc to close", "按 Esc 关闭")}</span>
				</div>
				{scopes.map((scope) => {
					const actions = KEYBOARD_ACTIONS.filter((a) => a.scope === scope);
					if (actions.length === 0) return null;
					return (
						<div key={scope} className="mb-4">
							<div className="mb-1.5 text-xs uppercase tracking-widest text-muted-foreground/70">
								{scopeLabels[scope]}
							</div>
							<div className="flex flex-col gap-1">
								{actions.map((a) => (
									<div key={a.id} className="flex items-center justify-between gap-4 text-sm">
										<span className="text-muted-foreground">{isZh ? (KEYBOARD_ACTION_ZH[a.id] ?? a.label) : a.label}</span>
										<kbd className="rounded-md border border-border bg-background px-1.5 py-0.5 font-mono text-xs text-card-foreground">
											{formatBinding(bindingForAction(a.id))}
										</kbd>
									</div>
								))}
							</div>
						</div>
					);
				})}
				{[...new Set(pluginRows.map(row => row.pluginId))].map(pluginId => <div key={pluginId} className="mb-4" data-testid={`kbd-cheat-plugin-${pluginId}`}>
					<div className="mb-1.5 text-xs uppercase tracking-widest text-muted-foreground/70">{tPluginName(pluginId, pluginRows.find(row => row.pluginId === pluginId)!.pluginName)}</div>
					{pluginRows.filter(row => row.pluginId === pluginId).map(row => <div key={row.id} className="mb-1 text-sm">
						<div className="flex items-center justify-between gap-4"><span className="text-muted-foreground">{row.name}</span><kbd className="rounded-md border border-border bg-background px-1.5 py-0.5 font-mono text-xs text-card-foreground">{row.binding ? formatBinding(row.binding) : tr("Unbound", "未绑定")}</kbd></div>
						<div className="text-xs text-muted-foreground/70">{formatPluginScope(row)}{row.reason ? tr(" · Inactive: {reason}", " · 未生效：{reason}", { reason: row.reason }) : ""}</div>
					</div>)}
				</div>)}
		</HostDialog>
	);
}

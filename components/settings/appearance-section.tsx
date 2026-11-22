"use client";
/**
 * The Appearance + Graph sections (thin settings wave).
 *
 * Appearance controls resolve against the factory in the provider; writes
 * PUT the whole appearance section and hand the delta back so the CSS
 * variables move IMMEDIATELY (the section's whole point — it must DO
 * something). Theme wave (2026-11-04): the theme grid (./theme-cards.tsx)
 * sits on top and sets every color; the "Colors" block below holds one
 * hex override per theme color (empty = the theme's), kept across theme
 * switches; "Typography" holds the type knobs. Hex inputs commit on
 * blur/Enter.
 *
 * Graph graying (owner, 2026-09-20) follows the graph viewer's render-panel
 * convention: the whole row dims when a parent is off (stored values
 * persist but resolve inert — the switch shows stored, the dim effective).
 *
 * Reading font (appearance wave, 2026-09-26, owner ruling): a searchable
 * dropdown of the user's INSTALLED fonts (FontMenuList over model-menu's
 * machine) fed by window.queryLocalFonts() in the desktop shell — the
 * enumeration is click-bound (the API requires user activation), deduped
 * to unique families, the factory family excluded (the DEFAULT row is
 * it). In a plain dev browser the API is absent → a small curated list
 * + a footer that says exactly that — never a fabricated system list.
 * The custom-family input inside the menu is the manual escape path.
 * Empty/unset keeps meaning Source Sans 3.
 *
 * Overrides live in two homes by design: `background` and
 * `mdRendering.boldColor/italicColor` keep their pre-theme keys (existing
 * records keep their colors); the other nine sit in `colors`. core/
 * themes.ts effectiveColors is the one place they merge.
 */

import { useEffect, useRef, useState } from "react";
import {
	EXTRACTION_CHUNK_TOKENS_FLOOR,
	TRANSCRIPT_WIDTH_MAX_REM,
	TRANSCRIPT_WIDTH_MIN_REM,
	TRANSCRIPT_WIDTH_STEP_REM,
	UI_LOCALE_OPTIONS,
	resolveSettings,
	THEME_COLOR_KEYS,
	type AppearanceSettings,
	type GraphSettings,
	type ThemeColorKey,
	type UiLocale,
} from "@/src/core";
import { useI18n } from "@/components/i18n";
import { MenuShell } from "@/components/menu-shell";
import { useInteractionLayers } from "@/components/interaction-layers";
import { Hint } from "@/components/ui/hint";
import { BUNDLED_READING_FONTS, useAppearance } from "./appearance.tsx";
import { FontMenuList } from "./model-menu";
import { ThemeCards } from "./theme-cards.tsx";
import { CommitInput, SettingsMenuTrigger, SettingsRow, SettingsSegmentedControl, Toggle } from "./controls.tsx";

/** Shared language switcher row used in both Appearance and General settings. */
export function InterfaceLanguageRow({
	value,
	onChange,
}: {
	value: UiLocale;
	onChange: (next: UiLocale) => void;
}) {
	const { tr } = useI18n();
	return (
		<SettingsRow
			label={tr("Interface language", "界面语言")}
			hint={tr("Switch display language between Simplified Chinese and English", "在简体中文与英文之间切换界面显示语言")}
			testid="row-interface-language"
		>
			<SettingsSegmentedControl
				label={tr("Interface language", "界面语言")}
				testidPrefix="locale"
				options={UI_LOCALE_OPTIONS.map((opt) => ({ value: opt.id, label: opt.nativeLabel }))}
				value={value}
				onChange={onChange}
			/>
		</SettingsRow>
	);
}

/** The slider position past the last width step: Full (no cap). */
const TRANSCRIPT_FULL_POSITION = TRANSCRIPT_WIDTH_MAX_REM + TRANSCRIPT_WIDTH_STEP_REM;

/** The transcript width's label: px at the root's 16px rem, or Full.
 *  Exported for tests. */
export function transcriptWidthLabel(rem: number | null, locale: UiLocale = "en"): string {
	return rem === null ? (locale === "zh-CN" ? "全宽" : "Full") : `${rem * 16}px`;
}

/**
 * Transcript width: a slider whose last position is Full. The thumb moves
 * a local draft while dragging; the section PUT happens once, on the
 * native `change` (release / keyboard step) — not one write per tick.
 */
function TranscriptWidthSlider({ value, onCommit }: { value: number | null; onCommit: (rem: number | null) => void }) {
	const { tr, locale } = useI18n();
	const position = value ?? TRANSCRIPT_FULL_POSITION;
	const [draft, setDraft] = useState(position);
	const inputRef = useRef<HTMLInputElement>(null);
	const commitRef = useRef(onCommit);
	commitRef.current = onCommit;
	useEffect(() => setDraft(position), [position]);
	useEffect(() => {
		const input = inputRef.current;
		if (!input) return;
		const onChange = () => {
			const next = Number(input.value);
			commitRef.current(next >= TRANSCRIPT_FULL_POSITION ? null : next);
		};
		input.addEventListener("change", onChange);
		return () => input.removeEventListener("change", onChange);
	}, []);
	const draftRem = draft >= TRANSCRIPT_FULL_POSITION ? null : draft;
	return (
		<span className="flex items-center gap-2">
			<input
				ref={inputRef}
				type="range"
				aria-label={tr("Transcript width", "对话区最大宽度")}
				aria-valuetext={transcriptWidthLabel(draftRem, locale)}
				data-testid="input-transcript-width"
				min={TRANSCRIPT_WIDTH_MIN_REM}
				max={TRANSCRIPT_FULL_POSITION}
				step={TRANSCRIPT_WIDTH_STEP_REM}
				value={draft}
				onChange={(e) => setDraft(Number(e.target.value))}
				className="h-1.5 w-40 accent-primary"
			/>
			<span data-testid="transcript-width-value" className="w-12 text-right text-[11px] tabular-nums text-muted-foreground">{transcriptWidthLabel(draftRem, locale)}</span>
		</span>
	);
}

/** The factory reading family — the DEFAULT row's identity (unset =
 *  this). Exported for tests. */
export const DEFAULT_READING_FONT = "Source Sans 3";

/** The dev-browser fallback list (queryLocalFonts is absent there):
 *  the app's own knowns plus a handful of ubiquitous macOS families,
 *  honestly LABELED as common — never presented as the system's real
 *  list. The factory family is absent: the DEFAULT row is it. Exported
 *  for tests. */
export const CURATED_FALLBACK_FONTS: readonly string[] = [
	"Arial",
	"CMU Serif",
	"Courier New",
	"Georgia",
	"Helvetica",
	"Helvetica Neue",
	"JetBrains Mono",
	"Menlo",
	"Times New Roman",
	"Trebuchet MS",
	"Verdana",
];

/** window.queryLocalFonts' shape as this section consumes it (family is
 *  the only field used; the API returns one FontData per FACE — the
 *  caller dedupes). */
type LocalFontsApi = () => Promise<Array<{ family: string }>>;

/** The Local Font Access seam — read lazily (SSR has no window, and
 *  render-time access would evaluate the API on the server). */
function localFontsApi(): LocalFontsApi | null {
	if (typeof window === "undefined") return null;
	return (window as unknown as { queryLocalFonts?: LocalFontsApi }).queryLocalFonts ?? null;
}

/** Compose the reading-font pick: null (or blank) = the factory
 *  Source Sans 3; otherwise the family verbatim (trimmed — the
 *  sanitizer trims again server-side). Pure — exported for tests. */
export function composeFontFamily(
	appearance: AppearanceSettings | undefined,
	family: string | null,
): AppearanceSettings {
	const value = family?.trim() ?? "";
	return { ...appearance, fontFamily: value === "" ? null : value };
}

/** The Colors grid's labels and the one hint that explains a key. */
const COLOR_LABELS: Record<ThemeColorKey, { label: string; labelZh: string; note?: string; noteZh?: string }> = {
	background: { label: "Background", labelZh: "背景" },
	accent: { label: "Accent", labelZh: "强调色", note: "Focus rings, toggles, selection", noteZh: "焦点外框、开关、选中态" },
	surface: { label: "Surface", labelZh: "表面背景", note: "Cards, inputs, sidebar", noteZh: "卡片、输入框、侧边栏" },
	bold: { label: "Bold", labelZh: "加粗文字" },
	border: { label: "Border", labelZh: "边框" },
	italic: { label: "Italic", labelZh: "斜体文字" },
	text: { label: "Text", labelZh: "正文文字" },
	code: { label: "Inline code", labelZh: "行内代码" },
	textMuted: { label: "Muted text", labelZh: "次要文字" },
	error: { label: "Error", labelZh: "错误" },
	success: { label: "Success", labelZh: "成功" },
	warning: { label: "Warning", labelZh: "警告" },
};

/** The legacy test ids of the three pre-theme rows (kept stable). */
const LEGACY_TESTIDS: Partial<Record<ThemeColorKey, string>> = {
	background: "input-background",
	bold: "input-bold-color",
	italic: "input-italic-color",
};

/** The stored override for one theme color ("" = none). Pure — exported
 *  for tests. */
export function colorOverride(appearance: AppearanceSettings | undefined, key: ThemeColorKey): string {
	if (key === "background") return appearance?.background ?? "";
	if (key === "bold") return appearance?.mdRendering?.boldColor ?? "";
	if (key === "italic") return appearance?.mdRendering?.italicColor ?? "";
	return appearance?.colors?.[key] ?? "";
}

/** Compose one override into the section ("" = back to the theme's).
 *  Every other field rides along untouched. Pure — exported for tests. */
export function composeColorOverride(
	appearance: AppearanceSettings | undefined,
	key: ThemeColorKey,
	value: string,
): AppearanceSettings {
	const v = value === "" ? null : value;
	if (key === "background") return { ...appearance, background: v };
	if (key === "bold") return { ...appearance, mdRendering: { ...appearance?.mdRendering, boldColor: v } };
	if (key === "italic") return { ...appearance, mdRendering: { ...appearance?.mdRendering, italicColor: v } };
	const colors = { ...appearance?.colors };
	if (v === null) delete colors[key];
	else colors[key] = v;
	return { ...appearance, colors };
}

/** "Reset all": every color back to the theme's; type knobs untouched. */
export function clearColorOverrides(appearance: AppearanceSettings | undefined): AppearanceSettings {
	const { background: _bg, colors: _colors, ...rest } = appearance ?? {};
	const md = appearance?.mdRendering;
	if (!md) return rest;
	const { boldColor: _b, italicColor: _i, ...mdRest } = md;
	return { ...rest, mdRendering: mdRest };
}

function ColorOverrideRow({
	colorKey,
	value,
	themeColor,
	effective,
	onCommit,
}: {
	colorKey: ThemeColorKey;
	value: string;
	themeColor: string;
	effective: string;
	onCommit: (next: string) => boolean | Promise<boolean>;
}) {
	const { tr, isZh } = useI18n();
	const { label, labelZh, note, noteZh } = COLOR_LABELS[colorKey];
	const displayLabel = tr(label, labelZh);
	const empty = tr("Empty = {color}", "留空 = {color}", { color: themeColor });
	const displayNote = note && noteZh ? tr(note, noteZh) : note;
	return (
		<SettingsRow label={displayLabel} hint={displayNote ? `${displayNote} · ${empty}` : empty} testid={`row-color-${colorKey}`}>
			<span className="flex items-center gap-2">
				<span
					aria-hidden
					data-testid={`swatch-${colorKey}`}
					className="size-4 shrink-0 rounded-sm border border-border"
					style={{ background: effective }}
				/>
				<CommitInput
					value={value}
					placeholder={themeColor}
					ariaLabel={tr("{label} hex", "{label} 十六进制色值", { label: isZh ? labelZh : label.toLowerCase() })}
					testid={LEGACY_TESTIDS[colorKey] ?? `input-color-${colorKey}`}
					onCommit={onCommit}
				/>
			</span>
		</SettingsRow>
	);
}

export function AppearanceSection({
	appearance,
	onSectionChange,
}: {
	/** The record's appearance delta (absent = factory). */
	appearance: AppearanceSettings | undefined;
	/** PUT the whole appearance section; the page re-applies on success. */
	onSectionChange: (next: AppearanceSettings) => boolean | Promise<boolean>;
}) {
	const { tr } = useI18n();
	const { appearance: resolved, activeTheme, colors, themes, refreshThemes } = useAppearance();
	const md = appearance?.mdRendering;

	// The font dropdown's open state + its enumeration cache. undefined =
	// not enumerated yet (desktop: click-bound queryLocalFonts pending);
	// null = enumeration UNAVAILABLE (the API is absent in a plain
	// browser, rejected, or resolved EMPTY — Electron 44's local-fonts
	// grant passes and the enumeration still yields zero fonts,
	// reproduced 2026-09-26) → the curated fallback; a list = the deduped
	// families. enumEmpty distinguishes WHY it fell back, for the footer.
	const [fontMenuOpen, setFontMenuOpen] = useState(false);
	const [localFonts, setLocalFonts] = useState<string[] | null | undefined>(undefined);
	const [enumEmpty, setEnumEmpty] = useState(false);
	const menuAnchorRef = useRef<HTMLSpanElement>(null);
	const interactions = useInteractionLayers();

	// The enumeration runs INSIDE the trigger click — queryLocalFonts
	// requires user activation, so it cannot be a mount effect. First
	// open only: the families are cached for the section's life (font
	// installs mid-dialog are not a case); ANY unavailable enumeration
	// (absent / rejected / empty) falls back to the curated list rather
	// than an empty picker.
	const openFontMenu = () => {
		setFontMenuOpen((open) => {
			if (!open && localFonts === undefined) {
				const api = localFontsApi();
				if (api === null) {
					setLocalFonts(null);
					setEnumEmpty(false);
				} else {
					void api()
						.then((fonts) => {
							const installed = fonts.map((f) => f.family);
							// The bundled families join the installed ones (they
							// render whether or not the OS has them), but only
							// when the OS list was actually read.
							const families = [...new Set(installed.length ? [...installed, ...Object.keys(BUNDLED_READING_FONTS)] : [])]
								.filter((f) => f !== DEFAULT_READING_FONT)
								.sort((a, b) => a.localeCompare(b));
							if (families.length === 0) {
								// Resolved-but-empty: not a failure the catch sees —
								// an honest unavailable (this Electron 44 build
								// enumerates nothing even granted).
								setLocalFonts(null);
								setEnumEmpty(true);
							} else {
								setLocalFonts(families);
							}
						})
						.catch(() => {
							setLocalFonts(null);
							setEnumEmpty(false);
						});
				}
			}
			return !open;
		});
	};

	const pickFont = (family: string | null) => {
		setFontMenuOpen(false);
		onSectionChange(composeFontFamily(appearance, family));
	};

	// The dropdown contract (agent-section's, mirrored): any click
	// outside the open menu — or an Esc — closes it. Esc is CLAIMED with
	// stopPropagation so the settings dialog behind does NOT also close.
	useEffect(() => {
		if (!fontMenuOpen) return;
		const onPointerDown = (e: PointerEvent) => {
			if (!interactions.isElementEligible(document.querySelector<HTMLElement>('[data-testid="font-menu"]'))) return;
			const target = e.target as Node;
			if (menuAnchorRef.current?.contains(target)) return;
			if (target instanceof Element && target.closest("[data-lh-menu]")) return;
			if (target instanceof Element && target.closest('[role="dialog"]')) {
				setFontMenuOpen(false);
			}
			// else: outside the dialog — the dialog's own close handles it.
		};
		document.addEventListener("pointerdown", onPointerDown);
		return () => document.removeEventListener("pointerdown", onPointerDown);
	}, [fontMenuOpen, interactions]);

	return (
		<>
			<InterfaceLanguageRow
				value={appearance?.locale ?? resolved.locale}
				onChange={(nextLocale) => void onSectionChange({ ...appearance, locale: nextLocale })}
			/>
			<ThemeCards
				themes={themes}
				active={activeTheme}
				appearance={appearance}
				onSelect={(id) => onSectionChange({ ...appearance, theme: id })}
				onImported={() => void refreshThemes()}
				onRemoved={(removed) => {
					void refreshThemes();
					// The server already fell back to Default; the write keeps the
					// dialog's record mirror and the live vars in step with it.
					if (removed.id === activeTheme.id) onSectionChange({ ...appearance, theme: "default" });
				}}
			/>
			<div data-testid="group-colors" className="mt-5 flex flex-col gap-2">
				<div className="flex items-end justify-between gap-4">
					<p className="text-xs uppercase tracking-widest text-muted-foreground">
						{tr("Colors", "颜色")}{" "}
						<span className="normal-case tracking-normal text-muted-foreground/70">
							{tr("· overrides on top of the theme, kept when you switch", "· 覆盖当前主题配色，切换主题时保留")}
						</span>
					</p>
					<button
						type="button"
						data-testid="colors-reset"
						onClick={() => onSectionChange(clearColorOverrides(appearance))}
						className="h-6 shrink-0 rounded-sm px-2 font-ui text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
					>
						{tr("Reset all", "全部重置")}
					</button>
				</div>
				<div className="grid grid-cols-2 gap-x-10 gap-y-2">
					{THEME_COLOR_KEYS.map((key) => (
						<ColorOverrideRow
							key={key}
							colorKey={key}
							value={colorOverride(appearance, key)}
							themeColor={activeTheme.colors[key]}
							effective={colors[key]}
							onCommit={(v) => onSectionChange(composeColorOverride(appearance, key, v))}
						/>
					))}
				</div>
			</div>
			<p className="mt-5 mb-2 text-xs uppercase tracking-widest text-muted-foreground">{tr("Typography", "排版")}</p>
			<SettingsRow
				label={tr("Reading font", "阅读字体")}
				hint={tr("Empty = {font}", "留空 = {font}", { font: DEFAULT_READING_FONT })}
				testid="row-font"
			>
				<span ref={fontMenuOpen ? menuAnchorRef : undefined} className="relative flex items-center gap-2">
					{/* The shared Agent/Appearance collapsed-menu trigger.
					    The tooltip rides the CLOSED button ONLY
					    (owner ruling 2026-09-26: never while
					    the dropdown is out — it popped over the open
					    menu when the wrap covered the whole anchor
					    span). */}
					{(() => {
						const triggerButton = (
							<SettingsMenuTrigger
								value={appearance?.fontFamily || DEFAULT_READING_FONT}
								aria-label={tr("Reading font", "阅读字体")}
								aria-expanded={fontMenuOpen}
								data-testid="font-trigger"
								onClick={openFontMenu}
								className="min-w-20"
							/>
						);
						return fontMenuOpen ? (
							triggerButton
						) : (
							<Hint label={tr("Choose from your installed fonts", "从本机已安装的字体中选择")} side="left">
								{triggerButton}
							</Hint>
						);
					})()}
					{fontMenuOpen && (
						<MenuShell
							preferredSide="down"
							anchorTestid="font-trigger"
							testid="font-menu"
							onClose={() => { setFontMenuOpen(false); return "closed"; }}
							menuClass="flex w-[18rem] flex-col gap-0.5 rounded-xl border border-border bg-card p-2 text-xs shadow-xl"
						>
							<FontMenuList
								families={localFonts === undefined ? undefined : (localFonts ?? [...CURATED_FALLBACK_FONTS])}
								effectiveFamily={appearance?.fontFamily ?? null}
								onPick={pickFont}
								footer={
									localFonts === undefined
										? undefined
										: localFonts === null
											? enumEmpty
												? tr("Common families — installed fonts could not be read", "常用字体 — 无法读取系统已安装字体")
												: tr("Common families — your installed list needs the desktop app", "常用字体 — 读取本机已安装字体需要桌面应用")
											: tr("Your installed fonts", "本机已安装的字体")
								}
							/>
						</MenuShell>
					)}
				</span>
			</SettingsRow>
			<SettingsRow label={tr("Reading font size", "阅读字号")} hint={`${resolved.proseFontSize}px`} testid="row-prose-size">
				<CommitInput
					type="number"
					value={String(appearance?.proseFontSize ?? "")}
					placeholder="16"
					ariaLabel={tr("prose font size", "正文字号")}
					testid="input-prose-size"
					onCommit={(v) => {
						// Empty = factory default (owner, fix wave): omit the key so the record
						// UNSETS and the field stays empty (absence, not null, is the
						// unset for numbers). Number("") is 0, so the old clamp wrote 12.
						if (v === "") {
							return onSectionChange({ ...appearance, proseFontSize: undefined });
						}
						const n = Number(v);
						if (!Number.isFinite(n)) return false; // bad input: no write, factory stays
						return onSectionChange({ ...appearance, proseFontSize: Math.min(24, Math.max(12, Math.round(n))) });
					}}
				/>
			</SettingsRow>
			<SettingsRow label={tr("Code ligatures", "代码连字")} testid="row-code-ligatures">
				<Toggle
					checked={resolved.codeLigatures}
					label={tr("Code ligatures", "代码连字")}
					testid="toggle-code-ligatures"
					onChange={(on) => onSectionChange({ ...appearance, codeLigatures: on })}
				/>
			</SettingsRow>
			<SettingsRow label={tr("Session names in serif", "会话标题使用衬线体")} testid="row-session-serif">
				<Toggle
					checked={appearance?.sessionNameSerif ?? true}
					label={tr("session names serif", "会话标题衬线体")}
					testid="toggle-session-names-serif"
					onChange={(on) => onSectionChange({ ...appearance, sessionNameSerif: on })}
				/>
			</SettingsRow>
			<SettingsRow label={tr("Compact session list", "紧凑会话列表")} testid="row-compact-session-list">
				<Toggle
					checked={resolved.compactSessionList}
					label={tr("Compact session list", "紧凑会话列表")}
					testid="toggle-compact-session-list"
					onChange={(on) => onSectionChange({ ...appearance, compactSessionList: on })}
				/>
			</SettingsRow>
			<SettingsRow label={tr("Heading weight", "标题字重")} hint={`${resolved.mdRendering.headingWeight}`} testid="row-heading-weight">
				<CommitInput
					type="number"
					value={String(md?.headingWeight ?? "")}
					placeholder="900"
					ariaLabel={tr("heading weight", "标题字重")}
					testid="input-heading-weight"
					onCommit={(v) => {
						// Empty = factory default (owner, fix wave): Number("") is 0, so
						// Absence is the unset representation — the old clamp wrote 100.
						if (v === "") {
							return onSectionChange({ ...appearance, mdRendering: { ...md, headingWeight: undefined } });
						}
						const n = Number(v);
						if (!Number.isFinite(n)) return false;
						return onSectionChange({
							...appearance,
							mdRendering: { ...md, headingWeight: Math.min(900, Math.max(100, Math.round(n))) },
						});
					}}
				/>
			</SettingsRow>
			<SettingsRow label={tr("Transcript width", "对话区最大宽度")} testid="row-transcript-width">
				<TranscriptWidthSlider
					value={resolved.transcriptMaxWidth}
					// Full = absence (the unset representation for numbers).
					onCommit={(rem) => { void onSectionChange({ ...appearance, transcriptMaxWidth: rem ?? undefined }); }}
				/>
			</SettingsRow>
			<SettingsRow label={tr("Adapt question layout", "自适应题目排版")} testid="row-adaptive-questions">
				<Toggle
					checked={resolved.adaptiveQuestions}
					label={tr("Adapt question layout", "自适应题目排版")}
					testid="toggle-adapt-question-layout"
					onChange={(on) => onSectionChange({ ...appearance, adaptiveQuestions: on })}
				/>
			</SettingsRow>
		</>
	);
}

export function GraphSection({
	graph,
	onSectionChange,
}: {
	graph: GraphSettings | undefined;
	onSectionChange: (next: GraphSettings) => boolean | Promise<boolean>;
}) {
	const { tr } = useI18n();
	// Wave 7 collapse (owner ruling 2026-09-23): the section is the MASTER
	// SWITCH — the embedding/clustering/labeling rungs are gone; clustering
	// is the free birth-session partition derived on read, labels ARE session
	// names. The chunk budget (2026-10-02) joined it as the section's second
	// and only other control: it denominates the coverage ring AND gates the
	// auto-extraction trigger (turn settle ≥ budget fires the run).
	//
	// Resolved through the SAME core resolver the server's effective
	// settings use (one source of truth, the 4096-fallback fix 2026-10-02):
	// the hint and placeholder report exactly the number the trigger waits
	// for — never a second hand-rolled default.
	const resolved = resolveSettings(graph === undefined ? null : { version: 1, graph }).graph;
	return (
		<>
			{/* EXTRACTION (renamed, owner 2026-10-06): this switch is the DATA
			    channel — the pipeline, the auditor, the prober's graph tools. It
			    was born labeled "Graph" and that label lied once the rendering
			    switch below arrived: off ≠ no graph, off = the graph stops
			    growing. The testid keeps the old name's shape (row-enabled) so
			    this stays one rename, not a test re-pin. */}
			<SettingsRow label={tr("Extraction", "知识提取")} hint={tr("Off = the graph stops growing", "关闭后知识图谱将停止增长")} testid="graph-row-enabled">
				<Toggle
					checked={graph?.enabled ?? true}
					label={tr("extraction enabled", "启用知识提取")}
					testid="toggle-extraction-enabled"
					onChange={(on) =>
						// Compose, never replace-whole (the section PUT is, but the
					// row must not drop its sibling field — fixed with the budget
					// row's arrival: the old { enabled: on } wiped a stored budget).
						onSectionChange({ ...graph, enabled: on })
					}
				/>
			</SettingsRow>
			{/* GRAPH RENDERING (owner, 2026-10-06 — the release graph-controls
			    round): display-only. Off = the home shows the chains view
			    instead of the canvas. The ledgers, the pipeline, everything
			    data keeps working — that is the extraction switch above. */}
			<SettingsRow label={tr("Graph rendering", "图谱渲染")} hint={tr("Off = home shows the chains view", "关闭后首页将显示链式列表视图")} testid="graph-row-rendering">
				<Toggle
					checked={graph?.rendering ?? true}
					label={tr("graph rendering enabled", "启用图谱渲染")}
					testid="toggle-graph-rendering-enabled"
					onChange={(on) => onSectionChange({ ...graph, rendering: on })}
				/>
			</SettingsRow>
			<SettingsRow
				label={tr("Extraction chunk budget", "提取分块 Token 预算")}
				hint={`${resolved.extractionChunkTokens} tok`}
				testid="graph-row-chunk-tokens"
			>
				<CommitInput
					type="number"
					value={String(graph?.extractionChunkTokens ?? "")}
					placeholder={String(resolved.extractionChunkTokens)}
					ariaLabel={tr("extraction chunk budget", "提取分块预算")}
					testid="input-chunk-tokens"
					onCommit={(v) => {
						// Empty = factory default (the fix-wave discipline): absence is
						// the unset for numbers — Number("") is 0, so clamping would
						// write the floor instead of unsetting.
						if (v === "") {
							return onSectionChange({ ...graph, extractionChunkTokens: undefined });
						}
						const n = Number(v);
						if (!Number.isFinite(n) || n <= 0) return false; // bad input: no write
						// Mirror the server sanitize exactly: floor only (cost
						// protection), no ceiling — a big budget is the user's call.
						return onSectionChange({
							...graph,
							extractionChunkTokens: Math.max(EXTRACTION_CHUNK_TOKENS_FLOOR, Math.round(n)),
						});
					}}
				/>
			</SettingsRow>
		</>
	);
}
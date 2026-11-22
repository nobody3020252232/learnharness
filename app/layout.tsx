import type { Metadata } from "next";
import { JetBrains_Mono, Source_Sans_3 } from "next/font/google";
import { connection } from "next/server";
import "katex/dist/katex.min.css";
import "./globals.css";
import { AppShell, SidebarProvider } from "@/components/sidebar";
import { ActivityProvider } from "@/components/activity-dock";
import { ServerEventsProvider } from "@/components/server-events";
import { AppearanceProvider } from "@/components/settings/appearance";
import { I18nProvider } from "@/components/i18n";
import UpdateBanner from "@/components/update-banner";
import { PluginsProvider } from "@/components/plugins";
import { DEFAULT_UI_LOCALE } from "@/src/core";
import { readThemeBoot } from "@/src/server";

// Chrome = JetBrains Mono, teaching prose = Source Sans 3, titles = CMU
// Serif (the bundled lh-cmu @font-face in globals.css — no CDN).
const ui = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });
const prose = Source_Sans_3({ subsets: ["latin"], variable: "--font-sans3" });

export async function generateMetadata(): Promise<Metadata> {
	await connection();
	const { appearance } = readThemeBoot();
	const isZh = (appearance?.locale ?? DEFAULT_UI_LOCALE) === "zh-CN";
	return {
		title: isZh ? "Learning Harness — AI 交互式教学助手" : "Learning Harness",
		description: isZh
			? "拥有持久记忆的 AI 导师 — 交互会话、自测练习与个人知识图谱。"
			: "A teacher agent with a memory — sessions, quizzes, and a knowledge graph of what you know.",
	};
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
	// The theme is server-rendered — its class AND its color variables —
	// so no first frame ever shows the wrong theme. connection(): the
	// record and the theme files are per-machine disk state — without it a
	// prerendered route (settings) would bake the BUILD machine's record.
	await connection();
	const { appearance, theme, vars } = readThemeBoot();
	const locale = appearance?.locale ?? DEFAULT_UI_LOCALE;
	return (
		<html
			lang={locale}
			className={`${theme.mode} ${ui.variable} ${prose.variable}`}
			style={vars as React.CSSProperties}
			suppressHydrationWarning
		>
			<body className="min-h-dvh antialiased">
			{/* The notification channel rides OUTSIDE everything: sidebar, dock,
				 and pages all subscribe as the polls retire (push S3, 2026-10-02). */}
			<AppearanceProvider initialAppearance={appearance} initialTheme={theme}>
				<I18nProvider>
					<ServerEventsProvider>
						<PluginsProvider>
							<SidebarProvider>
								<ActivityProvider>
									<AppShell>{children}</AppShell>
								</ActivityProvider>
							</SidebarProvider>
						</PluginsProvider>
					</ServerEventsProvider>
					{/* Auto-update banner (Wave C): fixed card, Electron-only pushes. */}
					<UpdateBanner />
				</I18nProvider>
			</AppearanceProvider>
		</body>
		</html>
	);
}

export function isZhLocale(): boolean {
  return typeof document !== "undefined" && document.documentElement?.lang === "zh-CN";
}

export function tr(en: string, zh: string, params?: Record<string, string | number>): string {
  const template = isZhLocale() ? zh : en;
  if (!params) return template;
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key: string) => (key in params ? String(params[key]) : match));
}

const FAMILY_LABELS_ZH: Record<"chemicalStructures" | "musicalNotation" | "technicalDiagrams", string> = {
  chemicalStructures: "化学结构式",
  musicalNotation: "乐谱记谱",
  technicalDiagrams: "技术图表",
};

export function familyLabel(family: "chemicalStructures" | "musicalNotation" | "technicalDiagrams", fallback: string): string {
  return tr(fallback, FAMILY_LABELS_ZH[family]);
}

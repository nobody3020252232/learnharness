export function isZhLocale(): boolean {
  return typeof document !== "undefined" && document.documentElement?.lang === "zh-CN";
}

export function tr(en: string, zh: string, params?: Record<string, string | number>): string {
  const template = isZhLocale() ? zh : en;
  if (!params) return template;
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key: string) => (key in params ? String(params[key]) : match));
}

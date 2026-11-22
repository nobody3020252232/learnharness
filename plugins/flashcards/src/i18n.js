export function isZhLocale() {
  return typeof document !== 'undefined' && document.documentElement?.lang === 'zh-CN';
}

export function tr(en, zh, params) {
  const template = isZhLocale() ? zh : en;
  if (!params) return template;
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) => (key in params ? String(params[key]) : match));
}

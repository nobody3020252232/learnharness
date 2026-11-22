// Library-wide scheduling summaries, rendered only from the backend snapshot.
import { isZhLocale, tr } from './i18n.js';

const stateEntries = () => [
  ['new', tr('New', '新卡')],
  ['learning', tr('Learning', '学习中')],
  ['review', tr('Review', '复习')],
  ['relearning', tr('Relearning', '重学中')],
];
const svgNamespace = 'http://www.w3.org/2000/svg';
const count = value => Number.isFinite(value) && value > 0 ? value : 0;
function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function svgElement(tag, attributes = {}, text) {
  const node = document.createElementNS(svgNamespace, tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  if (text !== undefined) node.textContent = text;
  return node;
}
function dateLabels(day) {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day || '');
  if (!parts) return { weekday: '', date: day || '', full: day || '' };
  // Day keys are civil dates, not UTC timestamps. Local noon also avoids DST gaps.
  const date = new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]), 12);
  const loc = isZhLocale() ? 'zh-CN' : undefined;
  return {
    weekday: date.toLocaleDateString(loc, { weekday: 'short' }),
    date: date.toLocaleDateString(loc, { month: 'short', day: 'numeric' }),
    full: date.toLocaleDateString(loc, { weekday: 'short', month: 'short', day: 'numeric' }),
  };
}

export function mountDashboard({ container, signal }) {
  const states = stateEntries();
  const root = element('section', 'fc-dashboard'); root.setAttribute('aria-label', tr('Spaced repetition', '间隔重复'));
  const heading = element('h2', 'fc-dashboard-heading', tr('Spaced repetition', '间隔重复'));
  const loading = element('p', 'fc-muted', tr('Loading statistics…', '正在加载统计数据…')); loading.setAttribute('role', 'status');
  const stateTitle = element('h3', '', tr('Current states', '当前状态'));
  const stateBar = element('div', 'fc-state-bar'); stateBar.setAttribute('aria-hidden', 'true');
  const legend = element('ul', 'fc-state-legend');
  const stateCaption = element('p', 'fc-chart-caption', tr('Active propositions with at least one cue.', '至少包含一张提示卡的活跃知识点。'));
  const charts = element('div', 'fc-chart-grid');
  root.append(heading, loading, stateTitle, stateBar, legend, stateCaption, charts);
  const stateNodes = states.map(([key, label]) => {
    const segment = element('span', 'fc-state-segment'); segment.dataset.state = key; stateBar.append(segment);
    const item = element('li'); item.dataset.state = key;
    const name = element('span', '', label), value = element('strong', '', '0');
    item.append(name, document.createTextNode(' '), value); legend.append(item);
    return { key, label, segment, value };
  });
  function chart(kind, title, caption) {
    const figure = element('figure', 'fc-chart'), chartTitle = element('h3', '', title);
    figure.dataset.chart = kind;
    const scroll = element('div', 'fc-chart-scroll');
    const svg = svgElement('svg', { class: 'fc-chart-svg', role: 'img', width: '100%', preserveAspectRatio: 'xMidYMid meet' });
    scroll.append(svg); figure.append(chartTitle, scroll, element('figcaption', 'fc-chart-caption', caption)); charts.append(figure);
    return { title, svg };
  }
  const due = chart('due', tr('Scheduled due', '计划到期'), tr('Current scheduled due dates.', '当前计划的到期复习日期。'));
  const activity = chart('activity', tr('Scheduled reviews', '计划复习记录'), tr('Scheduled review ratings recorded each day.', '每日记录的计划复习评分数量。'));
  let disposed = false;
  function renderChart(chart, values, kind, width) {
    const rows = Array.isArray(values) ? values : [];
    const step = width / Math.max(rows.length, 1), baseline = 130;
    const maximum = Math.max(1, ...rows.map(row => count(row.count)));
    chart.svg.replaceChildren(); chart.svg.setAttribute('viewBox', `0 0 ${width} 184`);
    const descriptions = [];
    for (const [index, row] of rows.entries()) {
      const labels = dateLabels(row.day);
      const specialKey = kind === 'due' && row.day === null ? 'overdue' : (kind === 'due' && index === 1) || (kind === 'activity' && index === rows.length - 1) ? 'today' : '';
      const special = specialKey === 'overdue' ? tr('Overdue', '已逾期') : specialKey === 'today' ? tr('Today', '今天') : '';
      const label = special || (kind === 'due' ? labels.weekday : labels.date);
      const detail = special || labels.full, value = count(row.count);
      descriptions.push(`${detail}: ${value}`);
      const group = svgElement('g', { 'data-day': row.day ?? 'overdue' });
      const x = step * (index + .5), height = Math.max(1, value / maximum * 104);
      const bucket = kind === 'activity' ? 'activity' : specialKey === 'overdue' ? 'overdue' : specialKey === 'today' ? 'today' : 'future';
      // Palette hooks belong to bars, never their groups or foreground labels.
      group.append(svgElement('rect', { class: 'fc-chart-bar', 'data-bucket': bucket, x: x - step * .3, y: baseline - height, width: step * .6, height, fill: 'currentColor', opacity: '.6', rx: 2 }));
      group.append(svgElement('text', { class: 'fc-chart-count', x, y: baseline - height - 6, 'text-anchor': 'middle', 'font-size': 12, fill: 'currentColor' }, String(value)));
      const dateText = svgElement('text', { class: 'fc-chart-label', x, y: 151, 'text-anchor': 'middle', 'font-size': 10, fill: 'currentColor' });
      dateText.append(svgElement('tspan', { x }, label));
      if (kind === 'due' && !special) dateText.append(svgElement('tspan', { class: 'fc-chart-date', x, dy: 15 }, labels.date));
      group.append(dateText); chart.svg.append(group);
    }
    const accessible = `${chart.title}: ${descriptions.length ? descriptions.join('; ') : tr('No data available.', '暂无数据。')}`;
    chart.svg.setAttribute('aria-label', accessible);
  }
  function update(statistics) {
    if (disposed || signal.aborted) return;
    loading.hidden = statistics != null;
    const total = states.reduce((sum, [key]) => sum + count(statistics?.states?.[key]), 0);
    for (const node of stateNodes) {
      const value = count(statistics?.states?.[node.key]);
      node.value.textContent = String(value); node.segment.style.width = `${total ? value / total * 100 : 0}%`;
      node.segment.title = `${node.label}: ${value}`;
    }
    // Equal-width cards must share SVG proportions so baselines and captions align.
    const width = Math.max(320, Array.isArray(statistics?.due) ? statistics.due.length * 64 : 0, Array.isArray(statistics?.activity) ? statistics.activity.length * 48 : 0);
    renderChart(due, statistics?.due, 'due', width); renderChart(activity, statistics?.activity, 'activity', width);
  }
  function dispose() {
    if (disposed) return;
    disposed = true; signal.removeEventListener('abort', dispose); root.remove();
  }
  if (signal.aborted) dispose();
  else { container.append(root); signal.addEventListener('abort', dispose, { once: true }); update(); }
  return { update, dispose };
}

import {z} from 'zod';

/*
 * IELTS Academic Writing Task 1 visual material as data (docs/phase-5/P5-plan.md §2.1, SPEC §14.4).
 *
 * The structured data is the source of truth: the chart is drawn from it by code (renderChartSvg), the learner can open the
 * same data as a table (chartTable), and the facts the assessor checks the response against are computed by code
 * (chartFacts) — no model invents a chart or its interpretation. Data in the library is invented for practice and says so.
 */

const label = z.string().trim().min(1).max(60);
const value = z.number().finite();

const axisChart = {
  title: z.string().trim().min(1).max(120),
  /** x axis: years, months, groups — in reading order. */
  x: z.object({label: label, categories: z.array(label).min(2).max(12)}),
  y: z.object({label: label, unit: z.string().trim().max(24)}),
  series: z.array(z.object({name: label, values: z.array(value)})).min(1).max(5),
};

export const lineChart = z.object({kind: z.literal('line'), ...axisChart});
export const barChart = z.object({kind: z.literal('bar'), ...axisChart});
export const pieChart = z.object({
  kind: z.literal('pie'),
  title: z.string().trim().min(1).max(120),
  /** Shares in per cent; they add up to 100. */
  slices: z.array(z.object({label, value})).min(2).max(8),
});
export const tableChart = z.object({
  kind: z.literal('table'),
  title: z.string().trim().min(1).max(120),
  unit: z.string().trim().max(24),
  /** Header of the value columns (the first column holds the row labels). */
  columns: z.array(label).min(2).max(8),
  rows: z.array(z.object({label, values: z.array(value)})).min(2).max(10),
});

export const chart = z.discriminatedUnion('kind', [lineChart, barChart, pieChart, tableChart]);

export const chartSpec = z.object({
  format: z.literal('chart-spec/1'),
  /** Task 1 shows one chart or a pair. */
  charts: z.array(chart).min(1).max(2),
  /** Library data is invented for practice; the page says so. */
  data: z.literal('illustrative'),
});

export type Chart = z.infer<typeof chart>;
export type AxisChart = z.infer<typeof lineChart> | z.infer<typeof barChart>;
export type ChartSpec = z.infer<typeof chartSpec>;

const PIE_TOTAL_TOLERANCE = 0.5;
const MAX_DECIMALS = 1;
const MAX_VALUE = 1e7;

const decimals = (n: number) => (Number.isInteger(n) ? 0 : (String(n).split('.')[1] ?? '').length);
const duplicates = (xs: string[]) => xs.filter((x, i) => xs.findIndex(y => y.toLowerCase() === x.toLowerCase()) !== i);

/** Problems that make the data unfit for a task: wrong shapes, unreadable or implausible numbers. Empty when the chart is fine. */
export function checkChart(c: Chart): string[] {
  const problems: string[] = [];
  const numbers = (where: string, values: number[], nonNegative: boolean) => {
    values.forEach((v, i) => {
      if (decimals(v) > MAX_DECIMALS) problems.push(`${where}[${i}]: more than ${MAX_DECIMALS} decimal`);
      if (Math.abs(v) > MAX_VALUE) problems.push(`${where}[${i}]: too large to read`);
      if (nonNegative && v < 0) problems.push(`${where}[${i}]: negative`);
    });
  };
  if (c.kind === 'line' || c.kind === 'bar') {
    for (const d of duplicates(c.x.categories)) problems.push(`x: duplicate category ${d}`);
    for (const d of duplicates(c.series.map(s => s.name))) problems.push(`series: duplicate name ${d}`);
    c.series.forEach((s, i) => {
      if (s.values.length !== c.x.categories.length) problems.push(`series[${i}]: ${s.values.length} values for ${c.x.categories.length} categories`);
      numbers(`series[${i}]`, s.values, c.kind === 'bar');
    });
    if (c.kind === 'bar' && c.series.length * c.x.categories.length > 30) problems.push('bar: too many bars to read');
  } else if (c.kind === 'pie') {
    for (const d of duplicates(c.slices.map(s => s.label))) problems.push(`slices: duplicate label ${d}`);
    numbers('slices', c.slices.map(s => s.value), true);
    if (c.slices.some(s => s.value === 0)) problems.push('slices: a zero share');
    const total = c.slices.reduce((t, s) => t + s.value, 0);
    if (Math.abs(total - 100) > PIE_TOTAL_TOLERANCE) problems.push(`slices: shares add up to ${round1(total)}, not 100`);
  } else {
    for (const d of duplicates(c.columns)) problems.push(`columns: duplicate ${d}`);
    for (const d of duplicates(c.rows.map(r => r.label))) problems.push(`rows: duplicate label ${d}`);
    c.rows.forEach((r, i) => {
      if (r.values.length !== c.columns.length) problems.push(`rows[${i}]: ${r.values.length} values for ${c.columns.length} columns`);
      numbers(`rows[${i}]`, r.values, false);
    });
  }
  return problems;
}

/** Problems of a whole spec: its schema, then each chart. */
export function checkChartSpec(input: unknown): string[] {
  const parsed = chartSpec.safeParse(input);
  if (!parsed.success) return parsed.error.issues.map(i => `${i.path.join('.') || 'spec'}: ${i.message}`);
  return parsed.data.charts.flatMap((c, i) => checkChart(c).map(p => `charts[${i}] ${p}`));
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** English number format of the task: thousands separators, at most one decimal. */
export function formatNumber(n: number): string {
  return round1(n).toLocaleString('en-GB', {maximumFractionDigits: 1});
}

const withUnit = (n: number, unit: string) => (unit === '%' ? `${formatNumber(n)}%` : unit ? `${formatNumber(n)} ${unit}` : formatNumber(n));

/** The chart's data as a table (the accessible view and the assessor's copy): a header row, then label + values. */
export function chartTable(c: Chart): {caption: string; head: string[]; rows: string[][]} {
  if (c.kind === 'pie') return {caption: c.title, head: ['', 'Share'], rows: c.slices.map(s => [s.label, `${formatNumber(s.value)}%`])};
  if (c.kind === 'table') return {caption: c.unit ? `${c.title} (${c.unit})` : c.title, head: ['', ...c.columns], rows: c.rows.map(r => [r.label, ...r.values.map(formatNumber)])};
  const unit = c.y.unit ? ` (${c.y.unit})` : '';
  return {caption: `${c.title}${unit}`, head: ['', ...c.x.categories], rows: c.series.map(s => [s.name, ...s.values.map(formatNumber)])};
}

// ---------------------------------------------------------------------------------------------------------------------------
// Facts: what a good response should notice, computed from the data.

export type ChartFact = {kind: string; text: string};

function trend(values: number[]): 'rose' | 'fell' | 'stayed about the same' | 'fluctuated' {
  const first = values[0];
  const last = values[values.length - 1];
  const span = Math.max(...values) - Math.min(...values);
  const scale = Math.max(Math.abs(first), Math.abs(last), 1);
  if (span / scale < 0.05) return 'stayed about the same';
  const steps = values.slice(1).map((v, i) => Math.sign(v - values[i]));
  const ups = steps.filter(s => s > 0).length;
  const downs = steps.filter(s => s < 0).length;
  if (last > first && downs <= Math.floor(steps.length / 3)) return 'rose';
  if (last < first && ups <= Math.floor(steps.length / 3)) return 'fell';
  return 'fluctuated';
}

const change = (from: number, to: number) => (from === 0 ? null : round1(((to - from) / Math.abs(from)) * 100));

function axisFacts(c: AxisChart): ChartFact[] {
  const cats = c.x.categories;
  const u = c.y.unit;
  const facts: ChartFact[] = [];
  const first = cats[0];
  const last = cats[cats.length - 1];
  for (const s of c.series) {
    const max = Math.max(...s.values);
    const min = Math.min(...s.values);
    const pct = change(s.values[0], s.values[s.values.length - 1]);
    facts.push({kind: 'trend', text: `${s.name} ${trend(s.values)} from ${withUnit(s.values[0], u)} in ${first} to ${withUnit(s.values[s.values.length - 1], u)} in ${last}`
      + (pct === null ? '.' : ` (${pct >= 0 ? '+' : ''}${formatNumber(pct)}%).`)});
    facts.push({kind: 'peak', text: `${s.name} was highest in ${cats[s.values.indexOf(max)]} (${withUnit(max, u)}) and lowest in ${cats[s.values.indexOf(min)]} (${withUnit(min, u)}).`});
  }
  if (c.series.length > 1) {
    const at = (i: number) => [...c.series].sort((a, b) => b.values[i] - a.values[i]);
    facts.push({kind: 'ranking', text: `In ${first} the highest was ${at(0)[0].name}; in ${last} it was ${at(cats.length - 1)[0].name}.`});
    const changes = c.series.map(s => ({s, d: s.values[s.values.length - 1] - s.values[0]}));
    const up = [...changes].sort((a, b) => b.d - a.d)[0];
    const down = [...changes].sort((a, b) => a.d - b.d)[0];
    if (up.d > 0) facts.push({kind: 'largest_change', text: `The largest increase was in ${up.s.name} (+${withUnit(up.d, u)}).`});
    if (down.d < 0) facts.push({kind: 'largest_change', text: `The largest decrease was in ${down.s.name} (${withUnit(down.d, u).replace(/^-/, '−')}).`});
    for (let a = 0; a < c.series.length; a++) {
      for (let b = a + 1; b < c.series.length; b++) {
        const A = c.series[a];
        const B = c.series[b];
        for (let i = 1; i < cats.length; i++) {
          const before = Math.sign(A.values[i - 1] - B.values[i - 1]);
          const after = Math.sign(A.values[i] - B.values[i]);
          if (before !== 0 && after !== 0 && before !== after) {
            facts.push({kind: 'crossing', text: `${A.name} and ${B.name} changed places between ${cats[i - 1]} and ${cats[i]}.`});
          }
        }
      }
    }
  }
  return facts;
}

function pieFacts(c: z.infer<typeof pieChart>): ChartFact[] {
  const sorted = [...c.slices].sort((a, b) => b.value - a.value);
  const facts: ChartFact[] = [
    {kind: 'largest', text: `The largest share was ${sorted[0].label} (${formatNumber(sorted[0].value)}%).`},
    {kind: 'smallest', text: `The smallest share was ${sorted[sorted.length - 1].label} (${formatNumber(sorted[sorted.length - 1].value)}%).`},
    {kind: 'ranking', text: `In order: ${sorted.map(s => `${s.label} ${formatNumber(s.value)}%`).join(', ')}.`},
  ];
  if (sorted.length > 2) {
    facts.push({kind: 'combined', text: `${sorted[0].label} and ${sorted[1].label} together made up ${formatNumber(sorted[0].value + sorted[1].value)}%.`});
  }
  return facts;
}

function tableFacts(c: z.infer<typeof tableChart>): ChartFact[] {
  const facts: ChartFact[] = [];
  c.columns.forEach((col, j) => {
    const sorted = [...c.rows].sort((a, b) => b.values[j] - a.values[j]);
    facts.push({kind: 'column', text: `${col}: highest ${sorted[0].label} (${withUnit(sorted[0].values[j], c.unit)}), lowest ${sorted[sorted.length - 1].label} (${withUnit(sorted[sorted.length - 1].values[j], c.unit)}).`});
  });
  for (const r of c.rows) {
    const max = Math.max(...r.values);
    facts.push({kind: 'row', text: `${r.label}: highest in ${c.columns[r.values.indexOf(max)]} (${withUnit(max, c.unit)}).`});
  }
  return facts;
}

/** The facts of one chart, in English (they go to the assessor with the data). */
export function chartFacts(c: Chart): ChartFact[] {
  if (c.kind === 'pie') return pieFacts(c);
  if (c.kind === 'table') return tableFacts(c);
  return axisFacts(c);
}

// ---------------------------------------------------------------------------------------------------------------------------
// SVG: deterministic drawing of line, bar and pie charts (a table is shown as an HTML table from chartTable()).

const W = 640;
const H = 400;
const M = {top: 48, right: 24, bottom: 88, left: 64};
// Distinguishable in light and dark, with markers so lines do not rely on colour alone.
const COLORS = ['#2563eb', '#dc2626', '#16a34a', '#d97706', '#7c3aed'];
const MARKERS = ['circle', 'square', 'triangle', 'diamond', 'cross'] as const;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const n2 = (n: number) => String(Math.round(n * 100) / 100);

/** Axis ticks from 0 (or the minimum, if negative) to a round maximum: steps of 1, 2, 2.5 or 5 × 10^k, 4–6 intervals. */
export function niceTicks(min: number, max: number): number[] {
  const lo = Math.min(0, min);
  const hi = max <= lo ? lo + 1 : max;
  const raw = (hi - lo) / 5;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map(m => m * pow).find(s => (hi - lo) / s <= 6)!;
  const start = Math.floor(lo / step) * step;
  const ticks: number[] = [];
  for (let t = start; t < hi + step - 1e-9; t += step) ticks.push(Math.round(t * 1e6) / 1e6);
  return ticks;
}

function marker(kind: typeof MARKERS[number], x: number, y: number, color: string): string {
  const s = 4;
  if (kind === 'circle') return `<circle cx="${n2(x)}" cy="${n2(y)}" r="${s}" fill="${color}"/>`;
  if (kind === 'square') return `<rect x="${n2(x - s)}" y="${n2(y - s)}" width="${2 * s}" height="${2 * s}" fill="${color}"/>`;
  if (kind === 'triangle') return `<path d="M${n2(x)} ${n2(y - s - 1)}L${n2(x + s + 1)} ${n2(y + s)}L${n2(x - s - 1)} ${n2(y + s)}Z" fill="${color}"/>`;
  if (kind === 'diamond') return `<path d="M${n2(x)} ${n2(y - s - 1)}L${n2(x + s + 1)} ${n2(y)}L${n2(x)} ${n2(y + s + 1)}L${n2(x - s - 1)} ${n2(y)}Z" fill="${color}"/>`;
  return `<path d="M${n2(x - s)} ${n2(y - s)}L${n2(x + s)} ${n2(y + s)}M${n2(x + s)} ${n2(y - s)}L${n2(x - s)} ${n2(y + s)}" stroke="${color}" stroke-width="2"/>`;
}

/** Legend columns: fewer when a label is long, so labels never run into each other. */
const columns = (names: string[], max: number) => Math.min(names.length, Math.max(...names.map(n => n.length)) > 20 ? 2 : Math.max(...names.map(n => n.length)) > 12 ? Math.min(3, max) : max);

function legend(names: string[], lines: boolean): string {
  const per = columns(names, 3);
  return names.map((name, i) => {
    const col = i % per;
    const row = Math.floor(i / per);
    const x = M.left + col * ((W - M.left - M.right) / per);
    const y = H - 40 + row * 18;
    const key = lines ? `<line x1="${x}" y1="${y}" x2="${x + 22}" y2="${y}" stroke="${COLORS[i]}" stroke-width="2"/>${marker(MARKERS[i], x + 11, y, COLORS[i])}`
      : `<rect x="${x}" y="${y - 6}" width="14" height="12" fill="${COLORS[i]}"/>`;
    return `${key}<text x="${x + 28}" y="${y + 4}" font-size="12">${esc(name)}</text>`;
  }).join('');
}

function axisSvg(c: AxisChart): string {
  const all = c.series.flatMap(s => s.values);
  const ticks = niceTicks(Math.min(...all), Math.max(...all));
  const lo = ticks[0];
  const hi = ticks[ticks.length - 1];
  const plotW = W - M.left - M.right;
  const plotH = H - M.top - M.bottom;
  const y = (v: number) => M.top + plotH - ((v - lo) / (hi - lo)) * plotH;
  const n = c.x.categories.length;
  const band = plotW / n;
  const cx = (i: number) => M.left + band * i + band / 2;
  const parts: string[] = [];
  for (const t of ticks) {
    parts.push(`<line x1="${M.left}" y1="${n2(y(t))}" x2="${W - M.right}" y2="${n2(y(t))}" stroke="currentColor" stroke-opacity="0.15"/>`);
    parts.push(`<text x="${M.left - 8}" y="${n2(y(t) + 4)}" font-size="12" text-anchor="end">${esc(formatNumber(t))}</text>`);
  }
  c.x.categories.forEach((cat, i) => parts.push(`<text x="${n2(cx(i))}" y="${H - M.bottom + 18}" font-size="12" text-anchor="middle">${esc(cat)}</text>`));
  parts.push(`<line x1="${M.left}" y1="${n2(y(lo))}" x2="${W - M.right}" y2="${n2(y(lo))}" stroke="currentColor"/>`);
  const yLabel = c.y.unit ? `${c.y.label} (${c.y.unit})` : c.y.label;
  parts.push(`<text transform="translate(16 ${n2(M.top + plotH / 2)}) rotate(-90)" font-size="12" text-anchor="middle">${esc(yLabel)}</text>`);
  parts.push(`<text x="${n2(M.left + plotW / 2)}" y="${H - M.bottom + 38}" font-size="12" text-anchor="middle">${esc(c.x.label)}</text>`);
  if (c.kind === 'line') {
    c.series.forEach((s, k) => {
      parts.push(`<polyline fill="none" stroke="${COLORS[k]}" stroke-width="2" points="${s.values.map((v, i) => `${n2(cx(i))},${n2(y(v))}`).join(' ')}"/>`);
      s.values.forEach((v, i) => parts.push(marker(MARKERS[k], cx(i), y(v), COLORS[k])));
    });
  } else {
    const inner = band * 0.8;
    const bw = inner / c.series.length;
    c.series.forEach((s, k) => s.values.forEach((v, i) => {
      const x = M.left + band * i + (band - inner) / 2 + bw * k;
      const top = Math.min(y(v), y(Math.max(lo, 0)));
      const h = Math.abs(y(v) - y(Math.max(lo, 0)));
      parts.push(`<rect x="${n2(x)}" y="${n2(top)}" width="${n2(bw - 1)}" height="${n2(h)}" fill="${COLORS[k]}"/>`);
    }));
  }
  parts.push(legend(c.series.map(s => s.name), c.kind === 'line'));
  return parts.join('');
}

function pieSvg(c: z.infer<typeof pieChart>): string {
  const r = 112;
  const cxp = W / 2;
  const cyp = M.top + 142;
  const total = c.slices.reduce((t, s) => t + s.value, 0);
  let angle = -Math.PI / 2;
  const parts: string[] = [];
  c.slices.forEach((s, i) => {
    const sweep = (s.value / total) * 2 * Math.PI;
    const a2 = angle + sweep;
    const [x1, y1, x2, y2] = [cxp + r * Math.cos(angle), cyp + r * Math.sin(angle), cxp + r * Math.cos(a2), cyp + r * Math.sin(a2)];
    const color = COLORS[i % COLORS.length];
    parts.push(`<path d="M${cxp} ${cyp}L${n2(x1)} ${n2(y1)}A${r} ${r} 0 ${sweep > Math.PI ? 1 : 0} 1 ${n2(x2)} ${n2(y2)}Z" fill="${color}" stroke="#fff" stroke-width="1"`
      + (i >= COLORS.length ? ' fill-opacity="0.55"' : '') + '/>');
    const mid = angle + sweep / 2;
    parts.push(`<text x="${n2(cxp + (r + 18) * Math.cos(mid))}" y="${n2(cyp + (r + 18) * Math.sin(mid) + 4)}" font-size="12" text-anchor="${Math.cos(mid) >= 0 ? 'start' : 'end'}">${esc(formatNumber(s.value))}%</text>`);
    angle = a2;
  });
  const names = c.slices.map(s => s.label);
  const per = columns(names, 4);
  names.forEach((name, i) => {
    const x = M.left + (i % per) * ((W - M.left - M.right) / per);
    const yy = H - 52 + Math.floor(i / per) * 18;
    parts.push(`<rect x="${x}" y="${yy - 6}" width="14" height="12" fill="${COLORS[i % COLORS.length]}"${i >= COLORS.length ? ' fill-opacity="0.55"' : ''}/><text x="${x + 20}" y="${yy + 4}" font-size="12">${esc(name)}</text>`);
  });
  return parts.join('');
}

/** One chart as a standalone SVG (line, bar, pie); null for a table, which is shown from chartTable(). Same data, same SVG. */
export function renderChartSvg(c: Chart): string | null {
  if (c.kind === 'table') return null;
  const body = c.kind === 'pie' ? pieSvg(c) : axisSvg(c);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(c.title)}" font-family="system-ui, sans-serif" fill="currentColor">`
    + `<title>${esc(c.title)}</title><text x="${W / 2}" y="24" font-size="15" font-weight="600" text-anchor="middle">${esc(c.title)}</text>${body}</svg>`;
}

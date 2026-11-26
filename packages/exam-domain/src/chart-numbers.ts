import type {Chart, ChartSpec} from './chart-spec.js';

/*
 * Academic Task 1: do the figures in a response match the data? (docs/phase-5/P5-plan.md §2.3, P5.4)
 *
 * Every number in the response is read with its scale word (thousand, million) and per cent sign and compared with the
 * values the data supports: each value, differences and sums of two values of the same series, category or chart, and
 * percentage changes within a series, and any combination of the shares of a pie ("the three smaller categories made up
 * 43.5%"). Approximate wording ("about", "just over", "nearly") widens the tolerance. Years and the numbers of labels
 * ("the 25–44 group", "over 65") are not figures; small bare numbers that match nothing are counts ("three countries"),
 * not claims.
 * Only a figure that clearly matches nothing the data supports is reported as `unmatched`; the assessor decides what it
 * means (a misread value, a wrong unit or year), the code never corrects it.
 */

export type NumberMention = {
  /** Code-point offsets into the response, like finding spans. */
  start: number;
  end: number;
  text: string;
  value: number;
  percent: boolean;
  approximate: boolean;
  status: 'matched' | 'unmatched' | 'year' | 'label' | 'count';
  /** The closest supported value, for unmatched figures. */
  nearest?: number;
};

const SCALE: Record<string, number> = {thousand: 1e3, thousands: 1e3, million: 1e6, millions: 1e6, billion: 1e9, billions: 1e9, k: 1e3, m: 1e6, bn: 1e9};
const UNIT_SCALE = (unit: string) => {
  const u = unit.toLowerCase();
  return u.startsWith('thousand') ? 1e3 : u.startsWith('million') ? 1e6 : u.startsWith('billion') ? 1e9 : 1;
};
const APPROX = /\b(about|around|approximately|roughly|nearly|almost|just|over|under|more than|less than|close to|some|circa|approx\.?|slightly|a little|well over|well under|up to)\s*$/i;
const NUMBER = /(?<![\w.])(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?(?:\s*(%|per\s*cent\b|percent\b))?(?:\s*(thousands?|millions?|billions?|bn|k|m)\b)?/giu;

/**
 * What the data supports, by kind. `direct` values are read off the chart; `derived` ones need arithmetic: differences,
 * sums and percentage changes. Ratios are only figures before "times" or "-fold".
 */
type Pool = {direct: number[]; derived: number[]};
type Supported = {
  bare: Pool; percent: Pool; ratios: number[]; raw: Set<number>; years: Set<number>; labelNumbers: Set<number>;
  /** The values of one category, column, series or row, by its label: "to 300 thousand in 2020" is read in 2020's column. */
  byLabel: Map<string, {bare: number[]; percent: number[]}>;
};

const r1 = (n: number) => Math.round(n * 10) / 10;

function supported(spec: ChartSpec): Supported {
  const bare: Pool = {direct: [], derived: []};
  const percent: Pool = {direct: [], derived: []};
  const ratios: number[] = [];
  const years = new Set<number>();
  const labelNumbers = new Set<number>();
  const label = (text: string) => {
    for (const n of text.match(/\d+(?:\.\d+)?/g) ?? []) labelNumbers.add(Number(n));
  };
  const raw = new Set<number>();
  const byLabel = new Map<string, {bare: number[]; percent: number[]}>();
  const bind = (name: string, xs: number[], scale: number, asPercent: boolean) => {
    const key = name.toLowerCase();
    const entry = byLabel.get(key) ?? {bare: [], percent: []};
    for (const x of xs) {
      if (asPercent) entry.percent.push(x);
      entry.bare.push(x * scale, ...(scale === 1 ? [] : [x]));
    }
    byLabel.set(key, entry);
  };
  /**
   * Values of one group with their differences, and their sums when adding them means something: shares of a pie, or the
   * series of one category ("cars and buses together in 2020"), not the years of one series. Percentages are also stated
   * without the per cent sign ("rose by 20 points", "at 35 per cent" read as a bare 35 is still a share).
   */
  const addGroup = (xs: number[], scale: number, asPercent: boolean, sums: boolean) => {
    // A chart in thousands is also read in its own unit: "from 210 to 330 thousand".
    const push = (to: keyof Pool, x: number) => {
      if (asPercent) percent[to].push(x);
      bare[to].push(x * scale, ...(scale === 1 ? [] : [x]));
    };
    for (const x of xs) {
      push('direct', x);
      raw.add(x);
    }
    for (let i = 0; i < xs.length; i++) {
      for (let j = i + 1; j < xs.length; j++) {
        push('derived', Math.abs(xs[i] - xs[j]));
        if (sums) push('derived', xs[i] + xs[j]);
        if (xs[i] > 0 && xs[j] > 0) ratios.push(r1(Math.max(xs[i], xs[j]) / Math.min(xs[i], xs[j])));
      }
    }
  };
  const changes = (xs: number[]) => {
    for (let i = 0; i < xs.length; i++) {
      for (let j = i + 1; j < xs.length; j++) {
        if (xs[i] !== 0) percent.derived.push(Math.abs(((xs[j] - xs[i]) / xs[i]) * 100));
      }
    }
  };
  const visit = (c: Chart) => {
    if (c.kind === 'pie') {
      const shares = c.slices.map(s => s.value);
      addGroup(shares, 1, true, true);
      // Three or more shares together (pairs are in addGroup); a pie has at most a few slices, so every subset is cheap.
      for (let mask = 1; mask < 1 << shares.length; mask++) {
        const picked = shares.filter((_, k) => mask & (1 << k));
        if (picked.length > 2) {
          const sum = r1(picked.reduce((a, b) => a + b, 0));
          percent.derived.push(sum);
          bare.derived.push(sum);
        }
      }
      changes(shares);
      c.slices.forEach(s => label(s.label));
      return;
    }
    const pct = (c.kind === 'table' ? c.unit : c.y.unit) === '%';
    const scale = UNIT_SCALE(c.kind === 'table' ? c.unit : c.y.unit);
    const grid: number[][] = c.kind === 'table' ? c.rows.map(r => r.values) : c.series.map(s => s.values);
    const cats = c.kind === 'table' ? c.columns : c.x.categories;
    for (const cat of cats) {
      label(cat);
      for (const y of cat.match(/\b(1[89]\d\d|20\d\d)\b/g) ?? []) years.add(Number(y));
    }
    if (c.kind === 'table') {
      for (const r of c.rows) {
        label(r.label);
        (r.label.match(/\b(1[89]\d\d|20\d\d)\b/g) ?? []).forEach(y => years.add(Number(y)));
      }
    } else {
      c.series.forEach(s => label(s.name));
    }
    for (const row of grid) {
      addGroup(row, scale, pct, false);
      changes(row);
    }
    for (let k = 0; k < (grid[0]?.length ?? 0); k++) addGroup(grid.map(row => row[k]), scale, pct, true);
    cats.forEach((cat, k) => bind(cat, grid.map(row => row[k]), scale, pct));
    const rowNames = c.kind === 'table' ? c.rows.map(r => r.label) : c.series.map(s => s.name);
    rowNames.forEach((name, i) => bind(name, grid[i], scale, pct));
  };
  spec.charts.forEach(visit);
  // Two pies: a share's change between them ("coal fell by 34 points") is derived too.
  const pies = spec.charts.filter(c => c.kind === 'pie');
  if (pies.length === 2) {
    for (const a of pies[0].slices) {
      const b = pies[1].slices.find(s => s.label.toLowerCase() === a.label.toLowerCase());
      if (!b) continue;
      const d = r1(Math.abs(a.value - b.value));
      percent.derived.push(d);
      bare.derived.push(d);
      if (a.value > 0) percent.derived.push(Math.abs(((b.value - a.value) / a.value) * 100));
      if (a.value > 0 && b.value > 0) ratios.push(r1(Math.max(a.value, b.value) / Math.min(a.value, b.value)));
    }
  }
  return {bare, percent, ratios, raw, years, labelNumbers, byLabel};
}

/**
 * Words that make a figure a difference, a sum or a change rather than a value read off the chart: "a drop of 34",
 * "30 thousand ahead of", "together made up 56.5%". Differences are looked for in the figure's own clause, sums anywhere
 * in its sentence ("Together, these two categories comprised 64%").
 */
const DIFFERENCE = /\b(gap|gaps|difference|differences|lead|advantage|margin|more|less|fewer|higher|lower|ahead|behind|above|below|exceed\w*|increase[sd]?|decrease[sd]?|rise|rises|drop|drops|fall|falls|decline[sd]?|growth|gain|gains|loss|losses|change|changes|by|points?|larger|smaller|greater|bigger)\b/i;
const SUM = /\b(together|combined|total|totals|altogether|in all|sum|amounted|added up|between them)\b/i;
const RATIO_AFTER = /^\s*(times|-?fold)\b/i;
/**
 * "330 thousand in 2020", "6 hours for the 25–44 group", "35% among men": up to three unit words, then the label. A unit
 * word is letters only and not a word that starts another phrase ("180 TWh) and lowest in 2025" is not bound to 2025).
 */
const UNIT_WORD = String.raw`(?!(?:and|or|but|then|before|after|while|whereas|which|when|than|to|from|at|by|of|in|for|among))[\p{L}%'’-]+`;
const BOUND_AFTER = new RegExp(String.raw`^\s*(?:${UNIT_WORD}\s+){0,3}?(?:in|for|among)\s+(?:the\s+)?`, 'iu');
/** A signed figure is a change: "(+57.1%)", "−120 thousand". */
const SIGN_BEFORE = /(?:^|[^\p{L}\p{N}])[+\u2212-]$/u;

function boundLabel(after: string, labels: Iterable<string>): string | undefined {
  const lead = after.match(BOUND_AFTER);
  if (!lead) return undefined;
  const rest = after.slice(lead[0].length).toLowerCase();
  let best: string | undefined;
  for (const l of labels) {
    if (rest.startsWith(l) && !/[\p{L}\p{N}]/u.test(rest.charAt(l.length)) && (!best || l.length > best.length)) best = l;
  }

  return best;
}

function close(value: number, candidates: number[], approximate: boolean, floor = 0.5): {ok: boolean; nearest?: number} {
  let nearest: number | undefined;
  let best = Infinity;
  for (const c of candidates) {
    const d = Math.abs(c - value);
    if (d < best) {
      best = d;
      nearest = c;
    }
  }
  if (nearest === undefined) return {ok: false};
  // Rounding a figure to its own precision is exact; approximate wording allows 10 %.
  const tolerance = approximate ? Math.max(0.1 * Math.abs(nearest), 1) : Math.max(0.025 * Math.abs(nearest), floor);
  return {ok: best <= tolerance, nearest};
}

/** Every figure of a response, with whether the data supports it. */
export function checkNumbers(response: string, spec: ChartSpec): NumberMention[] {
  const data = supported(spec);
  const codePoints = Array.from(response);
  // Map UTF-16 indices to code points, the offset unit of findings (text.ts).
  const toCp = (utf16: number) => Array.from(response.slice(0, utf16)).length;
  const out: NumberMention[] = [];
  for (const m of response.matchAll(NUMBER)) {
    const whole = Number(m[1].replace(/,/g, '') + (m[2] ? `.${m[2]}` : ''));
    const percent = Boolean(m[3]);
    const scaleWord = m[4]?.toLowerCase();
    const value = whole * (scaleWord ? SCALE[scaleWord] : 1);
    const before = response.slice(Math.max(0, m.index! - 24), m.index!);
    const approximate = APPROX.test(before);
    const start = toCp(m.index!);
    const end = start + Array.from(m[0].trimEnd()).length;
    const mention = {start, end, text: codePoints.slice(start, end).join(''), value, percent, approximate};
    if (!percent && !scaleWord && !m[2] && data.years.has(whole)) {
      out.push({...mention, status: 'year'});
      continue;
    }
    // A bare number that is part of a label: an age band, "Country 2", "Over 65".
    if (!percent && !scaleWord && !m[2] && data.labelNumbers.has(whole)) {
      out.push({...mention, status: 'label'});
      continue;
    }
    // A small bare number is a count ("three countries", "5 periods") unless it is a value of the data itself.
    if (!percent && !scaleWord && !m[2] && whole <= 12 && !data.raw.has(whole)) {
      out.push({...mention, status: 'count'});
      continue;
    }
    // Which values can this figure be? A ratio before "times"; otherwise a value read off the chart, unless the words
    // around it make it a difference, a sum or a change. A per cent of a chart that has no percentages is always a change.
    const sentenceStart = Math.max(0, ...['.', ';', ':', '!', '?', '\n'].map(ch => response.lastIndexOf(ch, m.index! - 1) + 1));
    const clauseStart = Math.max(sentenceStart, response.lastIndexOf(',', m.index! - 1) + 1);
    const tail = response.slice(m.index! + m[0].length);
    const after = tail.slice(0, Math.min(...[',', '.', ';', ':', '\n'].map(ch => (tail.indexOf(ch) + 1 || tail.length + 1) - 1)));
    const clause = response.slice(clauseStart, m.index!) + ' ' + after;
    const kind = percent ? data.percent : data.bare;
    const derivedToo = SIGN_BEFORE.test(response.slice(Math.max(0, m.index! - 2), m.index!)) || DIFFERENCE.test(clause) || SUM.test(response.slice(sentenceStart, m.index!) + after) || kind.direct.length === 0;
    const bound = derivedToo ? undefined : boundLabel(after, data.byLabel.keys());
    const cell = bound ? data.byLabel.get(bound)![percent ? 'percent' : 'bare'] : [];
    const ratio = RATIO_AFTER.test(tail);
    const pool = ratio ? data.ratios : derivedToo ? kind.direct.concat(kind.derived) : cell.length ? cell : kind.direct;
    // Ratios are rounded to one decimal, so "2.1 times" is not 2.
    const fit = close(value, pool, approximate, ratio ? 0.05 : 0.5);
    if (fit.ok) {
      out.push({...mention, status: 'matched'});
    } else if (!percent && !scaleWord && !m[2] && whole >= 1900 && whole <= 2100) {
      out.push({...mention, status: 'year'});
    } else {
      out.push({...mention, status: 'unmatched', nearest: fit.nearest});
    }
  }
  return out;
}

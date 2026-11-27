import {z} from 'zod';

/*
 * A plan or map of an IELTS Listening labelling task as data (docs/phase-7/P7.6-listening-design.md §7), the way Writing
 * Task 1 charts are (chart-spec.ts): a model writes the data, code checks it, draws it (renderMapSvg) and describes it in
 * words for the blind solvers (describeMap). No model draws a picture. North is always at the top.
 *
 * Coordinates are grid squares: x from the west edge (0) to the east (cols), y from the north edge (0) to the south (rows).
 * MultiAdmin's ListeningMap is the PHP twin of checkMapSpec and describeMap; both are tested on the same fixture.
 */

export const MAP_KINDS = ['building', 'room', 'area', 'water', 'trees', 'car_park', 'field'] as const;
export type MapKind = typeof MAP_KINDS[number];

const int = z.number().int();
const name = z.string().trim().min(1).max(30);

export const mapFeature = z.object({
  /** A place with a name on the map, or a place marked with a letter that the questions ask about. Exactly one of the two. */
  label: name.optional(),
  letter: z.string().regex(/^[A-I]$/).optional(),
  kind: z.enum(MAP_KINDS),
  x: int.min(0), y: int.min(0), w: int.min(1), h: int.min(1),
});

export const mapPath = z.object({
  kind: z.enum(['road', 'path']),
  label: name.optional(),
  /** Grid points; each step goes straight west–east or north–south. */
  points: z.array(z.tuple([int, int])).min(2).max(8),
});

export const mapSpec = z.object({
  format: z.literal('map-spec/1'),
  title: z.string().trim().min(1).max(80),
  grid: z.object({cols: int.min(6).max(16), rows: int.min(4).max(12)}),
  features: z.array(mapFeature).min(4).max(20),
  paths: z.array(mapPath).max(8),
  entrances: z.array(z.object({label: name, x: int.min(0), y: int.min(0)})).max(4),
  youAreHere: z.object({x: int.min(0), y: int.min(0)}).optional(),
  /** Invented for practice; the page says so. */
  data: z.literal('illustrative'),
});

export type MapFeature = z.infer<typeof mapFeature>;
export type MapSpec = z.infer<typeof mapSpec>;

export const MAP_MIN_LETTERS = 3;
export const MAP_MIN_LANDMARKS = 3;

const LETTERS = 'ABCDEFGHI';
const featureName = (f: MapFeature) => f.letter ? `letter ${f.letter}` : f.label!;
const overlap = (a: MapFeature, b: MapFeature) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** Problems that make the map unfit for a task. Empty when the map is fine. */
export function checkMapSpec(input: unknown): string[] {
  const parsed = mapSpec.safeParse(input);
  if (!parsed.success) return parsed.error.issues.map(i => `${i.path.join('.') || 'map'}: ${i.message}`);
  const m = parsed.data;
  const problems: string[] = [];
  const {cols, rows} = m.grid;
  m.features.forEach((f, i) => {
    const at = `feature ${i + 1} (${f.label ?? f.letter ?? '?'})`;
    if ((f.label === undefined) === (f.letter === undefined)) problems.push(`${at}: needs a label or a letter, not both`);
    if (f.x + f.w > cols || f.y + f.h > rows) problems.push(`${at}: outside the grid`);
    m.features.forEach((g, j) => {
      if (j > i && overlap(f, g)) problems.push(`${at} overlaps feature ${j + 1}`);
    });
  });
  const letters = m.features.flatMap(f => f.letter ? [f.letter] : []);
  const labels = m.features.flatMap(f => f.label ? [f.label.toLowerCase()] : []);
  if (letters.length < MAP_MIN_LETTERS) problems.push(`fewer than ${MAP_MIN_LETTERS} letters`);
  if (labels.length < MAP_MIN_LANDMARKS) problems.push(`fewer than ${MAP_MIN_LANDMARKS} named places`);
  if ([...letters].sort().join('') !== LETTERS.slice(0, letters.length)) problems.push(`letters must be A-${LETTERS[letters.length - 1] ?? 'A'}, each once`);
  if (new Set(labels).size !== labels.length) problems.push('a name is used twice');
  m.paths.forEach((p, i) => {
    const at = `path ${i + 1}${p.label ? ` (${p.label})` : ''}`;
    if (p.points.some(([x, y]) => x > cols || y > rows)) problems.push(`${at}: outside the grid`);
    p.points.slice(1).forEach(([x, y], k) => {
      const [px, py] = p.points[k];
      if (px !== x && py !== y) problems.push(`${at}: step ${k + 1} is not straight west–east or north–south`);
      if (px === x && py === y) problems.push(`${at}: step ${k + 1} has no length`);
    });
  });
  for (const e of m.entrances) if (e.x > cols || e.y > rows) problems.push(`entrance ${e.label}: outside the grid`);
  if (m.youAreHere && (m.youAreHere.x > cols || m.youAreHere.y > rows)) problems.push('"you are here": outside the grid');
  return problems;
}

const DIRECTIONS = ['east', 'north-east', 'north', 'north-west', 'west', 'south-west', 'south', 'south-east'];

/** Direction of point b seen from point a, in eight compass points (north is up, y grows to the south). */
export function compass(ax: number, ay: number, bx: number, by: number): string {
  const angle = Math.atan2(ay - by, bx - ax);
  // floor(v + 0.5), not Math.round: PHP rounds negative halves the other way, and both twins must agree.
  return DIRECTIONS[(Math.floor(angle / (Math.PI / 4) + 0.5) + 8) % 8];
}

const centre = (f: MapFeature): [number, number] => [f.x + f.w / 2, f.y + f.h / 2];
const span = (from: number, size: number, word: string) => size === 1 ? `${word} ${from + 1}` : `${word}s ${from + 1}-${from + size}`;
/** Features that share an edge (not only a corner). */
const touching = (a: MapFeature, b: MapFeature) =>
  ((a.x + a.w === b.x || b.x + b.w === a.x) && a.y < b.y + b.h && b.y < a.y + a.h)
  || ((a.y + a.h === b.y || b.y + b.h === a.y) && a.x < b.x + b.w && b.x < a.x + a.w);

/**
 * The map in words, for the blind solvers (P7.6 §7): every place with its squares, the roads and paths, the entrances, and
 * for each letter the places next to it and where it lies from the entrances and "you are here". The text is the same as
 * MultiAdmin's ListeningMap::describe (shared fixture).
 */
export function describeMap(m: MapSpec): string {
  const lines = [
    `${m.title}. North is at the top. The map is ${m.grid.cols} squares from west to east (columns 1-${m.grid.cols}) and ${m.grid.rows} squares from north to south (rows 1-${m.grid.rows}).`,
    'Places:',
    ...m.features.map(f => `- ${featureName(f)} (${f.kind.replace('_', ' ')}): ${span(f.x, f.w, 'column')}, ${span(f.y, f.h, 'row')}.`),
  ];
  if (m.paths.length) {
    lines.push('Roads and paths (grid points, column line then row line, 0 is the west or north edge):');
    for (const p of m.paths) lines.push(`- ${p.kind}${p.label ? ` "${p.label}"` : ''}: ${p.points.map(([x, y]) => `(${x}, ${y})`).join(' to ')}.`);
  }
  for (const e of m.entrances) lines.push(`Entrance "${e.label}" at grid point (${e.x}, ${e.y}).`);
  if (m.youAreHere) lines.push(`"You are here" at grid point (${m.youAreHere.x}, ${m.youAreHere.y}).`);
  lines.push('Letters:');
  for (const f of m.features.filter(g => g.letter).sort((a, b) => a.letter!.localeCompare(b.letter!))) {
    const [cx, cy] = centre(f);
    const next = m.features.filter(g => g !== f && touching(f, g)).map(featureName);
    const from = [
      ...m.entrances.map(e => `${compass(e.x, e.y, cx, cy)} of entrance "${e.label}"`),
      ...(m.youAreHere ? [`${compass(m.youAreHere.x, m.youAreHere.y, cx, cy)} of "you are here"`] : []),
    ];
    lines.push(`- ${f.letter}: next to ${next.length ? next.join(', ') : 'nothing'}${from.length ? `; ${from.join('; ')}` : ''}.`);
  }
  return lines.join('\n');
}

const CELL = 44;
const PAD = 28;
const TOP = 44;
const FILL: Record<MapKind, string> = {
  building: 'fill="currentColor" fill-opacity="0.07"',
  room: 'fill="currentColor" fill-opacity="0.04"',
  area: 'fill="currentColor" fill-opacity="0.02" stroke-dasharray="4 3"',
  water: 'fill="#5b9bd5" fill-opacity="0.35"',
  trees: 'fill="#5aa469" fill-opacity="0.35"',
  car_park: 'fill="currentColor" fill-opacity="0.12"',
  field: 'fill="#9bbf5a" fill-opacity="0.25"',
};
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** SVG of a checked map; deterministic and escaped. Letters are drawn in circles, names as text. */
export function renderMapSvg(m: MapSpec): string {
  const W = PAD * 2 + m.grid.cols * CELL;
  const H = TOP + PAD + m.grid.rows * CELL;
  const X = (x: number) => PAD + x * CELL;
  const Y = (y: number) => TOP + y * CELL;
  const parts: string[] = [
    `<rect x="${X(0)}" y="${Y(0)}" width="${m.grid.cols * CELL}" height="${m.grid.rows * CELL}" fill="none" stroke="currentColor" stroke-opacity="0.5"/>`,
  ];
  for (const p of m.paths) {
    const d = p.points.map(([x, y], i) => `${i ? 'L' : 'M'}${X(x)} ${Y(y)}`).join(' ');
    parts.push(p.kind === 'road'
      ? `<path d="${d}" fill="none" stroke="currentColor" stroke-opacity="0.22" stroke-width="16" stroke-linecap="square"/>`
      : `<path d="${d}" fill="none" stroke="currentColor" stroke-opacity="0.55" stroke-width="2" stroke-dasharray="6 4"/>`);
    if (p.label) {
      const [[x1, y1], [x2, y2]] = p.points;
      const vertical = x1 === x2;
      // Beside the line, not on it.
      const mx = X((x1 + x2) / 2) + (vertical ? 11 : 0), my = Y((y1 + y2) / 2) - (vertical ? 0 : 11);
      parts.push(`<text x="${mx}" y="${my}" font-size="11" text-anchor="middle" dominant-baseline="central"${vertical ? ` transform="rotate(-90 ${mx} ${my})"` : ''}>${esc(p.label)}</text>`);
    }
  }
  for (const f of m.features) {
    parts.push(`<rect x="${X(f.x) + 2}" y="${Y(f.y) + 2}" width="${f.w * CELL - 4}" height="${f.h * CELL - 4}" rx="3" stroke="currentColor" stroke-opacity="0.6" ${FILL[f.kind]}/>`);
    const [cx, cy] = centre(f);
    if (f.letter) {
      parts.push(`<circle cx="${X(cx)}" cy="${Y(cy)}" r="13" fill="none" stroke="currentColor" stroke-width="1.5"/>`
        + `<text x="${X(cx)}" y="${Y(cy)}" font-size="15" font-weight="700" text-anchor="middle" dominant-baseline="central">${f.letter}</text>`);
    } else {
      const words = f.label!.split(' ');
      const lines = f.w * CELL < f.label!.length * 7 && words.length > 1 ? [words.slice(0, Math.ceil(words.length / 2)).join(' '), words.slice(Math.ceil(words.length / 2)).join(' ')] : [f.label!];
      lines.forEach((line, i) => parts.push(`<text x="${X(cx)}" y="${Y(cy) + (i - (lines.length - 1) / 2) * 14}" font-size="12" text-anchor="middle" dominant-baseline="central">${esc(line)}</text>`));
    }
  }
  for (const e of m.entrances) {
    // An arrow into the map from the nearest edge, the name outside it.
    const [dx, dy] = e.y >= m.grid.rows ? [0, -1] : e.y <= 0 ? [0, 1] : e.x <= 0 ? [1, 0] : e.x >= m.grid.cols ? [-1, 0] : [0, -1];
    const px = X(e.x), py = Y(e.y);
    const tip = `${px + dx * 8} ${py + dy * 8}`;
    const base = (side: number) => `${px - dx * 6 + dy * side * 7} ${py - dy * 6 + dx * side * 7}`;
    parts.push(`<path d="M${base(1)} L${tip} L${base(-1)} Z" fill="currentColor"/>`
      // On the north or south edge the name is outside the map; on the west or east edge, above the arrow inside it.
      + (dx === 0
        ? `<text x="${px}" y="${py - dy * 18 + (dy < 0 ? 0 : -4)}" font-size="11" text-anchor="middle">${esc(e.label)}</text>`
        : `<text x="${px + dx * 4}" y="${py - 12}" font-size="11" text-anchor="${dx > 0 ? 'start' : 'end'}">${esc(e.label)}</text>`));
  }
  if (m.youAreHere) {
    const {x, y} = m.youAreHere;
    parts.push(`<circle cx="${X(x)}" cy="${Y(y)}" r="6" fill="currentColor"/><text x="${X(x) + 10}" y="${Y(y) - 8}" font-size="11">You are here</text>`);
  }
  parts.push(`<g transform="translate(${W - PAD - 6} ${TOP - 26})"><path d="M0 -10 L6 6 L0 2 L-6 6 Z" fill="currentColor"/><text x="0" y="18" font-size="11" font-weight="600" text-anchor="middle">N</text></g>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(m.title)}" font-family="system-ui, sans-serif" fill="currentColor">`
    + `<title>${esc(m.title)}</title><text x="${PAD}" y="24" font-size="15" font-weight="600">${esc(m.title)}</text>${parts.join('')}</svg>`;
}

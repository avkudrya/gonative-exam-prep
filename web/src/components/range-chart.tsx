type Point = {label: string; range: {low: number; high: number} | null};

/**
 * Approximate ranges over time as vertical bars (ADR-003: a range is never drawn as a point).
 * Band axis 3–9: the product's floor band is 3 (P1.1), the IELTS maximum is 9.
 */
export function RangeChart({points, label}: {points: Point[]; label: string}) {
  const min = 3;
  const max = 9;
  const step = 34;
  const width = Math.max(points.length, 2) * step + 28;
  const height = 132;
  const top = 8;
  const bottom = 22;
  const y = (band: number) => top + (max - Math.min(max, Math.max(min, band))) / (max - min) * (height - top - bottom);
  const x = (i: number) => 32 + i * step;
  return <svg className="range-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} preserveAspectRatio="xMinYMid meet">
    {[3, 5, 7, 9].map(b => <g key={b}>
      <line x1={22} x2={width} y1={y(b)} y2={y(b)} className="grid"/>
      <text x={0} y={y(b) + 4} className="axis">{b}</text>
    </g>)}
    {points.map((p, i) => <g key={i}>
      {p.range ? <rect x={x(i) - 6} y={y(p.range.high)} width={12} height={Math.max(3, y(p.range.low) - y(p.range.high))} rx={4} className={i === points.length - 1 ? 'bar last' : 'bar'}/>
        : <text x={x(i) - 4} y={y(6)} className="axis">–</text>}
      <text x={x(i)} y={height - 6} className="axis" textAnchor="middle">{i + 1}</text>
    </g>)}
  </svg>;
}

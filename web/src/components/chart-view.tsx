'use client';
import {chartTable, renderChartSvg, type ChartSpec} from '@gonative/exam-domain';
import {useTranslations} from 'next-intl';
import {useId, useState} from 'react';

/**
 * The visual of an Academic Task 1 task (P5.6), drawn by code from its data (exam-domain renderChartSvg, deterministic and
 * escaped). A table task is shown as a table; any chart can also be read as a table, for accessibility and for checking a
 * figure. The data is invented for practice.
 */
export function ChartView({spec, compact = false}: {spec: ChartSpec; compact?: boolean}) {
  const t = useTranslations('Chart');
  const [tables, setTables] = useState(false);
  const id = useId();
  const hasPicture = spec.charts.some(c => c.kind !== 'table');

  return <div className={`chart-view${compact ? ' compact' : ''}`}>
    {spec.charts.map((chart, i) => {
      const svg = renderChartSvg(chart);
      const table = chartTable(chart);
      return <figure key={i} className="chart">
        {svg && !compact ? <div className="chart-svg" dangerouslySetInnerHTML={{__html: svg}}/> : null}
        {svg && compact ? <div className="chart-svg" aria-hidden="true" dangerouslySetInnerHTML={{__html: svg}}/> : null}
        {/* In a list preview a table task shows its table too, smaller and hidden from screen readers like the picture. */}
        {((!svg || tables) && !compact || !svg && compact) && <div className="table-wrap" id={compact ? undefined : `${id}-t${i}`}
          aria-hidden={compact || undefined}>
          <table className="chart-table">
            <caption>{table.caption}</caption>
            <thead><tr>{table.head.map((h, k) => <th key={k} scope="col">{h}</th>)}</tr></thead>
            <tbody>{table.rows.map((row, r) => <tr key={r}>{row.map((cell, k) => k === 0
              ? <th key={k} scope="row">{cell}</th> : <td key={k}>{cell}</td>)}</tr>)}</tbody>
          </table>
        </div>}
      </figure>;
    })}
    {!compact && <div className="chart-actions">
      {hasPicture && <button type="button" className="text-button" aria-expanded={tables}
        aria-controls={spec.charts.map((_, i) => `${id}-t${i}`).join(' ')} onClick={() => setTables(v => !v)}>
        {tables ? t('hideTable') : t('showTable')}
      </button>}
      <span className="hint">{t('illustrative')}</span>
    </div>}
  </div>;
}

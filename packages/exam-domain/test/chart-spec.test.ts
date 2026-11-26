import assert from 'node:assert/strict';
import {test} from 'node:test';
import {chartFacts, chartTable, checkChart, checkChartSpec, formatNumber, niceTicks, renderChartSvg, type Chart} from '../src/index.js';

const line: Chart = {
  kind: 'line', title: 'Commuters by mode of transport in a city, 2000–2020',
  x: {label: 'Year', categories: ['2000', '2005', '2010', '2015', '2020']},
  y: {label: 'Commuters', unit: 'thousand'},
  series: [
    {name: 'Car', values: [420, 450, 430, 380, 300]},
    {name: 'Bus', values: [210, 230, 260, 300, 330]},
    {name: 'Bicycle', values: [40, 42, 41, 40, 41]},
  ],
};
const pie: Chart = {kind: 'pie', title: 'Household spending, 2020', slices: [
  {label: 'Housing', value: 34.5}, {label: 'Food', value: 22}, {label: 'Transport', value: 15.5}, {label: 'Leisure', value: 12}, {label: 'Other', value: 16},
]};
const table: Chart = {kind: 'table', title: 'Visitors to three museums', unit: 'thousand', columns: ['2018', '2019', '2020'],
  rows: [{label: 'Science', values: [120, 135, 60]}, {label: 'History', values: [90, 95, 70]}, {label: 'Art', values: [150, 140, 50]}]};

test('a well-formed chart has no problems; a broken one says what is wrong', () => {
  for (const c of [line, pie, table]) assert.deepEqual(checkChart(c), []);
  assert.deepEqual(checkChart({...line, series: [{name: 'Car', values: [1, 2]}, {name: 'car', values: [1.25, 2, 3, 4, 5]}]}), [
    'series: duplicate name car', 'series[0]: 2 values for 5 categories', 'series[1][0]: more than 1 decimal']);
  assert.deepEqual(checkChart({...pie, slices: [{label: 'A', value: 60}, {label: 'B', value: 30}]} as Chart), ['slices: shares add up to 90, not 100']);
  assert.deepEqual(checkChart({...line, kind: 'bar', series: [{name: 'Loss', values: [1, -2, 3, 4, 5]}]} as Chart), ['series[0][1]: negative']);
  assert.deepEqual(checkChartSpec({format: 'chart-spec/1', charts: [line], data: 'real'}).length, 1, 'library data is always marked illustrative');
  assert.deepEqual(checkChartSpec({format: 'chart-spec/1', charts: [line, pie], data: 'illustrative'}), []);
});

test('the facts are computed from the data: trends, peaks, ranking, the largest changes and crossings', () => {
  const facts = chartFacts(line).map(f => f.text);
  assert.ok(facts.includes('Car fell from 420 thousand in 2000 to 300 thousand in 2020 (-28.6%).'), facts.join('\n'));
  assert.ok(facts.includes('Bus rose from 210 thousand in 2000 to 330 thousand in 2020 (+57.1%).'));
  assert.ok(facts.includes('Bicycle stayed about the same from 40 thousand in 2000 to 41 thousand in 2020 (+2.5%).'));
  assert.ok(facts.includes('Car was highest in 2005 (450 thousand) and lowest in 2020 (300 thousand).'));
  assert.ok(facts.includes('In 2000 the highest was Car; in 2020 it was Bus.'));
  assert.ok(facts.includes('The largest increase was in Bus (+120 thousand).'));
  assert.ok(facts.includes('The largest decrease was in Car (−120 thousand).'));
  assert.ok(facts.includes('Car and Bus changed places between 2015 and 2020.'));
  assert.deepEqual(chartFacts(pie).map(f => f.text).slice(0, 2), ['The largest share was Housing (34.5%).', 'The smallest share was Leisure (12%).']);
  assert.ok(chartFacts(pie).some(f => f.text === 'Housing and Food together made up 56.5%.'));
  assert.ok(chartFacts(table).some(f => f.text === '2020: highest History (70 thousand), lowest Art (50 thousand).'));
});

test('the table view carries exactly the data', () => {
  assert.deepEqual(chartTable(line), {caption: 'Commuters by mode of transport in a city, 2000–2020 (thousand)', head: ['', '2000', '2005', '2010', '2015', '2020'],
    rows: [['Car', '420', '450', '430', '380', '300'], ['Bus', '210', '230', '260', '300', '330'], ['Bicycle', '40', '42', '41', '40', '41']]});
  assert.deepEqual(chartTable(pie).rows[0], ['Housing', '34.5%']);
  assert.equal(formatNumber(12500), '12,500');
});

test('ticks are round and cover the data', () => {
  assert.deepEqual(niceTicks(40, 450), [0, 100, 200, 300, 400, 500]);
  assert.deepEqual(niceTicks(0, 7), [0, 2, 4, 6, 8]);
  assert.deepEqual(niceTicks(-12, 30), [-20, -10, 0, 10, 20, 30]);
});

test('the SVG is deterministic, escapes text and has no table form', () => {
  const svg = renderChartSvg(line)!;
  assert.equal(svg, renderChartSvg(structuredClone(line)));
  assert.match(svg, /^<svg [^>]*role="img" aria-label="Commuters by mode/);
  assert.equal((svg.match(/<polyline /g) ?? []).length, 3);
  assert.ok(svg.includes('>Bicycle</text>') && svg.includes('>2020</text>') && svg.includes('>Commuters (thousand)</text>'));
  assert.equal((renderChartSvg({...line, kind: 'bar'} as Chart)!.match(/<rect /g) ?? []).length, 15 + 3, '15 bars and 3 legend keys');
  assert.equal((renderChartSvg(pie)!.match(/<path d="M320 /g) ?? []).length, 5);
  const evil = renderChartSvg({...line, title: '<script>alert(1)</script> & "x"'} as Chart)!;
  assert.ok(!evil.includes('<script>') && evil.includes('&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;x&quot;'));
  assert.equal(renderChartSvg(table), null);
});

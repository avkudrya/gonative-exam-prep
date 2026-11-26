import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';
import {chartFacts, checkNumbers, type ChartSpec} from '../src/index.js';

const spec: ChartSpec = {format: 'chart-spec/1', data: 'illustrative', charts: [{
  kind: 'line', title: 'Commuters by mode of transport, 2000–2020', x: {label: 'Year', categories: ['2000', '2005', '2010', '2015', '2020']},
  y: {label: 'Commuters', unit: 'thousand'},
  series: [{name: 'Car', values: [420, 450, 430, 380, 300]}, {name: 'Bus', values: [210, 230, 260, 300, 330]}, {name: 'Bicycle', values: [40, 42, 41, 40, 41]}],
}]};
const pie: ChartSpec = {format: 'chart-spec/1', data: 'illustrative', charts: [{kind: 'pie', title: 'Spending', slices: [
  {label: 'Housing', value: 34.5}, {label: 'Food', value: 22}, {label: 'Transport', value: 15.5}, {label: 'Leisure', value: 12}, {label: 'Other', value: 16}]}]};
const status = (text: string, s: ChartSpec = spec) => checkNumbers(text, s).map(m => `${m.text}:${m.status}`);

test('figures that match the data, its units, differences, sums and changes are matched; years and counts are not figures', () => {
  assert.deepEqual(status('In 2000, 420,000 people drove, while 210 thousand took the bus.'), ['2000:year', '420,000:matched', '210 thousand:matched']);
  assert.deepEqual(status('Car use fell by 120,000 between 2010 and 2020, a drop of about 29%.'), ['120,000:matched', '2010:year', '2020:year', '29%:matched']);
  assert.deepEqual(status('Bus passengers rose from 210 to 330 thousand, an increase of roughly 57 per cent.'), ['210:matched', '330 thousand:matched', '57 per cent:matched']);
  assert.deepEqual(status('Of the three modes, cycling stayed at around 40 thousand.'), ['40 thousand:matched']);
  assert.deepEqual(status('Over the 5 periods shown, three modes are compared.'), ['5:count']);
  assert.deepEqual(status('Housing took 34.5% and food 22%, together over half (56.5%).', pie), ['34.5%:matched', '22%:matched', '56.5%:matched']);
  assert.deepEqual(status('Housing accounted for just over a third, at 35%.', pie), ['35%:matched']);
});

test('a figure the data does not support is unmatched, with the closest supported value', () => {
  const misread = checkNumbers('Car commuters peaked at 590,000 in 2005.', spec);
  assert.deepEqual(misread.map(m => [m.text, m.status]), [['590,000', 'unmatched'], ['2005', 'year']]);
  assert.ok(misread[0].nearest !== undefined && misread[0].nearest !== 590000);
  assert.deepEqual(status('By 2020, roughly 900 thousand people drove to work.'), ['2020:year', '900 thousand:unmatched']);
  assert.deepEqual(status('By 2020, roughly 600 thousand people together drove or took the bus.'), ['2020:year', '600 thousand:matched'], 'within 10 % of 300 + 330 with approximate wording');
  assert.deepEqual(status('Food made up 28% of spending.', pie), ['28%:unmatched'], 'a value of food (22%); 28 = 12 + 16 is a sum only with words that make it one');
  assert.deepEqual(status('Leisure and other made up 28% together.', pie), ['28%:matched']);
  assert.deepEqual(status('Food made up 41% of spending.', pie), ['41%:unmatched']);
});

const ages: ChartSpec = {format: 'chart-spec/1', data: 'illustrative', charts: [{kind: 'bar', title: 'Leisure', x: {label: 'Age group', categories: ['16–24', '25–44', '45–64', '65+']},
  y: {label: 'Hours per week', unit: ''}, series: [{name: 'Sport', values: [6, 4, 3, 2]}, {name: 'Reading', values: [2, 2.5, 3.5, 6]}]}]};
const pies: ChartSpec = {format: 'chart-spec/1', data: 'illustrative', charts: [
  {kind: 'pie', title: '2000', slices: [{label: 'Coal', value: 52}, {label: 'Gas', value: 24}, {label: 'Nuclear', value: 18}, {label: 'Renewables', value: 6}]},
  {kind: 'pie', title: '2020', slices: [{label: 'Coal', value: 18}, {label: 'Gas', value: 34}, {label: 'Nuclear', value: 16}, {label: 'Renewables', value: 32}]}]};

test('the words around a figure decide what it may be: a value, a difference or sum, a change, a ratio', () => {
  assert.deepEqual(status('The figure fell to 120 thousand in 2020.'), ['120 thousand:unmatched', '2020:year'],
    '120 is a difference (420 − 300), but nothing here makes it one');
  assert.deepEqual(status('Car use fell to 300 thousand, a decrease of 120 thousand.'), ['300 thousand:matched', '120 thousand:matched']);
  assert.deepEqual(status('Bus use rose to 330 thousand in 2015.'), ['330 thousand:unmatched', '2015:year'], 'bound to 2015, where no value is 330');
  assert.deepEqual(status('Car was highest in 2005 (450 thousand) and lowest in 2020 (300 thousand).'), ['2005:year', '450 thousand:matched', '2020:year', '300 thousand:matched']);
  assert.deepEqual(status('Bus rose from 210 thousand in 2000 to 330 thousand in 2020 (+57.1%).'), ['210 thousand:matched', '2000:year', '330 thousand:matched', '2020:year', '57.1%:matched']);
  assert.deepEqual(status('Car use was 2.1 times the bus figure in 2000.'), ['2.1:unmatched', '2000:year'], 'ratios only from the data: 420 / 210 = 2');
  assert.deepEqual(status('Car use was 2 times the bus figure in 2000.'), ['2:count', '2000:year']);
  assert.deepEqual(status('Taken together, these three smaller categories made up 43.5%.', pie), ['43.5%:matched']);
  assert.deepEqual(status('Coal fell from 52% to 18%, a drop of 34 percentage points.', pies), ['52%:matched', '18%:matched', '34:matched']);
});

test('numbers of labels are not figures', () => {
  assert.deepEqual(status('Sport fell to 4 hours for the 25–44 group and 2 hours among those aged 65 and over.', ages),
    ['4:matched', '25:label', '44:label', '2:matched', '65:label']);
  assert.deepEqual(status('Reading rose to 3.5 hours for the 45–64 group.', ages), ['3.5:matched', '45:label', '64:label']);
  assert.deepEqual(status('Reading rose to 6 hours for the 45–64 group.', ages), ['6:unmatched', '45:label', '64:label'], 'bound to 45–64: 3 and 3.5');
});

test('the facts the code computes for every library task are matched', () => {
  const root = fileURLToPath(new URL('../../../', import.meta.url));
  const library = JSON.parse(readFileSync(root + 'packages/exam-domain/library/ielts-writing-task-1-academic.v1.json', 'utf8'));
  let figures = 0;
  for (const task of library.tasks) {
    for (const chart of task.stimulus.charts) {
      for (const fact of chartFacts(chart)) {
        const mentions = checkNumbers(fact.text, task.stimulus);
        assert.deepEqual(mentions.filter(m => m.status === 'unmatched').map(m => m.text), [], `${task.ref}: ${fact.text}`);
        figures += mentions.filter(m => m.status === 'matched').length;
      }
    }
  }
  assert.ok(figures > 250, `${figures} figures`);
});

test('spans are code points of the response', () => {
  const text = '— 420,000 drove.';
  const [m] = checkNumbers(text, spec);
  assert.equal(Array.from(text).slice(m.start, m.end).join(''), '420,000');
});

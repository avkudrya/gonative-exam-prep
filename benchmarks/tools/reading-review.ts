/**
 * P7.3: checks the Reading tests of a content round with exam-domain `checkReadingTest` and writes the owner's review file.
 *
 *   npm run bench:reading -- benchmarks/runs/exam-reading-pilot-1
 *
 * Reads <run>/report.json, <run>/tests/*.json and <run>/sections/*.json (written by MultiAdmin `exam:reading:pilot`);
 * writes <run>/checks.json (problems found by code, per test) and <run>/review.md (every test in full: passage, questions,
 * keys, evidence, explanations in en/ru/uk, and how the solvers answered). Exits 1 when a test has a problem.
 */
import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {checkReadingTest, countWords, readingEstimate, type ReadingGroup, type ReadingSection, type ReadingTest} from '../../packages/exam-domain/src/index.js';

const dir = resolve(process.argv[2] ?? '');
if (!existsSync(join(dir, 'report.json'))) {
  console.error('usage: npm run bench:reading -- <run directory with report.json>');
  process.exit(2);
}
type SectionRow = {key: string; status: string; costUsd: number; metrics: Record<string, unknown> | null; file: string | null};
const report = JSON.parse(readFileSync(join(dir, 'report.json'), 'utf8')) as {
  id: string; spentUsd: number; budgetUsd: number; sections: SectionRow[]; tests: {id: string; file: string}[];
  totals: {generated: number; disputedFirst: number; discarded: number; discardRate: number | null; controlAgreement: number | null; controlCorrect: number; controlMarks: number};
};
const read = (file: string) => JSON.parse(readFileSync(join(dir, file), 'utf8'));

const checks: Record<string, string[]> = {};
const out: string[] = [];
const pct = (x: number | null) => (x === null ? '—' : `${(100 * x).toFixed(1)} %`);
out.push(`# ${report.id}: вычитка владельцем`, '');
out.push('Сгенерировано командой `exam:reading:pilot`, проверено `checkReadingTest`. Файл для вычитки: ключ, доказательство и объяснение каждого вопроса; ошибки ключа отмечайте номером вопроса.', '');
out.push('| Секция | Статус | Стоимость | Вопросов создано | Спорных сначала | Отброшено | Контролёр |', '|---|---|---|---|---|---|---|');
for (const s of report.sections) {
  const m = (s.metrics ?? {}) as {generated?: number; disputedFirst?: number; discarded?: number; control?: {correct: number; marks: number}};
  out.push(`| ${s.key} | ${s.status} | $${s.costUsd.toFixed(4)} | ${m.generated ?? '—'} | ${m.disputedFirst ?? '—'} | ${m.discarded ?? '—'} | ${m.control ? `${m.control.correct}/${m.control.marks}` : '—'} |`);
}
const t = report.totals;
out.push('', `Итого: $${report.spentUsd.toFixed(4)} из $${report.budgetUsd}; отброшено ${t.discarded} из ${t.generated} (${pct(t.discardRate)}, порог ≤ 20 %); контролёр ${t.controlCorrect}/${t.controlMarks} (${pct(t.controlAgreement)}, порог ≥ 97 %).`, '');

const answerText = (group: ReadingGroup, answer: string[]) => {
  const options = group.type === 'true_false_not_given' ? {T: 'TRUE', F: 'FALSE', NG: 'NOT GIVEN'} as Record<string, string>
    : group.type === 'yes_no_not_given' ? {Y: 'YES', N: 'NO', NG: 'NOT GIVEN'} as Record<string, string>
    : Object.fromEntries((group.options ?? []).map(o => [o.id, `${o.id} (${o.text})`]));
  return answer.map(a => options[a] ?? a).join(' / ');
};

for (const entry of report.tests) {
  const test = read(entry.file) as ReadingTest;
  const problems = checkReadingTest(test);
  checks[test.id] = problems;
  const words = test.sections.reduce((n, s) => n + countWords(s.text), 0);
  out.push(`## Тест ${test.id}`, '', `Проверка кодом: ${problems.length ? problems.map(p => `**${p}**`).join('; ') : 'без замечаний'}. Слов в текстах: ${words}. Полоса при 30/40: ${JSON.stringify(readingEstimate(30, test.exam))}.`, '');
  for (const [si, plain] of test.sections.entries()) {
    const section = plain as ReadingSection & {meta?: {plan: string}};
    const log = section.meta ? read(`sections/${section.meta.plan.replace('|', '-')}.json`) : null;
    const byNumber: Record<number, string> = log ? Object.fromEntries(Object.entries(log.questionIds as Record<string, string>).map(([n, id]) => [Number(n), id])) : {};
    out.push(`### Секция ${si + 1}: ${section.title}`, '', section.text.split('\n\n').slice(1).join('\n\n'), '');
    let offset = Infinity;
    for (const g of section.groups) for (const q of g.questions) offset = Math.min(offset, q.numbers[0]);
    for (const group of section.groups) {
      out.push(`#### ${group.type}: ${group.instruction}`, '');
      if (group.options?.length && group.type !== 'multiple_choice' && group.type !== 'multiple_choice_multi') out.push(group.options.map(o => `- **${o.id}** ${o.text}`).join('\n'), '');
      for (const q of group.questions) {
        const id = byNumber[q.numbers[0] - offset + 1];
        const solved = id && log ? [log.solve?.a?.[id], log.solve?.b?.[id], log.control?.[id]] : [];
        const how = solved.length ? ['Sonnet', 'GPT-5.4', 'Grok'].map((name, i) => `${name}: ${solved[i] ? `${(solved[i].answer as string[]).join(', ') || '—'}${solved[i].correct ? ' ✓' : ' ✗'}` : '—'}`).join('; ') : '';
        const revised = id && log?.revise?.[id] ? ` Пересмотр: ${log.revise[id].action} — ${log.revise[id].reason}` : '';
        out.push(`**${q.numbers.join('–')}.** ${q.prompt}`);
        if (group.type === 'multiple_choice' || group.type === 'multiple_choice_multi') out.push('', (group.options ?? []).map(o => `- ${o.id}. ${o.text}`).join('\n'));
        out.push('', `- Ключ: **${answerText(group, q.answer)}**`, `- Доказательство: ${q.evidence ? `«${q.evidence}»` : '— (NOT GIVEN)'}`,
          `- en: ${q.explanation.en}`, `- ru: ${q.explanation.ru ?? '—'}`, `- uk: ${q.explanation.uk ?? '—'}`);
        if (how || revised) out.push(`- Решатели (первый проход) и контролёр: ${how}.${revised}`);
        out.push('');
      }
    }
  }
}
writeFileSync(join(dir, 'checks.json'), `${JSON.stringify(checks, null, 2)}\n`);
writeFileSync(join(dir, 'review.md'), `${out.join('\n')}\n`);
const failing = Object.entries(checks).filter(([, p]) => p.length);
console.log(`${report.tests.length} tests checked; ${failing.length ? `problems in ${failing.map(([id]) => id).join(', ')}` : 'no problems'}; review: ${join(dir, 'review.md')}`);
process.exit(failing.length ? 1 : 0);

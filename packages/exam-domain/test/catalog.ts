import {readdirSync, readFileSync} from 'node:fs';
import {exam, examProvider, type Exam, type ExamProvider} from '../src/index.js';

const dir = new URL('../catalog/', import.meta.url);

/** Every catalog file, parsed through the contract (throws on the first invalid one). */
export function loadCatalog(): {file: string; provider: ExamProvider; exam: Exam}[] {
  return readdirSync(dir).filter(f => f.endsWith('.json')).sort().map(file => {
    const raw = JSON.parse(readFileSync(new URL(file, dir), 'utf8'));
    return {file, provider: examProvider.parse(raw.provider), exam: exam.parse(raw.exam)};
  });
}

export function catalogExam(key: string): Exam {
  const entry = loadCatalog().find(e => e.exam.key === key);
  if (!entry) throw new Error(`no catalog exam ${key}`);
  return entry.exam;
}

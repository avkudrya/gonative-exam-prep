#!/usr/bin/env python3
"""P4.14 measurement metrics (docs/phase-4/P4.14-rewrite-check.md §3): accuracy per class, false 'correct' (the learner leaves with a
mistake), explanation language and length, cost and tokens per check. Thresholds: false 'correct' <= 5 %, accuracy >= 90 %, language 100 %.

usage: python3 -I benchmarks/rewrite-check/metrics.py      (after run-batch.ts fetch haiku / sonnet with XE_WAVE=rw1)
out:   docs/phase-4/rw1/report.json
"""
import collections, json, re
from pathlib import Path

cases = {f"{c['id']}": c for c in map(json.loads, Path('benchmarks/datasets/exam-rewrite-v1/items.jsonl').read_text().splitlines())}
CYR, RU_ONLY, UK_ONLY = re.compile(r'[А-Яа-яЁёІіЇїЄєҐґ]'), re.compile(r'[ЫыЭэЪъЁё]'), re.compile(r'[ІіЇїЄєҐґ]')

def language_ok(text, lang):
    if lang == 'en':
        return not CYR.search(text)
    if not CYR.search(text):
        return False
    return not RU_ONLY.search(text) if lang == 'uk' else not UK_ONLY.search(text)

report = {}
for step in ('haiku', 'sonnet'):
    path = Path(f'tmp/rw1/{step}-results.jsonl')
    if not path.exists():
        continue
    costs = json.loads(Path(f'docs/phase-4/rw1/{step}-costs.json').read_text())
    confusion, wrong, issues, lang_bad, long_, quote_missing = collections.defaultdict(collections.Counter), [], [], [], [], []
    for line in path.read_text().splitlines():
        r = json.loads(line)
        cid = r['custom_id'].split('-', 2)[2]
        c = cases[cid]
        if r['result']['type'] != 'succeeded' or r['result']['message']['stop_reason'] != 'end_turn':
            issues.append(cid)
            continue
        out = json.loads(next(b['text'] for b in r['result']['message']['content'] if b['type'] == 'text'))
        confusion[c['expected']][out['verdict']] += 1
        if out['verdict'] != c['expected']:
            wrong.append({'id': cid, 'expected': c['expected'], 'got': out['verdict'], 'alternative': c.get('alternative', False), 'explanation': out['explanation']})
        if not language_ok(out['explanation'], c['language']):
            lang_bad.append(cid)
        if len(out['explanation']) > 200:
            long_.append(cid)
        if out['verdict'] == 'new_error' and not out['new_error_quote'].strip():
            quote_missing.append(cid)
    n = sum(sum(v.values()) for v in confusion.values())
    right = sum(confusion[k][k] for k in confusion)
    not_correct = sum(sum(v.values()) for k, v in confusion.items() if k != 'correct')
    false_correct = sum(v['correct'] for k, v in confusion.items() if k != 'correct')
    correct_rejected = sum(v for k, v in confusion['correct'].items() if k != 'correct')
    report[step] = {
        'checks': n, 'request_issues': issues, 'accuracy': round(right / max(1, n), 3),
        'per_class': {k: round(confusion[k][k] / max(1, sum(confusion[k].values())), 3) for k in ('correct', 'error_remains', 'new_error')},
        'false_correct_rate': round(false_correct / max(1, not_correct), 3), 'false_correct': false_correct,
        'correct_rejected': correct_rejected, 'alternative_correct_accepted': sum(1 for c in cases.values() if c.get('alternative')) - sum(1 for w in wrong if w['alternative']),
        'confusion': {k: dict(v) for k, v in confusion.items()},
        'language_wrong': lang_bad, 'explanation_over_200': long_, 'new_error_without_quote': quote_missing,
        'usd': costs['actual_usd'], 'usd_per_check_batches': round(costs['actual_usd'] / max(1, n), 6),
        'tokens_per_check': {'input': round(costs['input'] / max(1, n)), 'output': round(costs['output'] / max(1, n))},
        'passes': false_correct / max(1, not_correct) <= 0.05 and right / max(1, n) >= 0.90 and not lang_bad,
        'wrong': wrong,
    }
Path('docs/phase-4/rw1/report.json').write_text(json.dumps(report, ensure_ascii=False, indent=1) + '\n')
print(json.dumps({k: {x: v[x] for x in ('accuracy', 'per_class', 'false_correct_rate', 'correct_rejected', 'alternative_correct_accepted', 'language_wrong',
                                        'explanation_over_200', 'usd', 'tokens_per_check', 'passes')} for k, v in report.items()}, ensure_ascii=False, indent=1))

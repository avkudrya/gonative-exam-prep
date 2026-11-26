#!/usr/bin/env python3
"""XE-4 (docs/phase-4/P4.12-xe4-explanations.md): the final explanation of every XE-4 item.

- `keep`: the current texts stay (they get a new review bound to the new spec);
- `fix`: Opus's texts; Russian is the teacher's text whenever Opus confirmed it;
- `reject`: no explanation (it stays hidden); listed for WG with the reason;
- an item Opus returned nothing for stays hidden and is listed for a later run;
- answers the checker misses go to WG, after scripts/xe2/classify-missing.php (tmp/xe4/missing-classified.json) if it ran.

usage: python3 -I scripts/xe4/merge-final.py
out:   tmp/xe4/final.json (bank content, not in Git), docs/phase-4/xe4/wg-handoff.json (ids, reasons; no texts)
"""
import collections, json
from pathlib import Path

out = Path('tmp/xe4')
items = {i['id']: i for i in json.loads((out / 'after-items.json').read_text())['items']}
rows = lambda i: items[i]['explanations'] or {}
TEACHER = {i: rows(i)['ru']['text'] for i in items if rows(i).get('ru', {}).get('provenance') == 'imported:mnemonic'}
checked = json.loads((out / 'opus-checked.json').read_text())
opus = {r['id']: r for r in checked['items']}
stats = collections.Counter()
missing_answers = checked['accepted_missing']
classified = out / 'missing-classified.json'
if classified.exists():  # scripts/xe2/classify-missing.php: answers the checker already accepts are not WG's work
    c = json.loads(classified.read_text())
    stats['missing: already accepted by the checker'] = len(c['already_accepted'])
    stats['missing: closed item (not an answer to add)'] = len(c['closed_item'])
    missing_answers = [{'id': m['id'], 'missing': m['missing']} for m in c['to_add']]

final, rejected, unreviewed = [], [], []
for item_id, item in sorted(items.items()):
    base = {'id': item_id, 'topic': item['topic'], 'type': item['type'], 'cefr': item['cefr']}
    o = opus.get(item_id)
    if not o:
        unreviewed.append(base)
        stats['not returned by Opus (later)'] += 1
        continue
    if o['action'] == 'reject':
        rejected.append({**base, 'reason': o['key_reason']})
        stats['rejected'] += 1
        continue
    if o['action'] == 'keep':
        current = rows(item_id)
        assert set(current) == {'en', 'ru', 'uk'}, item_id
        texts = {k: current[k]['text'] for k in ('en', 'ru', 'uk')}
    else:
        texts = {k: o[k].strip() for k in ('en', 'ru', 'uk')}
    stats[f"opus {o['action']}"] += 1
    teacher = TEACHER.get(item_id)
    ru_source = 'model'
    if teacher and o['teacher_ru_ok'] == 'ok':
        texts['ru'], ru_source = teacher, 'teacher'
        stats['ru from teacher'] += 1
    elif teacher:
        stats['teacher replaced'] += 1
    for lang in ('en', 'ru', 'uk'):
        if not texts[lang].strip():
            raise SystemExit(f'empty {lang} for {item_id}')
    final.append({**base, 'action': o['action'], 'ru_source': ru_source, **texts})

(out / 'final.json').write_text(json.dumps({'format': 'xe4-final/1', 'items': final}, ensure_ascii=False, indent=1))
Path('docs/phase-4/xe4/wg-handoff.json').write_text(json.dumps({
    'format': 'xe4-wg-handoff/1', 'note': 'XE-4: items whose key Opus found wrong under the new spec (no explanation shown) and answers the '
    'checker misses, among the items of the two topics rv1 revised and the three items rv1 edited. Bank repairs or retirement are WG decisions.',
    'rejected': rejected, 'accepted_missing': missing_answers, 'not_reviewed_yet': unreviewed}, ensure_ascii=False, indent=1) + '\n')
print(json.dumps({'items': len(items), 'explained': len(final), **dict(sorted(stats.items())), 'accepted_missing': len(missing_answers)}, indent=1))

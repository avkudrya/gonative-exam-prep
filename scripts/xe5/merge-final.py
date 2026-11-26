#!/usr/bin/env python3
"""XE-5 (docs/phase-4/P4.13-xe5-explanations.md): the final explanation of every XE-5 item.

- `write`: Opus's texts;
- `reject`: no explanation; listed for WG with the reason;
- an item Opus returned nothing for gets no explanation now and is listed for a later run;
- answers the checker misses go to WG, after scripts/xe2/classify-missing.php (tmp/xe5/missing-classified.json) if it ran.

usage: python3 -I scripts/xe5/merge-final.py
out:   tmp/xe5/final.json (bank content, not in Git), docs/phase-4/xe5/wg-handoff.json (ids, reasons; no texts)
"""
import collections, json
from pathlib import Path

out = Path('tmp/xe5')
items = {i['id']: i for i in json.loads((out / 'items.json').read_text())['items']}
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
    texts = {k: o[k].strip() for k in ('en', 'ru', 'uk')}
    stats[f"opus {o['action']}"] += 1
    for lang in ('en', 'ru', 'uk'):
        if not texts[lang].strip():
            raise SystemExit(f'empty {lang} for {item_id}')
    final.append({**base, 'action': o['action'], 'ru_source': 'model', **texts})

(out / 'final.json').write_text(json.dumps({'format': 'xe5-final/1', 'items': final}, ensure_ascii=False, indent=1))
Path('docs/phase-4/xe5/wg-handoff.json').write_text(json.dumps({
    'format': 'xe5-wg-handoff/1', 'note': 'XE-5: items whose key Opus found wrong (no explanation shown), doubts it noted, and answers the '
    'checker misses, among the 74 sentence-punctuation items of bank-ai/pb1. Bank repairs or retirement are WG decisions.',
    'doubts': [{'id': r['id'], 'problem': r['problem']} for r in checked['items'] if r['action'] == 'write' and r['problem'].strip()],
    'rejected': rejected, 'accepted_missing': missing_answers, 'not_reviewed_yet': unreviewed}, ensure_ascii=False, indent=1) + '\n')
print(json.dumps({'items': len(items), 'explained': len(final), **dict(sorted(stats.items())), 'accepted_missing': len(missing_answers)}, indent=1))

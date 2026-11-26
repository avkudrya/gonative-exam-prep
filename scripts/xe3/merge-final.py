#!/usr/bin/env python3
"""XE-3.3 (docs/phase-4/P4.11-xe3-explanations.md): the final explanation of every XE-3 item, by XE-2's rules.

- Opus reviewed every item (XE-3.2): `reject` (no explanation; listed for WG), `keep` (Haiku's texts), `fix` (Opus's texts);
  an item Opus returned nothing for gets no explanation now and is listed for a later run;
- Russian: the teacher's text whenever Opus confirmed it, otherwise the model's text;
- #422 (scope.json typo_fix): no AI; the bank's en / uk stay, the teacher's ru gets its typo corrected;
- answers the checker misses go to WG, after scripts/xe2/classify-missing.php (tmp/xe3/missing-classified.json) if it ran.

usage: python3 -I scripts/xe3/merge-final.py
out:   tmp/xe3/final.json (bank content, not in Git), docs/phase-4/xe3/wg-handoff.json (ids, reasons; no texts)
"""
import collections, json
from pathlib import Path

out = Path('tmp/xe3')
scope = json.loads(Path('docs/phase-4/xe3/scope.json').read_text())
typo = {t['id'] for t in scope['typo_fix']}
items = {i['id']: i for i in json.loads((out / 'items.json').read_text())['items']}
inventory = {r['id']: r for r in json.loads((out / 'inventory.json').read_text())['items']}
rows = lambda i: items[i]['explanations'] or {}
TEACHER = {i: rows(i)['ru']['text'] for i in items if rows(i).get('ru', {}).get('provenance') == 'imported:mnemonic'}
haiku = {r['id']: r for r in json.loads((out / 'haiku-checked.json').read_text())['items']}
opus_data = json.loads((out / 'opus-checked.json').read_text())
opus = {r['id']: r for r in opus_data['items']}
missing_answers = opus_data['accepted_missing']
stats = collections.Counter()
classified = out / 'missing-classified.json'
if classified.exists():
    c = json.loads(classified.read_text())
    stats['missing: already accepted by the checker'] = len(c['already_accepted'])
    stats['missing: closed item (not an answer to add)'] = len(c['closed_item'])
    missing_answers = [{'id': m['id'], 'missing': m['missing']} for m in c['to_add']]

final, rejected, unreviewed = [], [], []
for item_id, inv in sorted(inventory.items()):
    base = {'id': item_id, 'topic': inv['topic'], 'type': inv['type'], 'cefr': inv['cefr']}
    if item_id in typo:
        ru = TEACHER[item_id]
        fixed = ru.replace('Артикль ни используется', 'Артикль не используется')
        assert fixed != ru and fixed.count('не используется') == 1, item_id
        final.append({**base, 'source': 'typo_fix', 'ru_source': 'teacher_fix', 'teacher_replaced': False,
                      'en': rows(item_id)['en']['text'], 'ru': fixed, 'uk': rows(item_id)['uk']['text']})
        stats['typo fix (no AI)'] += 1
        continue
    o, h = opus.get(item_id), haiku.get(item_id)
    if not o:
        unreviewed.append({**base, 'haiku_verdict': h['verdict'] if h else None})
        stats['not reviewed by Opus (later)'] += 1
        continue
    if o['action'] == 'reject':
        rejected.append({**base, 'by': 'opus', 'reason': o['key_reason']})
        stats['rejected (opus)'] += 1
        continue
    texts = {k: o[k] for k in ('en', 'ru', 'uk')} if o['action'] == 'fix' else {k: h[k] for k in ('en', 'ru', 'uk')}
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
    final.append({**base, 'source': 'opus', 'ru_source': ru_source, 'teacher_replaced': bool(teacher and ru_source != 'teacher'),
                  **{k: v.strip() for k, v in texts.items()}})

(out / 'final.json').write_text(json.dumps({'format': 'xe3-final/1', 'items': final}, ensure_ascii=False, indent=1))
Path('docs/phase-4/xe3/wg-handoff.json').write_text(json.dumps({
    'format': 'xe3-wg-handoff/1', 'note': 'XE-3: items without an explanation (key wrong or several correct answers) and answers the '
    'checker misses, among the items WG repaired and the XE-1 items whose gap may stay empty. Bank repairs or retirement are WG decisions.',
    'rejected': rejected, 'accepted_missing': missing_answers, 'not_reviewed_yet': unreviewed}, ensure_ascii=False, indent=1) + '\n')
print(json.dumps({'items': len(inventory), 'explained': len(final), **dict(sorted(stats.items())), 'accepted_missing': len(missing_answers)}, indent=1))

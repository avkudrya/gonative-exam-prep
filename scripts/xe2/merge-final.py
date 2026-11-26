#!/usr/bin/env python3
"""XE-2.3 (docs/phase-4/P4.10-xe2-explanations.md): the final explanation of every wave-2 item (XE-1's rules).

Rules (owner's decisions §2 and §7):
- an item Opus reviewed: its action decides — `reject` (no explanation), `keep` (Haiku's texts), `fix` (Opus's texts);
- any other item: Haiku's texts (the clean results Opus did not sample);
- Russian: the teacher's text whenever the last reviewer confirmed it (Opus if it reviewed the item, else Haiku), otherwise the
  model's text;
- rejected items and answers the checker misses go to WG as a list (bank repairs are WG's decision).

usage: python3 -I scripts/xe2/merge-final.py tmp/xe2
out:   tmp/xe2/final.json (bank content, not in Git), docs/phase-4/xe2/wg-handoff.json (ids, reasons; no texts)
"""
import collections, json, sys
from pathlib import Path

out = Path(sys.argv[1])
inventory = {r['id']: r for r in json.loads((out / 'inventory.json').read_text())['items']}
# Teacher texts only: Mnemonic items may also carry an unreviewed AI ru draft from earlier on-demand runs.
TEACHER = {i['id']: i['explanations']['ru']['text'] for i in json.loads((out / 'items.json').read_text())['items']
           if (i.get('explanations') or {}).get('ru', {}).get('provenance') == 'imported:mnemonic'}
haiku = {r['id']: r for r in json.loads((out / 'haiku-checked.json').read_text())['items']}
# XE-2.2 (Opus on every item) and, if it ran, opus2 (the items Opus returned nothing for).
opus, missing_answers = {}, []
for name in ('opus-checked.json', 'opus2-checked.json'):
    if not (out / name).exists():
        continue
    data = json.loads((out / name).read_text())
    opus.update({r['id']: r for r in data['items']})
    missing_answers += data['accepted_missing']

final, rejected, unreviewed, stats = [], [], [], collections.Counter()
for item_id, inv in sorted(inventory.items()):
    teacher = TEACHER.get(item_id)
    o, h = opus.get(item_id), haiku.get(item_id)
    if o:
        source = 'opus'
        if o['action'] == 'reject':
            rejected.append({'id': item_id, 'topic': inv['topic'], 'type': inv['type'], 'by': 'opus', 'reason': o['key_reason']})
            stats['rejected (opus)'] += 1
            continue
        texts = {k: o[k] for k in ('en', 'ru', 'uk')} if o['action'] == 'fix' else {k: h[k] for k in ('en', 'ru', 'uk')}
        teacher_ok = o['teacher_ru_ok'] == 'ok'
        stats[f"opus {o['action']}"] += 1
    else:
        # Owner 2026-11-25: every explanation is checked by Opus. An item Opus skipped in both runs gets no explanation now and is
        # listed for a later small run.
        unreviewed.append({'id': item_id, 'topic': inv['topic'], 'type': inv['type'], 'haiku_verdict': h['verdict'] if h else None})
        stats['not reviewed by Opus (later)'] += 1
        continue
    ru_source = 'model'
    if teacher and teacher_ok:
        texts['ru'], ru_source = teacher, 'teacher'
        stats['ru from teacher'] += 1
    elif teacher:
        stats['teacher replaced'] += 1
    for lang in ('en', 'ru', 'uk'):
        if not texts[lang].strip():
            raise SystemExit(f'empty {lang} for {item_id} ({source})')
    final.append({'id': item_id, 'topic': inv['topic'], 'type': inv['type'], 'cefr': inv['cefr'], 'source': source, 'ru_source': ru_source,
                  'teacher_replaced': bool(teacher and not teacher_ok), **{k: v.strip() for k, v in texts.items()}})

(out / 'final.json').write_text(json.dumps({'format': 'xe2-final/1', 'items': final}, ensure_ascii=False, indent=1))
Path('docs/phase-4/xe2').mkdir(parents=True, exist_ok=True)
Path('docs/phase-4/xe2/wg-handoff.json').write_text(json.dumps({
    'format': 'xe2-wg-handoff/1', 'note': 'XE-2 wave 2: items without an explanation (key wrong or several correct answers) and answers the '
    'checker misses. Bank repairs or retirement are WG decisions.',
    'rejected': rejected, 'accepted_missing': missing_answers, 'not_reviewed_yet': unreviewed}, ensure_ascii=False, indent=1) + '\n')
print(json.dumps({'items': len(inventory), 'explained': len(final), **dict(sorted(stats.items())), 'accepted_missing': len(missing_answers),
                  'by source': dict(collections.Counter(f['source'] for f in final))}, indent=1))

#!/usr/bin/env python3
"""XE-3.4 (docs/phase-4/P4.11-xe3-explanations.md): the XE-3 bundle MultiAdmin applies (exam:apply-explanations --bundle=xe3,
ApplyExplanationsRevision). An item may already have rows: `before` pins each language's row text at export by SHA-256 (null: no row),
so nothing changed since is overwritten. `ru_mode`:
- `new`: no Russian row; it is inserted;
- `teacher_keep`: the teacher's Mnemonic text stays word for word (Opus confirmed it);
- `teacher_fix`: the teacher's text with a typo corrected (#422); it stays the teacher's;
- `replace`: an existing Russian row (an earlier AI text, or a teacher text Opus found wrong) is replaced.
en and uk rows are inserted or replaced in place.

usage: python3 -I scripts/xe3/build-bundle.py <MultiAdmin>/resources/data/edu/explanations-xe3.json
"""
import collections, hashlib, json, sys
from pathlib import Path

src, dest = Path('tmp/xe3'), Path(sys.argv[1])
items = {i['id']: i for i in json.loads((src / 'items.json').read_text())['items']}
topics = {t['slug']: t for t in json.loads((src / 'topics.json').read_text())['topics']}
final = json.loads((src / 'final.json').read_text())['items']
sha = lambda s: hashlib.sha256(s.encode()).hexdigest()

entries = []
for f in sorted(final, key=lambda x: x['id']):
    item = items[f['id']]
    existing = item['explanations'] or {}
    assert set(existing) <= {'en', 'ru', 'uk'}, f['id']
    for lang in ('en', 'uk'):
        assert lang not in existing or existing[lang]['provenance'] == 'ai_generated', (f['id'], lang)
    before = {lang: sha(existing[lang]['text']) if lang in existing else None for lang in ('en', 'ru', 'uk')}
    ru_row = existing.get('ru')
    if ru_row is None:
        mode = 'new'
    elif f['ru_source'] == 'teacher':
        assert ru_row['provenance'] == 'imported:mnemonic' and ru_row['text'].strip() == f['ru'], f['id']
        mode, f['ru'] = 'teacher_keep', ru_row['text']
    elif f['ru_source'] == 'teacher_fix':
        assert ru_row['provenance'] == 'imported:mnemonic' and ru_row['text'] != f['ru'], f['id']
        mode = 'teacher_fix'
    else:
        mode = 'replace'
    entries.append({'item_id': f['id'], 'content_hash': item['content_hash'], 'topic': item['topic'],
                    'spec_version': topics[item['topic']]['spec']['version'], 'before': before, 'ru_mode': mode,
                    'en': f['en'], 'ru': f['ru'], 'uk': f['uk']})

bundle = {'format': 'edu-explanations-xe3/v1', 'reason': 'explanations_xe3',
          'source': 'gonative-exam-prep docs/phase-4/P4.11-xe3-explanations.md: items worksheet-generator repaired (bank_repair_xe_v1) and '
                    'XE-1 items whose gap may stay empty; Haiku 5.5 review, Opus 5.5 review of every item; #422 teacher typo fixed without AI',
          'models': ['claude-haiku-5-5', 'claude-opus-5-5'], 'items': entries}
raw = json.dumps(bundle, ensure_ascii=False, indent=1) + '\n'
dest.write_text(raw)
print(json.dumps({'items': len(entries), 'ru_mode': dict(collections.Counter(e['ru_mode'] for e in entries)),
                  'rows_replaced': sum(1 for e in entries for v in e['before'].values() if v), 'bytes': len(raw.encode()), 'sha256': sha(raw)}, indent=1))

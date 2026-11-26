#!/usr/bin/env python3
"""XE-4 (docs/phase-4/P4.12-xe4-explanations.md): the XE-4 bundle MultiAdmin applies (exam:apply-explanations --bundle=xe4,
ApplyExplanationsRevision), in XE-3's revision format with its own review reason. Built from rv1's after state (tmp/xe4/after-*.json,
checked against an export taken after rv1 by check-after.py): the edited items' new content_hash, the new spec versions. An item may already have rows: `before` pins each language's row text at export by SHA-256 (null: no row),
so nothing changed since is overwritten. `ru_mode`:
- `new`: no Russian row; it is inserted;
- `teacher_keep`: the teacher's Mnemonic text stays word for word (Opus confirmed it);
- `replace`: an existing Russian row (an earlier AI text, or a teacher text Opus found wrong) is replaced; `keep` writes the same text
  again and only adds the new review.
en and uk rows are inserted or replaced in place.

usage: python3 -I scripts/xe4/build-bundle.py <MultiAdmin>/resources/data/edu/explanations-xe4.json
"""
import collections, hashlib, json, sys
from pathlib import Path

src, dest = Path('tmp/xe4'), Path(sys.argv[1])
items = {i['id']: i for i in json.loads((src / 'after-items.json').read_text())['items']}
topics = {t['slug']: t for t in json.loads((src / 'after-topics.json').read_text())['topics']}
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
    else:
        mode = 'replace'
    entries.append({'item_id': f['id'], 'content_hash': item['content_hash'], 'topic': item['topic'],
                    'spec_version': topics[item['topic']]['spec']['version'], 'before': before, 'ru_mode': mode,
                    'en': f['en'], 'ru': f['ru'], 'uk': f['uk']})

bundle = {'format': 'edu-explanations-xe3/v1', 'reason': 'explanations_xe4',
          'source': 'gonative-exam-prep docs/phase-4/P4.12-xe4-explanations.md: items of modal-verbs and modal-ability-permission after the '
                    'new specs of worksheet-generator bank revision rv1, and the three items rv1 edited; Opus 5.5 review of every item',
          'models': ['claude-opus-5-5'], 'items': entries}
raw = json.dumps(bundle, ensure_ascii=False, indent=1) + '\n'
dest.write_text(raw)
print(json.dumps({'items': len(entries), 'ru_mode': dict(collections.Counter(e['ru_mode'] for e in entries)),
                  'action': dict(collections.Counter(f['action'] for f in final)),
                  'rows_replaced': sum(1 for e in entries for v in e['before'].values() if v), 'bytes': len(raw.encode()), 'sha256': sha(raw)}, indent=1))

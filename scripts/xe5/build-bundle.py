#!/usr/bin/env python3
"""XE-5 (docs/phase-4/P4.13-xe5-explanations.md): the XE-5 bundle MultiAdmin applies (exam:apply-explanations --bundle=xe5,
ApplyExplanationsRevision) in XE-3's revision format with its own review reason. The items have no rows: `before` is null in every
language and `ru_mode` is `new`, so the apply refuses if any row appeared since the export.

usage: python3 -I scripts/xe5/build-bundle.py <MultiAdmin>/resources/data/edu/explanations-xe5.json
"""
import collections, hashlib, json, sys
from pathlib import Path

src, dest = Path('tmp/xe5'), Path(sys.argv[1])
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
    assert not existing, f['id']
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

bundle = {'format': 'edu-explanations-xe3/v1', 'reason': 'explanations_xe5',
          'source': 'gonative-exam-prep docs/phase-4/P4.13-xe5-explanations.md: the 74 sentence-punctuation items worksheet-generator '
                    'inserted on 2026-11-26 (bank-ai/pb1); Opus 5.5 wrote and checked every item',
          'models': ['claude-opus-5-5'], 'items': entries}
raw = json.dumps(bundle, ensure_ascii=False, indent=1) + '\n'
dest.write_text(raw)
print(json.dumps({'items': len(entries), 'ru_mode': dict(collections.Counter(e['ru_mode'] for e in entries)),
                  'action': dict(collections.Counter(f['action'] for f in final)),
                  'rows_replaced': sum(1 for e in entries for v in e['before'].values() if v), 'bytes': len(raw.encode()), 'sha256': sha(raw)}, indent=1))

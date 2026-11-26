#!/usr/bin/env python3
"""XE-2.4 (docs/phase-4/P4.10-xe2-explanations.md): the wave-2 bundle MultiAdmin applies (exam:apply-explanations --bundle=xe2),
in XE-1's shape.

One entry per explained item: the item and its content hash at export, the specification version of its topic (the explanation was
reviewed against it), the three texts and what happens to an existing Russian row:
- `new`: no Russian row exists; all three rows are inserted;
- `teacher_keep`: the teacher's Mnemonic text stays word for word and becomes servable (Opus confirmed it);
- `replace`: an existing Russian row (a teacher text Opus found wrong, or an unreviewed AI draft) is replaced; its text at export
  is pinned by SHA-256 so nothing changed since is overwritten.

usage: python3 -I scripts/xe2/build-bundle.py tmp/xe2 <MultiAdmin>/resources/data/edu/explanations-xe2.json
"""
import hashlib, json, sys
from pathlib import Path

src, dest = Path(sys.argv[1]), Path(sys.argv[2])
items = {i['id']: i for i in json.loads((src / 'items.json').read_text())['items']}
topics = {t['slug']: t for t in json.loads((src / 'topics.json').read_text())['topics']}
final = json.loads((src / 'final.json').read_text())['items']
sha = lambda s: hashlib.sha256(s.encode()).hexdigest()

entries = []
for f in sorted(final, key=lambda x: x['id']):
    item = items[f['id']]
    existing = (item.get('explanations') or {})
    if 'en' in existing or 'uk' in existing:
        raise SystemExit(f"item {f['id']} already has en/uk explanations")
    ru_row = existing.get('ru')
    if ru_row is None:
        mode, before = 'new', None
    elif f['ru_source'] == 'teacher':
        assert ru_row['provenance'] == 'imported:mnemonic' and ru_row['text'].strip() == f['ru'], f['id']
        mode, before, f['ru'] = 'teacher_keep', sha(ru_row['text']), ru_row['text']
    else:
        mode, before = 'replace', sha(ru_row['text'])
    entries.append({'item_id': f['id'], 'content_hash': item['content_hash'], 'topic': item['topic'],
                    'spec_version': topics[item['topic']]['spec']['version'], 'ru_mode': mode, 'ru_before_sha256': before,
                    'en': f['en'], 'ru': f['ru'], 'uk': f['uk']})

bundle = {'format': 'edu-explanations-xe2/v1', 'reason': 'explanations_xe2',
          'source': 'gonative-exam-prep docs/phase-4/P4.10-xe2-explanations.md: worksheet-generator drafts, Haiku 5.5 review, Opus 5.5 review of every item',
          'models': ['claude-haiku-5-5', 'claude-opus-5-5'], 'items': entries}
raw = json.dumps(bundle, ensure_ascii=False, indent=1) + '\n'
dest.write_text(raw)
modes = {}
for e in entries:
    modes[e['ru_mode']] = modes.get(e['ru_mode'], 0) + 1
print(json.dumps({'items': len(entries), 'ru_mode': modes, 'bytes': len(raw.encode()), 'sha256': sha(raw)}, indent=1))

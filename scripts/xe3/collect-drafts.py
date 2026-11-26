#!/usr/bin/env python3
"""XE-3.0 (docs/phase-4/P4.11-xe3-explanations.md): the draft each XE-3 item's first review starts from. Writes tmp/xe3/drafts.json.

The English explanation already in the bank (written and reviewed by XE-1 / XE-2 against the item's previous version) comes first,
then worksheet-generator's generation draft matched in XE-1 / XE-2 (tmp/xe1, tmp/xe2 drafts.json), else none. A draft of an item WG
edited is `stale`: it was written for the previous version, and the review decides whether it still fits.

usage: python3 -I scripts/xe3/collect-drafts.py
"""
import collections, json
from pathlib import Path

scope = json.loads(Path('docs/phase-4/xe3/scope.json').read_text())
edited = {e['id'] for e in scope['edited']}
items = json.loads(Path('tmp/xe3/items.json').read_text())['items']
earlier = {}
for wave in ('xe1', 'xe2'):
    earlier.update(json.loads(Path(f'tmp/{wave}/drafts.json').read_text())['drafts'])

drafts, stats = {}, collections.Counter()
for item in items:
    en = (item['explanations'] or {}).get('en')
    if en and en['provenance'] == 'ai_generated':
        drafts[str(item['id'])] = {'text': en['text'], 'stale': item['id'] in edited, 'from': 'bank_en'}
    elif str(item['id']) in earlier:
        drafts[str(item['id'])] = {'text': earlier[str(item['id'])]['text'], 'stale': item['id'] in edited, 'from': 'wg_draft'}
    stats[drafts[str(item['id'])]['from'] if str(item['id']) in drafts else 'none'] += 1
Path('tmp/xe3/drafts.json').write_text(json.dumps({'format': 'xe3-drafts/1', 'drafts': drafts}, ensure_ascii=False, indent=1))
print(json.dumps(dict(stats)))

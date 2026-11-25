#!/usr/bin/env python3
"""XE-1.0 (docs/phase-4/P4.9-xe1-explanations.md): English explanation drafts of the WG generator, matched to the wave-1
items by content_hash. Reads WG's local generation outputs (read only) and tmp/xe1/items.json; writes tmp/xe1/drafts.json.

usage: python3 -I scripts/xe1/collect-drafts.py <worksheet-generator>/tmp <file list> tmp/xe1
"""
import collections, json, sys
from pathlib import Path

wg_tmp, file_list, out = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
items = {i['content_hash']: i for i in json.loads((out / 'items.json').read_text())['items']}

found = collections.defaultdict(dict)   # content_hash -> draft text -> [files]
no_hash = 0

def walk(node, src):
    global no_hash
    if isinstance(node, dict):
        draft = node.get('explanation_en_draft')
        if isinstance(draft, str) and draft.strip():
            h = node.get('content_hash')
            if isinstance(h, str) and len(h) == 64:
                found[h].setdefault(draft.strip(), []).append(src)
            else:
                no_hash += 1
        for v in node.values():
            walk(v, src)
    elif isinstance(node, list):
        for v in node:
            walk(v, src)

for rel in file_list.read_text().split():
    path = wg_tmp / rel
    src = rel.lstrip('./')
    text = path.read_text(encoding='utf-8')
    if path.suffix == '.jsonl':
        for line in text.splitlines():
            if line.strip():
                walk(json.loads(line), src)
    else:
        walk(json.loads(text), src)

drafts, stats = {}, collections.Counter()
missing_by_source = collections.Counter()
for h, item in items.items():
    variants, stale = found.get(h), False
    if not variants:
        # A repaired or edited item keeps its first hash in source_ref ("<round>:<hash>"); its draft may be outdated.
        ref = (item.get('source_ref') or '').rsplit(':', 1)[-1]
        variants, stale = found.get(ref), bool(found.get(ref))
    if item['provenance'] != 'ai_generated':
        stats['mnemonic (not AI)'] += 1
        continue
    if not variants:
        stats['ai without draft'] += 1
        missing_by_source[(item.get('source_ref') or '').split(':')[0]] += 1
        continue
    stats['ai with draft (item changed since: the draft may be outdated)' if stale else 'ai with draft'] += 1
    if len(variants) > 1:
        stats['ai with several distinct drafts'] += 1
    # The draft seen in most files (the final stage repeats it); ties: the longest.
    text = max(variants, key=lambda t: (len(variants[t]), len(t)))
    drafts[str(item['id'])] = {'text': text, 'stale': stale, 'variants': len(variants), 'files': sorted(set(variants[text]))[:3]}

(out / 'drafts.json').write_text(json.dumps({'format': 'xe1-drafts/1', 'drafts': drafts}, ensure_ascii=False, indent=1))
print(json.dumps({'draft records without content_hash': no_hash, 'hashes with drafts in WG': len(found), **stats,
                  'ai without draft, by source': dict(missing_by_source.most_common())}, indent=1))

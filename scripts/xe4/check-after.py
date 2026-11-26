#!/usr/bin/env python3
"""XE-4 (docs/phase-4/P4.12-xe4-explanations.md): after WG applies rv1, compare a fresh SELECT-only export with the after state the
requests were built from (tmp/xe4/after-*.json). Equal: the frozen requests describe production exactly, so they may be sent; any
difference stops the round before anything is paid.

usage: php <repo>/scripts/xe4/export-items.php <repo> <repo>/tmp/xe4/after-export   (from the MultiAdmin root)
       python3 -I scripts/xe4/check-after.py tmp/xe4/after-export
"""
import json, sys
from pathlib import Path

live_dir = Path(sys.argv[1])
expected = {i['id']: i for i in json.loads(Path('tmp/xe4/after-items.json').read_text())['items']}
live_doc = json.loads((live_dir / 'items.json').read_text())
live = {i['id']: i for i in live_doc['items']}
canon = lambda v: json.dumps(v, sort_keys=True, ensure_ascii=False)
problems = []
if set(live) != set(expected):
    problems.append(f'items differ: missing {sorted(set(expected) - set(live))}, extra {sorted(set(live) - set(expected))}')
for i in sorted(set(live) & set(expected)):
    for f in ('content_hash', 'payload', 'cefr', 'topic', 'topic_id', 'type', 'status', 'explanations'):
        if canon(live[i].get(f)) != canon(expected[i].get(f)):
            problems.append(f'{i}: {f}')
if set(live_doc['edited_state'].values()) != {'after_rv1'}:
    problems.append(f"edited items not after rv1: {live_doc['edited_state']}")
exp_topics = {t['slug']: t for t in json.loads(Path('tmp/xe4/after-topics.json').read_text())['topics']}
live_topics = {t['slug']: t for t in json.loads((live_dir / 'topics.json').read_text())['topics']}
for slug, t in exp_topics.items():
    if canon(live_topics.get(slug, {}).get('spec')) != canon(t['spec']):
        problems.append(f'spec differs: {slug}')
print(json.dumps({'items': len(live), 'spec_versions_now': live_doc['spec_versions_now'], 'edited_state': live_doc['edited_state'],
                  'problems': problems[:50], 'problem_count': len(problems), 'verdict': 'equal' if not problems else 'DIFFERENT'}, indent=1))
sys.exit(1 if problems else 0)

#!/usr/bin/env python3
"""XE-1.0 (docs/phase-4/P4.9-xe1-explanations.md): deterministic checks of the matched drafts. Writes tmp/xe1/inventory.json
(per item: the key, the distractors and the draft's flags) and prints the summary that goes into P4.9 §6.

usage: python3 -I scripts/xe1/check-drafts.py tmp/xe1
"""
import collections, json, re, sys
from pathlib import Path

out = Path(sys.argv[1])
items = json.loads((out / 'items.json').read_text())['items']
drafts = json.loads((out / 'drafts.json').read_text())['drafts']

def key_and_distractors(item):
    p, t = item['payload'], item['type']
    if t == 'multiple_choice':
        by_id = {o['id']: o['text'] for o in p['options']}
        key = [by_id[c] for c in p['correct'] if c in by_id]
        return key, [x for i, x in by_id.items() if i not in p['correct']]
    if t == 'gap_choice':
        return [g['correct'] for g in p['gaps']], [o for g in p['gaps'] for o in g['options'] if o != g['correct']]
    if t == 'gap_fill':
        return [g['accepted'][0] for g in p['gaps'] if g['accepted']], []
    return list(p.get('accepted', [])[:1]), []

def mentions(text, phrase):
    phrase = phrase.strip().lower()
    return bool(phrase) and re.search(r'(?<![\w])' + re.escape(phrase) + r'(?![\w])', text.lower()) is not None

rows, stats, by_type = [], collections.Counter(), collections.defaultdict(collections.Counter)
lengths = []
for item in items:
    key, distractors = key_and_distractors(item)
    d = drafts.get(str(item['id']))
    row = {'id': item['id'], 'type': item['type'], 'cefr': item['cefr'], 'topic': item['topic'], 'skill': item['skills'][0],
           'provenance': item['provenance'], 'key': key, 'distractors': distractors, 'draft': d['text'] if d else None,
           'draft_stale': bool(d and d['stale']), 'ru_original': (item.get('explanations') or {}).get('ru', {}).get('text'), 'flags': []}
    if d:
        text = d['text']
        lengths.append(len(text))
        if item['type'] != 'ordering' and key and not any(mentions(text, k) for k in key):
            row['flags'].append('key_not_named')
        if re.search(r'[А-Яа-яЁёІіЇїЄє]', text):
            row['flags'].append('not_english')
        if len(text) < 25:
            row['flags'].append('too_short')
        if len(text) > 400:
            row['flags'].append('too_long')
        if re.search(r'\b(correct answer is|answer is)\b', text, re.I) and distractors and any(
                mentions(text.split('answer is', 1)[-1][:40], x) for x in distractors):
            row['flags'].append('distractor_called_correct')
        stats['draft: clean' if not row['flags'] else 'draft: flagged'] += 1
        for f in row['flags']:
            stats['flag ' + f] += 1
            by_type[item['type']][f] += 1
    else:
        stats['no draft (AI)' if item['provenance'] == 'ai_generated' else 'mnemonic item'] += 1
    rows.append(row)

(out / 'inventory.json').write_text(json.dumps({'format': 'xe1-inventory/1', 'items': rows}, ensure_ascii=False, indent=1))
lengths.sort()
print(json.dumps({'items': len(rows), **dict(stats), 'flags by type': {k: dict(v) for k, v in by_type.items()},
                  'draft length p10/p50/p90': [lengths[len(lengths) // 10], lengths[len(lengths) // 2], lengths[9 * len(lengths) // 10]],
                  'by skill': dict(collections.Counter(r['skill'] for r in rows).most_common())}, indent=1, ensure_ascii=False))

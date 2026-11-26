"""XE-4 (docs/phase-4/P4.12-xe4-explanations.md): the items whose explanations WG's bank revision rv1 hides.

rv1 (MultiAdmin resources/data/edu/bank-revision-v1.json, pinned by SHA) gives modal-ability-permission and modal-verbs a new spec
version: ItemExplanations::input() includes the topic's latest servable spec, so every review bound to the earlier version stops
matching. Scope: every item of XE-1 / XE-2 / XE-3 (the latest wave that wrote it) in those topics, minus the items rv1 retires, plus
the items rv1 edits (new payload). Relabels change only cefr, which the fingerprint does not include.

usage: python3 scripts/xe4/build-scope.py <multiadmin>
out:   docs/phase-4/xe4/scope.json
"""
import hashlib, json, sys

ma = sys.argv[1].rstrip('/')
RV1_SHA = 'd3e711987cf0a1610dc207271983be0081185e3a206b11160b52e99033b92ea6'
raw = open(f'{ma}/resources/data/edu/bank-revision-v1.json', 'rb').read()
assert hashlib.sha256(raw).hexdigest() == RV1_SHA, 'rv1 bundle differs from WG pin'
rv1 = json.loads(raw)

latest = {}
for wave in ('xe1', 'xe2', 'xe3'):
    for e in json.load(open(f'{ma}/resources/data/edu/explanations-{wave}.json'))['items']:
        latest[e['item_id']] = {'wave': wave, 'topic': e['topic'], 'spec_version': e['spec_version'], 'content_hash': e['content_hash']}

specs = {s['slug']: {'before_version': s['before_version'], 'before_hash': s['before_hash'], 'after_version': s['after_version'] if 'after_version' in s else s['before_version'] + 1,
                     'after_hash': s['after_hash']} for s in rv1['spec_updates']}
retired = sorted(r['id'] for r in rv1['item_retirements'])
edited = [{'id': u['id'], 'topic': u['primary_topic'], 'before_hash': u['before_hash'], 'after_hash': u['after_hash'], 'ours': u['id'] in latest}
          for u in rv1['item_updates']]
respec = [{'id': i, **v} for i, v in sorted(latest.items()) if v['topic'] in specs and i not in retired]
for r in respec:
    assert r['spec_version'] == specs[r['topic']]['before_version'], r
hidden = [i for i, v in latest.items() if v['topic'] in specs]

out = {'format': 'xe4-scope/1', 'rv1_bundle_sha256': RV1_SHA, 'spec_updates': specs,
       'counts': {'ours_in_spec_topics': len(hidden), 'retired_by_rv1': len(set(hidden) & set(retired)), 'respec': len(respec), 'edited': len(edited),
                  'by_topic': {t: sum(1 for r in respec if r['topic'] == t) for t in sorted(specs)},
                  'by_wave': {w: sum(1 for r in respec if r['wave'] == w) for w in ('xe1', 'xe2', 'xe3')}},
       'respec': respec, 'edited': edited, 'retired_by_rv1': retired}
json.dump(out, open('docs/phase-4/xe4/scope.json', 'w'), ensure_ascii=False, indent=1)
print(json.dumps(out['counts'], indent=1), json.dumps(specs, indent=1), json.dumps(edited, indent=1))

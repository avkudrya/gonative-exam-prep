#!/usr/bin/env python3
"""XE-2.3 (docs/phase-4/P4.10-xe2-explanations.md): XE-1's deterministic checks of the Haiku results for wave 2. A transformation's
key is a whole sentence, so the explanation is not required to quote it. Writes tmp/xe2/<step>-checked.json.

usage: python3 -I scripts/xe2/check-results.py tmp/xe2 haiku-pilot|haiku
"""
import collections, json, re, sys
from pathlib import Path

out, step = Path(sys.argv[1]), sys.argv[2]
inventory = {r['id']: r for r in json.loads((out / 'inventory.json').read_text())['items']}
requests = {json.loads(l)['custom_id']: json.loads(l) for l in (out / f'{step}-requests.jsonl').read_text().splitlines() if l.strip()}

CYR = re.compile(r'[А-Яа-яЁёІіЇїЄєҐґ]')
RU_ONLY = re.compile(r'[ЫыЭэЪъЁё]')
UK_ONLY = re.compile(r'[ІіЇїЄєҐґ]')
MAX = 300

def mentions(text, phrase):
    phrase = phrase.strip().lower()
    return bool(phrase) and re.search(r'(?<![\w])' + re.escape(phrase) + r'(?![\w])', text.lower()) is not None

def keys_of(item):
    if item['type'] in ('ordering', 'transformation'):
        return []
    # A gap that stays empty ('-' in gap_choice, no accepted text in gap_fill) has no word to name.
    return [k for k in item['key'] if k and k.strip() != '-' and not k.startswith('(nothing')]

rows, stats, request_issues = [], collections.Counter(), []
for line in (out / f'{step}-results.jsonl').read_text().splitlines():
    r = json.loads(line)
    cid = r['custom_id']
    expected = [it['id'] for it in json.loads(requests[cid]['params']['messages'][0]['content'][1]['text'].split('\n', 1)[1])]
    if r['result']['type'] != 'succeeded':
        request_issues.append((cid, r['result']['type']))
        continue
    msg = r['result']['message']
    if msg['stop_reason'] != 'end_turn':
        request_issues.append((cid, msg['stop_reason']))
        continue
    text = next(b['text'] for b in msg['content'] if b['type'] == 'text')
    results = json.loads(text)['results']
    got = [x['id'] for x in results]
    if got != expected:
        request_issues.append((cid, f'ids differ: missing {sorted(set(expected) - set(got))}, extra {sorted(set(got) - set(expected))}'))
    for x in results:
        inv = inventory.get(x['id'])
        if not inv:
            continue
        flags = []
        v = x['verdict']
        if v == 'reject':
            if x['key_ok']:
                flags.append('reject_but_key_ok')
            if x['en'] or x['ru'] or x['uk']:
                flags.append('reject_with_text')
        else:
            if not x['key_ok']:
                flags.append('key_not_ok_but_explained')
            for lang in ('en', 'ru', 'uk'):
                t = x[lang].strip()
                if not t:
                    flags.append(f'{lang}_empty')
                elif len(t) > MAX:
                    flags.append(f'{lang}_too_long')
            if CYR.search(x['en']):
                flags.append('en_has_cyrillic')
            if x['ru'] and not CYR.search(x['ru']):
                flags.append('ru_not_cyrillic')
            # Russian-only letters are a sure sign; a long text without any Ukrainian-only letter is suspicious.
            if x['uk'] and (RU_ONLY.search(x['uk']) or (len(CYR.findall(x['uk'])) > 120 and not UK_ONLY.search(x['uk']))):
                flags.append('uk_looks_russian')
            # A key of several gaps ('had been / would have passed') may be named part by part; a part counts as named when
            # the whole part or its last word (the lexical verb or noun of the gap) is quoted.
            keys = [k.strip("'\"") for k in keys_of(inv)]
            parts = [p.strip() for k in keys for p in k.split(' / ') if p.strip() and p.strip() != '-']
            named = lambda p: mentions(x['en'], p) or mentions(x['en'], p.split()[-1])
            if parts and not all(named(p) for p in parts):
                flags.append('en_key_not_named')
            if v == 'ok' and not inv['draft']:
                flags.append('ok_without_draft')
            if v == 'written' and inv['draft']:
                flags.append('written_despite_draft')
        teacher = inv['ru_original'] if inv['provenance'] != 'ai_generated' else None
        if teacher and x['ru_original'] == 'none':
            flags.append('teacher_ru_not_judged')
        if v != 'reject' and x['ru_original'] == 'ok' and teacher and x['ru'].strip() != teacher.strip():
            flags.append('teacher_ru_changed')
        stats['verdict ' + v] += 1
        if teacher:
            stats['teacher ru ' + x['ru_original']] += 1
        for f in flags:
            stats['flag ' + f] += 1
        rows.append({'id': x['id'], 'request': cid, 'type': inv['type'], 'cefr': inv['cefr'], 'topic': inv['topic'], 'key': inv['key'],
                     'draft': inv['draft'], 'teacher_ru': teacher, **x, 'flags': flags})

(out / f'{step}-checked.json').write_text(json.dumps({'format': 'xe2-checked/1', 'items': rows}, ensure_ascii=False, indent=1))
print(json.dumps({'items': len(rows), 'request_issues': request_issues, **dict(sorted(stats.items())),
                  'clean': sum(1 for r in rows if not r['flags'] and r['verdict'] != 'reject')}, ensure_ascii=False, indent=1))

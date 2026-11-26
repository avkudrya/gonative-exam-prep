#!/usr/bin/env python3
"""XE-4 (docs/phase-4/P4.12-xe4-explanations.md): the Opus results against what was sent. Writes tmp/xe4/opus-checked.json and prints
the summary: actions, how often the current texts were still right, rejects, teacher texts, missing accepted answers, and the
deterministic checks of the texts Opus wrote (XE-2's checks).

usage: python3 -I scripts/xe4/check-opus.py
"""
import collections, json, re
from pathlib import Path

out = Path('tmp/xe4')
items = {i['id']: i for i in json.loads((out / 'after-items.json').read_text())['items']}
TEACHER = {i: x['explanations']['ru']['text'] for i, x in items.items() if (x.get('explanations') or {}).get('ru', {}).get('provenance') == 'imported:mnemonic'}
requests = {json.loads(l)['custom_id']: json.loads(l) for l in (out / 'opus-requests.jsonl').read_text().splitlines() if l.strip()}

CYR = re.compile(r'[А-Яа-яЁёІіЇїЄєҐґ]')
RU_ONLY = re.compile(r'[ЫыЭэЪъЁё]')
UK_ONLY = re.compile(r'[ІіЇїЄєҐґ]')

def mentions(text, phrase):
    phrase = phrase.strip().lower()
    return bool(phrase) and re.search(r'(?<![\w])' + re.escape(phrase) + r'(?![\w])', text.lower()) is not None

def keys(view):
    k = view['key']
    if isinstance(k, str):
        return [k]
    return [x['answer'] if isinstance(x, dict) else x for x in k]

def text_flags(view, en, ru, uk, teacher_ok):
    flags = []
    for lang, t in (('en', en), ('ru', ru), ('uk', uk)):
        if lang == 'ru' and teacher_ok:
            continue
        if not t.strip():
            flags.append(f'{lang}_empty')
        elif len(t.strip()) > 300:
            flags.append(f'{lang}_too_long')
    if CYR.search(en):
        flags.append('en_has_cyrillic')
    if uk and (RU_ONLY.search(uk) or (len(CYR.findall(uk)) > 120 and not UK_ONLY.search(uk))):
        flags.append('uk_looks_russian')
    if view['type'] not in ('ordering', 'transformation'):
        parts = [p.strip() for k in keys(view) if k and k.strip() != '-' and not k.startswith('(nothing') for p in k.strip("'\"").split(' / ')
                 if p.strip() and p.strip() != '-']
        if parts and not all(mentions(en, p) or mentions(en, p.split()[-1]) for p in parts):
            flags.append('en_key_not_named')
    return flags

rows, stats, issues, missing_answers, sent_ids = [], collections.Counter(), [], [], set()
for line in (out / 'opus-results.jsonl').read_text().splitlines():
    r = json.loads(line)
    cid = r['custom_id']
    sent = json.loads(requests[cid]['params']['messages'][0]['content'][1]['text'].split('\n', 1)[1])
    views = {v['id']: v for v in sent}
    sent_ids |= set(views)
    if r['result']['type'] != 'succeeded' or r['result']['message']['stop_reason'] != 'end_turn':
        issues.append((cid, r['result']['type'], r['result'].get('message', {}).get('stop_reason')))
        continue
    results = json.loads(next(b['text'] for b in r['result']['message']['content'] if b['type'] == 'text'))['results']
    if [x['id'] for x in results] != list(views):
        issues.append((cid, 'ids differ', sorted(set(views) - {x['id'] for x in results})))
    for x in results:
        if x['id'] not in views:
            continue
        v = views[x['id']]
        teacher = TEACHER.get(x['id'])
        flags = []
        if x['action'] == 'reject' and x['key_ok']:
            flags.append('reject_but_key_ok')
        if x['action'] != 'reject' and not x['key_ok']:
            flags.append('kept_with_bad_key')
        if x['action'] == 'keep' and v['current'] is None:
            flags.append('keep_without_current')
        if x['action'] == 'fix':
            flags += text_flags(v, x['en'], x['ru'], x['uk'], x['teacher_ru_ok'] == 'ok')
        if teacher and x['teacher_ru_ok'] == 'none':
            flags.append('teacher_not_judged')
        stats[f"{v['why']}: action {x['action']}"] += 1
        if v['current'] is not None:
            stats['current texts ' + ('correct' if x['current_correct'] else 'wrong')] += 1
        if teacher:
            stats['teacher ' + x['teacher_ru_ok']] += 1
        for f in flags:
            stats['flag ' + f] += 1
        for a in x['accepted_missing']:
            missing_answers.append({'id': x['id'], 'missing': a})
        rows.append({'id': x['id'], 'request': cid, 'why': v['why'], 'type': v['type'], 'cefr': v['cefr'], 'teacher_ru': teacher, 'current': v['current'],
                     **x, 'flags': flags})

done = {r['id'] for r in rows}
(out / 'opus-checked.json').write_text(json.dumps({'format': 'xe4-opus-checked/1', 'items': rows, 'accepted_missing': missing_answers,
                                                   'not_returned': sorted(set(items) - done)}, ensure_ascii=False, indent=1))
print(json.dumps({'items': len(rows), 'not_returned': len(set(items) - done), 'request_issues': issues, **dict(sorted(stats.items())),
                  'accepted_missing': len(missing_answers)}, ensure_ascii=False, indent=1))

#!/usr/bin/env python3
"""XE-2.3 (docs/phase-4/P4.10-xe2-explanations.md): XE-1's Opus check for wave 2 (a transformation's key is a whole sentence
and is not required in the text). The Opus results against the Haiku ones. Writes tmp/xe2/<step>-checked.json and
prints the summary: actions, Haiku's error rate on the clean sample, rejects overturned, teacher texts, missing accepted answers,
and the deterministic checks of the texts Opus wrote.

usage: python3 -I scripts/xe2/check-opus.py tmp/xe2 opus-pilot|opus|opus2
"""
import collections, json, re, sys
from pathlib import Path

out, step = Path(sys.argv[1]), sys.argv[2]
inventory = {r['id']: r for r in json.loads((out / 'inventory.json').read_text())['items']}
# Teacher texts only: Mnemonic items may also carry an unreviewed AI ru draft from earlier on-demand runs.
TEACHER = {i['id']: i['explanations']['ru']['text'] for i in json.loads((out / 'items.json').read_text())['items']
           if (i.get('explanations') or {}).get('ru', {}).get('provenance') == 'imported:mnemonic'}
haiku = {r['id']: r for r in json.loads((out / 'haiku-checked.json').read_text())['items']}
requests = {json.loads(l)['custom_id']: json.loads(l) for l in (out / f'{step}-requests.jsonl').read_text().splitlines() if l.strip()}

CYR =re.compile(r'[А-Яа-яЁёІіЇїЄєҐґ]')
RU_ONLY = re.compile(r'[ЫыЭэЪъЁё]')
UK_ONLY = re.compile(r'[ІіЇїЄєҐґ]')

def mentions(text, phrase):
    phrase = phrase.strip().lower()
    return bool(phrase) and re.search(r'(?<![\w])' + re.escape(phrase) + r'(?![\w])', text.lower()) is not None

def text_flags(item, en, ru, uk, teacher_ok):
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
    if item['type'] not in ('ordering', 'transformation'):
        parts = [p.strip() for k in item['key'] if k and k.strip() != '-' and not k.startswith('(nothing') for p in k.strip("'\"").split(' / ')
                 if p.strip() and p.strip() != '-']
        if parts and not all(mentions(en, p) or mentions(en, p.split()[-1]) for p in parts):
            flags.append('en_key_not_named')
    return flags

rows, stats, issues = [], collections.Counter(), []
first_by_why = collections.defaultdict(collections.Counter)
missing_answers = []
for line in (out / f'{step}-results.jsonl').read_text().splitlines():
    r = json.loads(line)
    cid = r['custom_id']
    sent = json.loads(requests[cid]['params']['messages'][0]['content'][1]['text'].split('\n', 1)[1])
    whys = {it['id']: it['why'] for it in sent}
    if r['result']['type'] != 'succeeded' or r['result']['message']['stop_reason'] != 'end_turn':
        issues.append((cid, r['result']['type'], r['result'].get('message', {}).get('stop_reason')))
        continue
    results = json.loads(next(b['text'] for b in r['result']['message']['content'] if b['type'] == 'text'))['results']
    if [x['id'] for x in results] != [it['id'] for it in sent]:
        issues.append((cid, 'ids differ', sorted(set(whys) - {x['id'] for x in results})))
    for x in results:
        item, h = inventory[x['id']], haiku.get(x['id'])
        why = whys.get(x['id'], [])
        teacher = TEACHER.get(x['id'])
        flags = []
        if x['action'] == 'reject' and x['key_ok']:
            flags.append('reject_but_key_ok')
        if x['action'] != 'reject' and not x['key_ok']:
            flags.append('kept_with_bad_key')
        if x['action'] == 'fix':
            flags += text_flags(item, x['en'], x['ru'], x['uk'], x['teacher_ru_ok'] == 'ok')
        if x['action'] == 'keep' and (not h or h['verdict'] == 'reject'):
            flags.append('keep_without_haiku_text')
        if teacher and x['teacher_ru_ok'] == 'none':
            flags.append('teacher_not_judged')
        stats['action ' + x['action']] += 1
        for w in why:
            first_by_why[w]['correct' if x['first_correct'] else 'wrong'] += 1
        if 'reject' in why:
            stats['haiku reject → ' + x['action']] += 1
        if teacher:
            stats['teacher ' + x['teacher_ru_ok']] += 1
        for f in flags:
            stats['flag ' + f] += 1
        for a in x['accepted_missing']:
            missing_answers.append({'id': x['id'], 'missing': a})
        rows.append({'id': x['id'], 'request': cid, 'why': why, 'type': item['type'], 'topic': item['topic'], 'key': item['key'],
                     'teacher_ru': teacher, 'haiku': h and {k: h[k] for k in ('verdict', 'key_ok', 'reason', 'en', 'ru', 'uk', 'ru_original')},
                     **x, 'flags': flags})

(out / f'{step}-checked.json').write_text(json.dumps({'format': 'xe2-opus-checked/1', 'items': rows, 'accepted_missing': missing_answers},
                                                    ensure_ascii=False, indent=1))
rate = {w: f"{c['wrong']} of {c['wrong'] + c['correct']} wrong ({100 * c['wrong'] / max(1, c['wrong'] + c['correct']):.1f} %)" for w, c in first_by_why.items()}
print(json.dumps({'items': len(rows), 'request_issues': issues, 'haiku error by reason': rate, **dict(sorted(stats.items())),
                  'accepted_missing': len(missing_answers)}, ensure_ascii=False, indent=1))

# H. Интеграция с Edu / Worksheet Generator (P0.2)

**Статус:** черновик v1 (2026-11-23). Только чтение кода MultiAdmin и документов WG. Состояние банка в
production — по квитанциям WG (`worksheet-generator/docs/phase-2/bank-fill-roadmap.md`, 2026-11-22);
прямое чтение production-базы в этой сессии не выполнялось. Локальная sandbox отстаёт (данные Edu по
2026-11-16, пригодных заданий 0) и для оценки объёма банка не годится.
**ТЗ:** §12, §26 H. **Основано на:** [B](B-worksheets-assessment.md).

## 1. Итог

| Вывод | Следствие |
|---|---|
| Банк Edu в production: en 47 тем / 414 ячеек / 13 870 заданий; грамматика — 31 тема A1–B2 (16 MVP + 10 G1 + 5 G2) | Практика по большинству грамматических навыков IELTS есть с первого дня |
| Правило выдачи уже есть в Edu: `Item::servableTo($userId)` — статус проверки, не снято, общий доступ с правом публикации (или своё личное) | Exam выбирает задания сам через это правило, не завися от `Worksheets\BankSelection` (он завязан на структуру листа) |
| Нет тем B2–C1, важных для IELTS: связки и когезия, сложные предложения, согласование подлежащего и сказуемого, словообразование, пунктуация, коллокации | Список заявок в план наполнения банка WG (п. 4) |
| `Edu\Bench` заточен под генерацию заданий | Для эссе — свой `Exam\Bench`, на общих `GenerationRun`, `StepRunner`, `MeteredLlm` |
| `MeteredLlm` пишет все расходы как `feature = edu` | Минимальное расширение, чтобы расходы Exam считались отдельно |
| Онлайн-проверки ответов нет; владелец планирует её отдельно | Фаза 4 (практика) зависит от неё; Exam — потребитель |

## 2. Грамматика в банке (production, 2026-11-22)

- **MVP (16):** present simple / continuous и их сравнение, past simple, present perfect и сравнение с past simple,
  future forms, conditionals, passive voice, modal verbs, articles, prepositions of time and place, comparatives
  and superlatives, reported speech, relative clauses, gerund and infinitive.
- **G1 (10, A1–B1):** в том числе have got, question forms, pronouns and possessives, countable nouns and quantifiers,
  adverbs of frequency, ability; расширение modal verbs до A1.
- **G2 (5, A2–B2):** past continuous, used to / would, past perfect, present perfect continuous, wish / if only.
  Word formation отложен WG (много верных производных).
- Типы в новых темах: multiple choice, gap choice, gap fill, error correction, ordering. Transformation в новых
  темах WG не делает. Уровни — до B2.

## 3. Навыки оценки → темы Edu

> **Обновить после GS** (решение владельца 2026-11-24): таблица ниже — состояние 2026-11-22. Темы EX уже в production:
> `linking-words`, `complex-sentences`, `subject-verb-agreement`, `word-formation`, `sentence-punctuation`,
> `formal-informal-register`. Подтемы и новые темы раунда GS WG пришлёт списком slug после применения GS в
> production — тогда пересобрать связку.

| Навык (`exam-domain/src/skills.ts`) | Темы Edu | Покрытие |
|---|---|---|
| `grammar.articles` | articles | ✅ |
| `grammar.verb_tenses` | present/past/perfect/continuous/future, сравнения времён | ✅ |
| `grammar.prepositions` | prepositions of time and place (до B1); лексика `phrases_with_prepositions` | ⚠️ нет зависимых предлогов B2 (*responsible for, impact on*) |
| `grammar.sentence_structure` | relative clauses, conditionals, passive, reported speech | ⚠️ нет сложных и сложноподчинённых предложений как темы (GRA, ограничитель «subordinate clauses are rare») |
| `grammar.subject_verb_agreement` | — | ❌ |
| `coherence.cohesive_devices` | — | ❌ связки и ссылочные слова (CC) |
| `vocabulary.word_formation` | — (отложено WG) | ❌ |
| `vocabulary.collocations` | — | ❌ в словаре GoNative тоже почти нет ([G](G-vocabulary-integration.md) §2.3) |
| `mechanics.punctuation` | — | ❌ run-on, comma splice |
| `register.formality` | — | ❌ письма GT Task 1 |
| `vocabulary.range`, `word_choice`, `repetition` | — (лексика — через паки GoNative) | ↔ G |
| `task.*`, `coherence.paragraphing`, `coherence.progression` | — | Не упражнения банка: практика письмом и разбором |

Сопоставление храним данными: таблица «навык → темы Edu (+ уровни)» в `ex_*` или `edu_topic_mappings`
(`system = exam_skill`) — решить в I.

## 4. Заявки в план наполнения банка (для владельца и WG)

По приоритету для IELTS Writing:

1. Связки и когезия (B1–C1): contrast/addition/cause-effect, reference and substitution.
2. Сложные предложения: подчинение, причастные обороты, *although/whereas/despite*.
3. Согласование подлежащего и сказуемого (B1–B2).
4. Словообразование B1–B2 (только формат «основа-подсказка» — риск нескольких верных форм, как отметил WG).
5. Коллокации академической лексики (B2–C1): подбор глагола или прилагательного к существительному.
6. Пунктуация предложений (run-on, comma splice).
7. Регистр письма (formal ↔ informal) для GT Task 1.
8. Грамматика C1: инверсия, cleft sentences, сложный пассив — позже.

Порядок и бюджет — решение владельца в общем плане наполнения WG; Exam Prep задания сам не генерирует.
**Решение владельца 2026-11-23: «включай».** Заявка добавлена пунктом **EX** в очередь
`worksheet-generator/docs/phase-2/bank-fill-roadmap.md`.

**2026-11-24.** Темы EX в production (список — в §3). Коллокации академической лексики (п. 5) и объяснения к
AI-заданиям — пункт **XE** того же плана WG: смету WG сделает бесплатно после своего раунда GS, запуск — отдельным
решением владельца.

## 5. Выбор заданий для практики

```
навык с достаточными наблюдениями → темы Edu (п. 3) → Item::servableTo(userId)
  + edu_item_topics (тема) + type ∈ поддерживаемые онлайн + cefr ≈ уровень пользователя
  − задания, уже решённые пользователем (ex_practice_answers)
  → набор на 10–15 заданий
```

Логику упражнений не форкаем: payload, ключ (`answerKey`), объяснения (`ItemExplanations`) и переводы берём из Edu.
Состояние практики (что выдано, ответы, результат) — в `ex_*`.

**Когда (решение владельца 2026-11-24):** практика из банка подключается, когда готовы онлайн-проверка ответов (§6)
и объяснения к AI-заданиям — **XE в WG** (генератор пишет объяснения, но в банк они пока не импортируются).

## 6. Онлайн-проверка ответов

У типов упражнений есть `answerKey()` и языковые профили с `normalizeAnswer` / `answersEquivalent`; нет
проверки ответа ученика. Владелец планирует её отдельно (2026-11-22). Требования Exam Prep к будущему
механизму: детерминированная проверка по ключу для MC / gap choice / gap fill / error correction / ordering;
результат по каждому заданию с указанием навыка; без AI в горячем пути.

**2026-11-24.** Механизм общий: им будут пользоваться Exam Prep и онлайн-листы WG. Кто и когда его строит — решение
владельца параллельно с началом Фазы 4; предлагаемый порядок — короткая спецификация, затем отдельная задача в
MultiAdmin.

**2026-11-25.** Построен в WG и выложен с онлайн-практикой (этап А): `Edu/Practice/AnswerChecker` (без БД, HTTP и AI) и
`Edu/Practice/QuestionCompiler` для заданий банка; практику Exam Prep хранит в `ex_*`. Коллокации B2 (п. 5 §4) — раунд XC WG,
тема `academic-collocations` + 8 подтем по темам эссе; объяснения к AI-заданиям — XE-1 в WG.

## 7. AI-слой для оценки эссе

| Компонент | Как использует Exam |
|---|---|
| `GenerationRun` (`purpose`, `subject_type/id`, `budget_usd`, `cost_usd`) | Прогон оценки = run с `purpose = exam_assessment` (или `exam_bench`), `subject` = попытка |
| `StepRunner` | Шаги оценки по критериям и проверки — идемпотентно, повтор не платит дважды |
| `MeteredLlm` + `ModelRouter` + `config/edu_models.php` | Новые задачи `assess.criterion`, `assess.validate`; валидатор другого вендора через `avoid` |
| `BenchMetrics` (каппа и др.) | Переиспользовать чистые функции в `Exam\Bench` |

**Расширение E1:** `MeteredLlm::FEATURE = 'edu'` — константа. Нужна возможность записать `feature = exam`
(из `purpose` прогона или параметром), иначе стоимость оценок смешается с Edu.
**Расширение E2:** `Exam\Bench` — датасеты эссе (наборы S/G/R/H1/H2 из [E1](E1-reference-data.md)), прогон по
вариантам пайплайна, метрики. Отдельный модуль, не правка `Edu\Bench`.

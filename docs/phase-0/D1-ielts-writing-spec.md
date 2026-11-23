# D1. IELTS Writing: проверенная спецификация (P0.3)

**Статус:** проверено 2026-11-23 по официальным источникам. Часть документа D (стратегия оценки).
**Конфигурация:** `packages/exam-domain/catalog/ielts-academic.json`, `ielts-general-training.json`
(статус `verified`); факты закреплены тестами `packages/exam-domain/test/catalog.test.ts`.

## Источники

| # | Источник |
|---|---|
| S1 | [IELTS Academic format – Writing](https://ielts.org/take-a-test/test-types/ielts-academic-test/ielts-academic-format-writing) |
| S2 | [IELTS General Training format – Writing](https://ielts.org/take-a-test/test-types/ielts-general-training-test/ielts-general-training-format-writing) |
| S3 | [IELTS scoring in detail](https://ielts.org/take-a-test/your-results/ielts-scoring-in-detail) |
| S4 | [Writing test resources](https://ielts.org/take-a-test/preparation-resources/writing-test-resources/) |
| S5 | [Writing Band Descriptors, «Updated May 2023»](https://ielts.org/cdn/ielts-downloadable-assets/ielts-guidance-and-support/ielts-guides/ielts-writing-band-descriptors.pdf) — Task 1 и Task 2, общие для Academic и General Training |
| S6 | Образцы ответов с оценками и комментариями экзаменаторов: [Academic](https://ielts.org/cdn/computer-delivered-sample-tests-academic-writing/ielts-academic-writing-example-responses-to-parts-1-and-2-with-band-scores-and-examiner-comments.pdf), [General Training](https://ielts.org/cdn/computer-delivered-sample-tests-general-training-writing/ielts-general-training-writing-example-responses-to-parts-1-and-2-with-band-scores-and-examiner-comments.pdf) |

## Подтверждённые факты

| Факт | Значение | Источник |
|---|---|---|
| Время и число заданий | 60 минут, 2 задания; Task 1 — около 20 минут, Task 2 — около 40 (рекомендация, не жёсткий лимит) | S1, S2 |
| Минимум слов | Task 1 — 150, Task 2 — 250 (одинаково для Academic и GT) | S1, S2, S6 |
| Academic Task 1 | Описать визуальную информацию своими словами: графики, таблицы, диаграммы, процессы, объекты; в материалах экзаменаторов также карты. Академический или нейтральный стиль | S1, S4, S6 |
| General Training Task 1 | Письмо по ситуации с тремя пунктами, которые нужно раскрыть; стиль личный, полуформальный или формальный; адреса писать не нужно | S2, S4 |
| Task 2 | Позиция по аргументу, проблеме или точке зрения. Academic — академический или нейтральный стиль; GT — дискуссионное эссе на тему общего интереса, полуформальный или нейтральный стиль | S1, S2, S6 |
| Вес заданий | «Task 2 contributes twice as much as Task 1 to the Writing score» | S1, S2, S4 |
| Критерии | Task 1: Task Achievement; Task 2: Task Response; в обоих: Coherence and Cohesion, Lexical Resource, Grammatical Range and Accuracy | S3, S5, S6 |
| Вес критериев | «The criteria are weighted equally and the score on the task is the average» | S3, S4 |
| Шкала критерия | Дескрипторы описаны для целых полос 0–9 | S5 |
| Оценка за задание | «Scores may be reported as whole bands or half bands»; в образцах — 4, 5, 5.5, 6, 7.5 | S6 |
| Общий балл IELTS | Среднее четырёх секций, округлённое до ближайшей половины: .25 → вверх до .5, .75 → вверх до целого | S3 |
| Принцип выставления | «A script must fully fit the positive features of the descriptor at a particular level. Bolded text indicates negative features that will limit a rating» | S5 |
| Способ сдачи | На компьютере или на бумаге; о различиях в оценке не сказано | S1, S2 |

## Чего официально нет

1. **Правила округления** для оценки за задание и для балла за Writing не опубликованы. В конфигурации
   округление не задаём. Для ориентировочного показа (ADR-003) это не важно: диапазоны и так лежат
   на сетке 0.5.
2. **Правила подсчёта слов** на ielts.org не описаны. Неофициальные источники сходятся в одном:
   слово через дефис, сокращение и число — одно слово; отдельный символ — не слово. Наше правило
   `whitespace-v1` с этим совпадает. В интерфейсе пишем «примерно N слов».
3. **Фиксированного штрафа за недобор слов нет.** Официально сказано: «there may not be enough evidence …
   to award higher bands». В дескрипторах недобор упомянут только на нижних полосах: LR 3
   «significantly underlength», GRA 3 «Length may be insufficient». Короче минимума — это предупреждение
   и риск занижения, а не автоматический штраф.

## Детерминированные правила (поле `rules` рубрики)

| Правило | Формулировка источника | Как применяем |
|---|---|---|
| `short_response` (≤ 20 слов → Band 1) | «Responses of 20 words or fewer are rated at Band 1» — по всем четырём критериям | До вызова AI: все критерии 1, без платного вызова |
| `discount_copied_prompt` | «Any copied rubric must be discounted» | Фрагменты, совпадающие с заданием, исключаем из подсчёта слов и помечаем в разборе |
| `wrong_language` (Band 0) | Band 0 — «used a language other than English throughout» | Детерминированная проверка языка; Band 0 только если весь текст не на английском |
| — (не автоматизируем) | Band 0 при «proof that a candidate's answer has been totally memorised» | Доказательства у нас нет и быть не может; Band 0 за заучивание не ставим. Шаблонность — только находка `vocabulary`/`task` с цитатой |
| — (штраф без числа) | «penalised» за ответ не по теме, заметки или списки вместо связного текста, «severely penalised» за плагиат | Находки высокой серьёзности, отдельная проверка формы (списки, маркеры) |

## Ограничители (жирный текст дескрипторов) — вход для стратегии оценки D

Жирным выделены признаки, которые не дают поставить полосу выше указанной, даже если остальное
подходит. Это проверяемые утверждения: модель отвечает «да/нет» с цитатой, а верхнюю границу
считает код.

| Критерий | Признак (жирным в S5) | Полоса, где указан |
|---|---|---|
| TA (Academic) | «There may be no data to support the description» | 5 |
| TA (GT) | «Not all bullet points are presented»; «The tone may be inappropriate» | 4 |
| TA, TR | «The format may be inappropriate» | 4 |
| TR | «The main parts of the prompt are incompletely addressed» | 5 |
| TA, TR | «The content is wholly unrelated to the task/prompt» | 1 |
| CC | «Paragraphing may be inadequate or missing» (Task 2) | 5 |
| CC | «the entire response may be off-topic» | 2 |
| LR | «unrelated to the task» | 4 |
| GRA | «Subordinate clauses are rare and simple sentences predominate» | 4 |
| GRA | «Length may be insufficient to provide evidence of control of sentence forms» | 3 |

Из материалов S4 (видео для кандидатов): если в задании «discuss both views» раскрыта только одна
сторона, оценка TR ограничена Band 5. Это частный случай признака TR 5.

**Предложение для D:** оценивать критерий в два шага.
1. Модель отмечает выполнение положительных признаков полосы и наличие ограничителей, к каждому — цитата.
2. Код берёт наивысшую полосу, все положительные признаки которой выполнены, и применяет ограничители.

Такой подход проверяем по частям и устойчивее, чем «назови балл». Сравним его с прямой оценкой
в бенчмарке Фазы 1.

## Правовой момент: текст дескрипторов

Материалы ielts.org предоставляются «for your personal and non-commercial use only»; для коммерческих
целей, перепубликации и изменения нужно письменное разрешение
([copyright statement](https://ielts.org/legal/ielts-copyright-and-trade-mark-statement)).
Поэтому в промпты продукта **не вставляем дословный текст дескрипторов**: пишем собственное руководство
по оценке своими словами, со ссылкой на официальный документ. Дословные цитаты в этом документе —
короткие, для обоснования конфигурации. Решение по запросу разрешения — в вопросах к владельцу
([E1](E1-reference-data.md)).

## Что изменилось в коде

- Конфигурации IELTS Academic и General Training: `draft` → `verified` (2026-11-23), источники с датой.
- Схема: `taskType.stimulus` → `stimuli[]` (у Academic Task 1 бывают данные, диаграммы и карты);
  у рубрики появились детерминированные `rules`.
- Убрано округление балла за Writing до 0.5, которое было в черновике: официально оно не опубликовано.

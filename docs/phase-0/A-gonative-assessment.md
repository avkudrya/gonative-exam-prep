# A. Инфраструктура GoNative — что переиспользует Exam Prep

**Статус:** черновик v1 (2026-11-22), только чтение кода. **ТЗ:** §3.1, §11, §19, §26 A.
**Источники:** код MultiAdmin (`main`, синхронен с origin), gonativeweb; аудит WG
`worksheet-generator/docs/phase-0/A-system-assessment.md` (2026-11-14). Общую часть WG здесь не
повторяем, только то, что важно для Exam Prep. Пункты «проверить» — задачи P0.1.

## 1. Итог

| Вывод | Следствие для Exam Prep |
|---|---|
| MultiAdmin — общий бэкенд GoNative и Worksheets; в нём уже есть общий движок `Edu` | Бэкенд Exam Prep — модуль MultiAdmin ([ADR-001](../decisions/ADR-001-backend-and-hosting.md)) |
| **Есть словарные паки IELTS:** `vocabulary_packs` с `type = ielts`, IELTS Academic и IELTS General, уровни A1–C2 | Готовая основа «существующих коллекций» (ТЗ §11.4 A) |
| Паки уже превращаются в обычные списки пользователя (`VocabularyPackListBuilderService`) и учатся с интервальным повторением | Персональные списки и SRS не строим заново (ТЗ §11.6) |
| Бесплатный пользователь GoNative ограничен 100 изучаемыми словами | Конфликт с платным Exam Prep → решение в [ADR-002](../decisions/ADR-002-accounts-and-billing.md) |
| Уровни CEFR у слов и примеров проставлены AI, официальной привязки к спискам CEFR нет | Можно подбирать лексику по уровню, но нельзя заявлять «официальный CEFR» |
| Грамматика самого GoNative сгенерирована без валидации (по аудиту WG — 14 проблемных из 25 в выборке) | Грамматику для практики берём из банка Edu, не из GoNative |
| Paddle уже различает продукты (`gonative`, `worksheets`) | Exam Prep — третий продукт без влияния на Premium |

## 2. Словарь и коллекции

### 2.1 Словари (на язык)

`dictionary_{lang}` (слово, фраза, `attributes.level_label` — CEFR от AI, транскрипция, аудио, часть речи),
`dictionary_{lang}_translations` (переводы с `main` и порядком), `dictionary_{lang}_examples` и их переводы.
Для en: ~198 тыс. слов, ~82 тыс. примеров (аудит WG). Слоя значений (sense) в словаре GoNative нет;
WG добавил его в Edu (`Edu\Sense`, `SenseTranslation`) с заполнением по требованию.

### 2.2 Системные коллекции

| Сущность | Что это | Для Exam Prep |
|---|---|---|
| `vocabulary_packs` / `_levels` / `_words` | Экзаменационные паки: `type` (`ielts`, задумано и `toefl`, `cambridge`), язык, диалект (GB/US), уровни A1–C2, слова со ссылкой на словарь | **Основной источник.** IELTS Academic: 875 / 849 / 899 / 814 / 727 / 886 слов (A1→C2); IELTS General: 875 / 849 / 938 / 763 / 518 / 394 (файлы импорта `resources/vocabulary-packs/en/*`; в БД — проверить) |
| `user_vocabulary_pack_progress`, `user_vocabulary_pack_word_statuses` | Прогресс по уровню пака; статус слова `known` / `selected` / `skipped` / `added_to_lists` с `course_lesson_id` | Знание «уже выученного» (ТЗ §11.3 п. 7) и точка связи со списками |
| `glossaries` (дерево `parent_id`, `level`, переводы названий) + `glossary_words_{lang}` | Тематические коллекции курсов по уровням | Тематическая лексика (образование, экология, технологии…) — проверить, какие темы есть |
| `lexical_domains` / `lexical_clusters` (+ промпты, языки) | Лексические кластеры A1–B2 с AI-наполнением и проверкой | Источник тематических выражений и коллокаций — проверить покрытие B2–C1 |
| `topic_vocab_*` | Кандидаты тематической лексики с AI-генерацией и дневным лимитом | Образец конвейера «сгенерировать → проверить → добавить» |

### 2.3 Списки пользователя и повторение

- Курс «Your Lessons» (`course_id = 6`) → `CourseLesson{Lang}` (список) → `CourseWord{Lang}` + `PiggyBank{Lang}`.
  Ровно такие записи создаёт `VocabularyPackListBuilderService::createLearningLists()`, по образцу
  `LexicalTopicsController::saveWordsToLists`.
- API для списков и слов уже есть: `addWordToLesson`, `moveWordsBetweenLessons`, `deleteUserList`,
  корзина (`addToBasket`, `addWordsFromBasket`), теги списков (`getListTags`, `createListTag`).
- Интервальное повторение — календарь списков (`addLessonToCalendar`, `getCalendarData`,
  `RepetitionSchedule`: системы `quick` / `short` / `standard` / `long` / `mix`). Тренировки и
  статистика ошибок по словам — `getLessonTrainingWords`, `checkUserTranslation`, `getWordMistakes`.
- Свои слова пользователя — `DictionaryCustomController` (`createCustomEntity`). Через него же можно
  хранить сгенерированные AI выражения, не трогая общий словарь (ТЗ §11.5).
- Лимит бесплатных слов: `LearningWordsQuotaService` (`FREE_WORDS_LIMIT = 100`, `reserve()` в транзакции).

**Проверить (P0.1):** видны ли списки, созданные на сервере, сразу в мобильном приложении и
gonativeweb; можно ли пометить список как созданный Exam Prep (тег или атрибут); как устроены переводы
слов пака на ru/uk и есть ли они для C1–C2; есть ли в `glossaries` академические темы IELTS.

## 3. Аккаунты и сессии

Как в аудите WG §2.4: `createTempUser` (три языка) → `updateProfile` или Google/Apple; Sanctum
`sessionToken`, статический app-токен только на сервере Next. В MultiAdmin идёт отдельный трек
обязательных сессий (`docs/session-token-cutover-plan.md`): новые эндпоинты `api/exam/*` сразу
берут пользователя только из токена (`resolve.session`), без legacy `userId`.

## 4. AI

Новый модуль работает только через слой `Edu\Ai` (см. [B](B-worksheets-assessment.md) §2).
Монолитный `App\Helpers\GPT` не используем.

## 5. Оплата и права

`config/billing_products.php` (price id → продукт / план / период), `product_entitlements`,
`subscriptions.product`. Обработка Worksheets — в `Worksheets/Billing/*`. Для Exam Prep —
та же схема, плюс проверка разовых покупок (P0.6).

## 6. Пробелы и риски

1. **Лимит 100 слов** у бесплатных пользователей GoNative ломает «персональную лексику» для покупателей
   Exam Prep → ADR-002.
2. **CEFR от AI**: уровни слов и примеров — оценка модели, а не официальный список. В интерфейсе пишем
   «примерный уровень».
3. **Многозначность**: перевод привязан к слову целиком. Для коллокаций и выражений из эссе нужен
   контекст, а значит, слой значений Edu или свои слова пользователя.
4. **Таблицы на язык** (`dictionary_en`, `CourseLessonEn`…): фасад Exam должен принимать язык
   параметром и не хардкодить `En` — иначе нарушится мультиязычность (ТЗ §2.3).

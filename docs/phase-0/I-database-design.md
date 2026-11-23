# I. База данных

**Статус:** v1, утверждён владельцем 2026-11-23. **ТЗ:** §18, §26 I. Все таблицы — в БД `multi` (MultiAdmin), префикс `ex_`.
Общее для нескольких продуктов — в обобщённых таблицах продуктов ([C2](C2-accounts-billing-privacy.md) §5).

## 1. Что не создаём (переиспользуем)

| Нужно | Где уже есть |
|---|---|
| Пользователи, токены, Google | `users`, `personal_access_tokens` (способность `exams-web`) |
| Права и подписки | `product_entitlements`, `subscriptions` (продукт `exams`) |
| Прогоны и шаги AI, стоимость | `edu_generation_runs` (`purpose = exam_assessment`, `subject` = попытка), `edu_generation_steps`, `ai_usage_events` (`feature = exam`) |
| Задания практики, темы, переводы | `edu_items`, `edu_topics`, `edu_item_topics`, `edu_senses` … |
| Списки слов, повторение | `course_lesson_*`, `course_word_*`, `piggy_bank_*`, календарь GoNative |

## 2. Таблицы Exams

| Таблица | Ключевые поля | Индексы / ограничения |
|---|---|---|
| `ex_exam_versions` | `exam_key`, `provider_key`, `learning_language`, `version`, `status` (draft/verified/retired), `verified_at`, `document` JSON (контракт `exam`), `sha256` | unique(`exam_key`,`version`) |
| `ex_profiles` | `user_id` unique, `target_exam_key`, `target_result` JSON, `exam_date`, `weekly_minutes`, `feedback_language`, `translation_language`, `age_confirmed_at` (16+), `terms_version`, `terms_accepted_at` | — |
| `ex_practice_tasks` | `uuid`, `exam_key`, `section_key`, `task_key`, `topic`, `difficulty`, `prompt` JSON (текст или данные графика), `origin` (generated/curated), `validation_status`, `generator_model`, `prompt_version` | (`exam_key`,`task_key`,`validation_status`) |
| `ex_attempts` | `uuid`, `user_id`, `exam_key`, `exam_version`, `section_key`, `task_key`, `practice_task_id` ∅, `custom_prompt` (шифр.) ∅, `response_text` (шифр.), `text_sha256`, `word_count`, `word_count_rule`, `status` (draft/submitted/assessing/assessed/partial/failed), `submitted_at`, `current_assessment_id` | (`user_id`,`created_at`); (`user_id`,`text_sha256`) для повторов |
| `ex_assessments` | `uuid`, `attempt_id`, `generation_run_id`, `pipeline_version`, `rubric_key`, `rubric_version`, `guide_version`, `result` JSON (контракт `assessmentResult`), `status`, `cost_usd` | (`attempt_id`); история сохраняется — новая версия пайплайна = новая строка |
| `ex_assessment_reports` | `assessment_id`, `user_id`, `finding_id` ∅, `kind`, `message`, `status` | (`status`,`created_at`) |
| `ex_skill_observations` | `user_id`, `learning_language`, `skill_key`, `source_type` (finding/practice), `source_id`, `severity`, `weight`, `observed_at` | (`user_id`,`learning_language`,`skill_key`,`observed_at`) |
| `ex_skill_states` | PK(`user_id`,`learning_language`,`skill_key`), `status`, `observations`, `rate`, `trend`, `confidence` | Производная, пересчитывается |
| `ex_learning_plans` | `user_id`, `exam_key`, `version`, `inputs` JSON, `plan` JSON, `reason` | unique(`user_id`,`exam_key`,`version`) |
| `ex_recommendations` | `user_id`, `plan_id` ∅, `kind` (vocab_list/practice/rewrite/writing_task/reassess), `payload` JSON, `status` (open/done/dismissed), `completed_at` | (`user_id`,`status`) |
| `ex_vocab_assignments` | `user_id`, `recommendation_id`, `study_language`, `course_lesson_id`, `words_count` | (`user_id`) |
| `ex_practice_sessions` / `ex_practice_answers` | сессия: `uuid`, `user_id`, `skill_key`, `topic_id`, `items` JSON (id + хэш снимка), `status`, `score`; ответ: `session_id`, `item_id`, `answer` JSON, `correct`, `answered_at` | ответы: (`item_id`), сессии: (`user_id`,`created_at`) — для исключения решённого |
| `ex_reported_results` | `user_id`, `exam_key`, `exam_version`, `test_date`, `sections` JSON, `calibration_consent`, `consent_changed_at` | (`exam_key`,`calibration_consent`) |

## 3. Общие таблицы продуктов (в рамках обобщения кода WG)

| Таблица | Назначение |
|---|---|
| `product_usage_periods` (обобщение `ws_usage_periods`, колонка `product`) | Квоты Exams по месяцам |
| `product_credit_ledger` | Пакеты оценок: `product`, `user_id`, `delta`, `reason` (purchase/consume/refund/expire/grant), `source_key` unique (транзакция, корректировка, оценка), `expires_at` |
| `product_profiles` — **не делаем** | Профили остаются продуктовыми (`ws_profiles`, `ex_profiles`): поля разные |

Доступ на 30/90 дней — строка `product_entitlements` с `ends_at`, источник — разовая транзакция (новых таблиц не нужно).

## 4. Приватность и удаление

- `response_text` и `custom_prompt` — шифрование на уровне поля (Laravel `encrypted`): текст не читается в дампах и бэкапах
  без `APP_KEY`. Поиск по тексту не нужен; повторы — по `text_sha256`.
- Удаление попытки пользователем — физическое удаление текста и находок с цитатами. Обезличенные числа (стоимость,
  количество слов) — для учёта расходов.
- `ExamsDataPurger` (обобщённый purger продукта): все `ex_*` пользователя, его `edu_generation_runs` с `subject` попыткой,
  метаданные `ai_usage_events`. Вызывается и при удалении общего аккаунта.
- Журналы и `ai_usage_events.meta` — без текста эссе (тест).

## 5. Миграции

- Только добавочные миграции MultiAdmin (`database/migrations/*_create_ex_*`), каждая с `down()`.
- Проверка — на локальной sandbox (`./scripts/sync-db.sh`), тесты на SQLite в памяти, как у WG.
- Production — только через Git и штатный деплой после явного «да» владельца, с бэкапом затрагиваемых таблиц.
- Существующие таблицы меняются только в рамках обобщения (колонка `product` у квот) и V2 из G — отдельными миграциями.
- Версии конфигураций (экзамены, руководство по оценке) импортируются artisan-командой с предпросмотром и хэшем.

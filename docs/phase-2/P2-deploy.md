# Деплой Фазы 2 в production — пошагово

Для владельца: что выполнить на сервере и в каком порядке. Флаги Exams остаются выключенными: пользователи ничего
не увидят до Фазы 3. Агент на сервере ничего не запускает.

**Сервер:** `/var/www/goapi.mnemonicwords.app`, деплой — `deploy.sh` от пользователя `gonativealex`.

## Что изменит деплой

- **Код:** всё из `main` MultiAdmin, включая коммиты параллельной сессии WG.
- **База:** `deploy.sh` запускает `php artisan migrate --force` (все ожидающие миграции, не только наши).
  - Наша миграция `2026_11_23_120000_create_exam_tables` только **создаёт** 11 новых таблиц `ex_*`.
  - Существующие таблицы и строки она не меняет.
  - Внешние ключи ссылаются на `edu_generation_runs`, но саму эту таблицу не меняют.
  - Миграции сессии WG, ещё не применённые в production, применятся этим же деплоем. Их список — шаг 0.

## 0. Какие миграции применит деплой (до всего остального)

На сервере:

```bash
git -C /var/www/goapi.mnemonicwords.app/current rev-parse HEAD
```

Пришлите SHA — я сверю `database/migrations` между ним и `origin/main` и перечислю все миграции, которые выполнит
деплой, с тем, что каждая делает. Если среди них есть что-то кроме добавления таблиц или колонок — остановимся.

## 1. Бэкап

**Отдельный бэкап нужен.** Наша миграция данных не трогает, но деплой выполнит и чужие ожидающие миграции,
а ночные дампы `mysql_backup.sh` хранятся всего 2 дня. 2026-08-18 спас именно снимок сервера.

1. **Снимок VPS** в панели хостинга, прямо перед деплоем. Это главная страховка.
2. **Свежий дамп БД**, который не удалится автоматически:
   - **Этот деплой** — скрипт `predeploy-backup.sh` ещё не на сервере (приедет с деплоем), поэтому через
     существующий `mysql_backup.sh`:

     ```bash
     sudo bash /var/www/goapi.mnemonicwords.app/current/mysql_backup.sh
     sudo mkdir -p /root/predeploy_backups/$(date +%F)
     sudo cp -a /root/mysql_backups/*_$(date +%F).sql.gz /root/predeploy_backups/$(date +%F)/
     sudo ls -lh /root/predeploy_backups/$(date +%F)/
     for f in /root/predeploy_backups/$(date +%F)/*.sql.gz; do sudo gzip -t "$f" && echo "OK $f"; done
     ```

     Скрипт должен закончиться строкой `finished successfully`. Каждый файл — `OK` и разумного размера
     (как вчерашний в `/root/mysql_backups`).
   - **Следующие деплои** — один скрипт: дамп, проверка целостности, число таблиц, SHA-256, без автоудаления.

     ```bash
     sudo bash /var/www/goapi.mnemonicwords.app/current/deployment/backup/predeploy-backup.sh
     ```

Дампы храним, пока деплой не проверен (шаг 5), потом удаляем вручную.

## 2. Ключи в `/var/www/goapi.mnemonicwords.app/shared/.env`

Добавить:

```dotenv
# GoNative Exams (Phase 2). Flags stay off until the Phase 3 web is ready.
EXAM_API_ENABLED=false
EXAM_ASSESSMENT_ENABLED=false
EXAM_ANTHROPIC_API_KEY=
```

- **`EXAM_ANTHROPIC_API_KEY`** — единственный ключ, который нужен продукту (оценка идёт на Sonnet).
  - Отдельный ключ, а не общий GoNative: расходы Exams видны отдельно, их можно ограничить, а при утечке
    отозвать, не трогая GoNative. Без него оценка не работает: код **не** берёт общий ключ.
  - Как создать: Anthropic Console → Workspaces → новый workspace «GoNative Exams» → лимит расходов
    (предлагаю $20 в месяц на старт) → API Keys → ключ в этом workspace.
  - Пока флаги выключены, ключ не используется. Можно добавить сейчас или перед включением в Фазе 3.
  - Если `EXAM_ASSESSMENT_ENABLED=true`, а ключа нет, `deploy.sh` остановится до переключения релиза.
- **Не нужны в production:**
  - `EXAM_OPENAI_API_KEY` и `EXAM_XAI_API_KEY` — только для локальных бенчмарков;
  - `EXAMS_WEB_URL` — по умолчанию `https://exams.mnemonicwords.app`; задать, только если в Фазе 3 выберем
    другой домен.

## 3. Деплой

Как обычно: `deploy.sh` от пользователя `gonativealex`, не от root. Скрипт сам клонирует свежий `main`.

Что должно быть в логе:
- `Checking Exams queue before release switch` → `Exams queue configuration is valid.`;
- `pending migrations` — в списке `2026_11_23_120000_create_exam_tables` и то, что мы сверили на шаге 0;
- `Checking Exams workers after restart` → `valid`. Пока флаг выключен, воркер не обязателен.

## 4. Воркер очереди `exam` (после деплоя)

Ставим после деплоя: со старым кодом очереди `exam` ещё нет, и воркер падал бы в цикле.

```bash
sudo cp /var/www/goapi.mnemonicwords.app/current/deployment/supervisor/laravel-exam.ini.example /etc/supervisord.d/laravel-exam.ini
sudo supervisorctl reread && sudo supervisorctl update
sudo supervisorctl status 'laravel-exam:*'
```

Ожидается 2 процесса `RUNNING`. Пока оценка выключена, они просто ждут. Дальше `deploy.sh` перезапускает их сам.

Задача `sweep-exam-assessments` (каждые 10 минут закрывает зависшие оценки) уже есть в Task Control
и включена по умолчанию. Без оценок она ничего не делает.

## 5. Проверка и импорт

```bash
cd /var/www/goapi.mnemonicwords.app/current
php artisan migrate:status | grep create_exam_tables
php artisan exam:queue-health --require-worker
```

Ожидается: `Ran` и `valid`.

Импорт: сначала предпросмотр, затем `--apply`. Порядок важен.

```bash
php artisan exam:import-catalog
php artisan exam:import-catalog --apply
php artisan exam:import-guide
php artisan exam:import-guide --apply
php artisan exam:import-tasks
php artisan exam:import-tasks --apply
```

| Команда | Предпросмотр | После `--apply` |
|---|---|---|
| `exam:import-catalog` | 2 строки `insert` (ielts-academic, ielts-general-training, 2026-11) | `Inserted 2` |
| `exam:import-guide` | 1 строка `insert` (ielts-writing-task-2 v2) | `Inserted 1` |
| `exam:import-tasks` | 30 строк `insert` | `Inserted 30` |

Повторный предпросмотр — везде `unchanged`. Это же видно в админке: `/admin/exams` → «Версии».

## Откат

- **Код:** предыдущий релиз (`ln -sfn <prev release> current`). `deploy.sh` хранит 3 последних.
- **База:** таблицы `ex_*` новые, со старым кодом они не мешают; откатывать нечего.
  **`migrate:rollback` не запускать никогда.** Если что-то пошло не так с чужой миграцией — снимок VPS или дамп из шага 1.

## Включение (Фаза 3, не сейчас)

`EXAM_API_ENABLED=true`, затем `EXAM_ASSESSMENT_ENABLED=true` — с ключом и работающим воркером, по отдельному «да».

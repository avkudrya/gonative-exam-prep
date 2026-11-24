# Деплой сайта Exams

Один Next-сервис обслуживает два хоста ([ADR-001](../docs/decisions/ADR-001-backend-and-hosting.md)):
- `exams.mnemonicwords.app` — приложение: вход, эссе, разборы;
- `ielts.mnemonicwords.app` — лендинг IELTS. Все остальные пути отсюда уходят на `exams.`.

Бэкенд — MultiAdmin (`https://goapi.mnemonicwords.app/api/exam`), он деплоится отдельно. Этот деплой не трогает
БД, бэкенд и AI.

| Что | Значение |
|---|---|
| Сервер | `gonative` (AlmaLinux, nginx), пользователь `gonativealex` |
| Сервис | `exams-web.service`, `127.0.0.1:3300`; кандидат при деплое — `127.0.0.1:3301` |
| nginx | `/etc/nginx/conf.d/exams.mnemonicwords.app.conf`, один сертификат на оба имени |
| Git | `github-exams:avkudrya/gonative-exam-prep.git`, read-only deploy-ключ |

```
/var/www/exams.mnemonicwords.app/
  source/                         рабочая копия main (git pull)
  releases/<время>-<случайное>/   точный коммит + сборка, не меняются
  current -> releases/...         появляется при первом успешном деплое
  shared/
    .env.production.local         0600, ссылка из release/web/
    logs/<release>.log            журналы сборки и проверок
    nginx-before.<buildId>/       копия nginx до первой активации
```

## Подготовка сервера (владелец, один раз)

**0. DNS.** A-записи `exams` и `ielts` должны указывать на тот же сервер, что и `worksheets`. Все три команды
должны вывести один и тот же адрес:

```bash
dig +short exams.mnemonicwords.app; dig +short ielts.mnemonicwords.app; dig +short worksheets.mnemonicwords.app
```

**1. Deploy-ключ** (на сервере, под `gonativealex`, без sudo):

```bash
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_exams -N '' -C exams-deploy
cat >> ~/.ssh/config <<'EOF'

Host github-exams
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed25519_exams
  IdentitiesOnly yes
EOF
cat ~/.ssh/id_ed25519_exams.pub
```

Выведенный публичный ключ добавьте в GitHub: репозиторий `gonative-exam-prep` → Settings → Deploy keys → Add.
Галочку «Allow write access» **не ставить**. Проверка: `git ls-remote github-exams:avkudrya/gonative-exam-prep.git HEAD`.

**2. Рабочая копия:**

```bash
sudo install -d -o gonativealex -g gonativealex -m 750 /var/www/exams.mnemonicwords.app
git clone github-exams:avkudrya/gonative-exam-prep.git /var/www/exams.mnemonicwords.app/source
```

**3. Раскладка, env, nginx и сертификат:**

```bash
sudo bash /var/www/exams.mnemonicwords.app/source/deployment/setup-server.sh
cat /var/www/exams.mnemonicwords.app/shared/.env.production.local
```

Скрипт можно запускать повторно: существующий env и чужой nginx-конфиг он не перезаписывает. Что он делает:
- создаёт `releases/` и `shared/logs/`;
- пишет `shared/.env.production.local` (0600). Google client ID берётся из env Worksheets: клиент общий.
  Секретов в файле нет, все значения публичные:

  ```
  SITE_ORIGIN=https://exams.mnemonicwords.app
  EXAMS_WEB_ORIGIN=https://exams.mnemonicwords.app
  EXAMS_API_URL=https://goapi.mnemonicwords.app/api/exam
  EXAMS_GOOGLE_CLIENT_ID=<тот же, что WORKSHEETS_GOOGLE_CLIENT_ID>
  EXAMS_LANDING_HOSTS=ielts.mnemonicwords.app=ielts
  ```

- ставит временный HTTP-конфиг для обоих имён ([nginx/exams-bootstrap.conf](nginx/exams-bootstrap.conf)): закрыт от
  индексации и отвечает «coming soon»;
- получает один сертификат на оба имени: `certbot certonly --nginx --cert-name exams.mnemonicwords.app`. В режиме
  `certonly` certbot конфиги не правит, поэтому рабочий конфиг остаётся тем, что лежит в Git.

**4. Сервис** — устанавливается и включается, но не запускается: до первого деплоя `current` нет.

```bash
sudo bash /var/www/exams.mnemonicwords.app/source/deployment/install-web-service.sh
```

**5. Необязательно: перезапуск сервиса без пароля.** Тогда обычный деплой не спрашивает пароль sudo, и я смогу
запускать его по вашему «задеплой». Правило разрешает ровно одну команду:

```bash
# Checked before installing: a broken file in /etc/sudoers.d breaks sudo entirely.
echo 'gonativealex ALL=(root) NOPASSWD: /usr/bin/systemctl restart exams-web.service' > /tmp/exams-web.sudoers
sudo visudo -cf /tmp/exams-web.sudoers && sudo install -o root -g root -m 440 /tmp/exams-web.sudoers /etc/sudoers.d/exams-web
rm /tmp/exams-web.sudoers
sudo -k; sudo -n -l /usr/bin/systemctl restart exams-web.service   # prints the command, no password prompt
```

**6. Google.** В Google Cloud Console → APIs & Services → Credentials → тот же Web client, что у Worksheets →
Authorized JavaScript origins добавьте `https://exams.mnemonicwords.app`. Redirect URI не нужен: кнопка Google
отдаёт токен прямо странице. На бэкенде ничего менять не нужно: этот client ID уже есть в `GOOGLE_SIGN_IN_CLIENT_IDS`.

## Первый деплой (по «задеплой»)

Запускает владелец: активация nginx требует пароль sudo.

```bash
cd /var/www/exams.mnemonicwords.app/source
git pull --ff-only
bash deploy.sh "$(git rev-parse HEAD)" --activate
```

`deploy.sh` работает под `gonativealex` и по шагам:
1. Ставит блокировку.
2. Клонирует точный коммит в новый релиз и подключает env.
3. Сверяет env с production-значениями (origin, адрес API, Google client ID, хост лендинга).
4. Выполняет `npm ci`, typecheck, тесты пакета, typecheck сайта, lint и build. Браузерные тесты (`npm run test:web`)
   проходят локально перед каждым push: на сервере браузера нет.
5. Запускает кандидата на `3301` и проверяет его через [check-web.sh](check-web.sh):
   - health отдаёт точный `BUILD_ID`;
   - гостевые страницы en/ru открываются и закрыты от индексации;
   - разделы участника без сессии уводят на вход;
   - лендинг на `ielts.`: canonical, noindex, ссылка на регистрацию на `exams.`;
   - остальные пути `ielts.` уходят на `exams.`;
   - BFF на `ielts.` не отвечает;
   - BFF отклоняет чужой Origin и принимает свой;
   - `robots.txt` закрыт на обоих хостах.
6. Переключает `current` и перезапускает `exams-web`, потом повторяет те же проверки на `3300`.
7. С `--activate` ставит [nginx/exams-web.conf](nginx/exams-web.conf) вместо временного конфига: TLS для обоих имён,
   прокси на 3300 и тело запроса до 256 КБ (черновик эссе — до 200 КБ). Затем проверяет оба хоста по HTTPS:
   нужны две подряд успешные проверки нужного билда.

**Откаты:**
- падение до переключения `current` ничего не меняет;
- после переключения возвращается прошлый релиз; при первом деплое сервис останавливается;
- при неудачной активации восстанавливается прежний nginx-конфиг.

Если откат не удался, скрипт пишет об этом громко. Релизы и журналы остаются для разбора, автоматически ничего не
удаляется.

## Следующие деплои

```bash
cd /var/www/exams.mnemonicwords.app/source
git pull --ff-only
bash deploy.sh "$(git rev-parse HEAD)"
```

`--activate` больше не нужен. Публичная проверка точного билда выполняется при каждом деплое. Если env поменяли
вручную, нужен перезапуск сервиса или новый деплой.

## Включение бэкенда (владелец, по отдельным «да»)

До флагов сайт работает, но вход и разборы недоступны: бэкенд отвечает «выключено», и сайт показывает это аккуратно.

Перед шагом А, потому что с ним открывается регистрация:
- финальная вычитка политики и условий;
- ящик `exams@mnemonicwords.app`: на него ссылаются тексты и подвал.

**А. API: вход, регистрация, черновики.**
1. В production `.env` MultiAdmin поставить `EXAM_API_ENABLED=true`. `config:cache` там не используется, поэтому
   PHP-FPM прочитает флаг сразу.
2. Затем я проверяю на `exams.`:
   - каталог через BFF;
   - регистрацию нового тестового аккаунта (ссылку активации пришлёте вы);
   - вход через Google;
   - черновик с перезагрузкой;
   - удаление.

**Б. Оценка.**
1. Поставить `EXAM_ASSESSMENT_ENABLED=true` и перезапустить воркер: `sudo supervisorctl restart 'laravel-exam:*'`.
2. Затем я делаю 1–2 разбора синтетических эссе в пределах остатка бюджета Фазы 3 ($0.38). Каждый разбор не дороже
   $0.25 — это потолок в конфиге. Расход сверяю в `/admin/exams`.

Выключение — те же флаги в `false`. Данные при этом не удаляются.

## Пароль до запуска (решение владельца 2026-11-24)

Пока продукт не запущен, `exams.`, `ielts.` и `worksheets.` закрыты паролем nginx (basic auth):
- фрагмент [nginx/gonative-preview-auth.conf](nginx/gonative-preview-auth.conf) лежит в `/etc/nginx/gonative-preview-auth.conf`.
  **Не в `conf.d/`:** оттуда nginx подключает файлы ко всем сайтам;
- логины и хеши паролей — `/etc/nginx/gonative-preview.htpasswd` (`root:nginx`, 0640), в Git их нет;
- сайты подключают фрагмент строкой `include /etc/nginx/gonative-preview-auth*.conf;`. Это шаблон, поэтому без файла
  пароля просто нет;
- запросы с самого сервера (`127.0.0.1`, `72.62.178.66`) проходят без пароля, поэтому проверки `deploy.sh`
  у Exams и Worksheets продолжают работать;
- `/api/health` Exams открыт всегда.

Проверка снаружи: `EXAMS_CHECK_NETRC=<файл netrc> bash deployment/check-web.sh https://exams.mnemonicwords.app <BUILD_ID>`.

Снять пароль при запуске: `sudo rm /etc/nginx/gonative-preview-auth.conf && sudo nginx -t && sudo systemctl reload nginx`.

## Индексация закрыта

Пока владелец отдельно не решит открыть индексацию:
- `robots.txt` — `Disallow: /`;
- заголовок `X-Robots-Tag: noindex, nofollow` — и в nginx, и в приложении;
- `<meta name="robots" content="noindex, nofollow">` на всех страницах.

`check-web.sh` проверяет это при каждом деплое. Canonical и hreflang лендинга уже готовы к запуску.

## Проверки и восстановление

```bash
systemctl status exams-web.service
sudo journalctl -u exams-web.service -n 100
readlink -f /var/www/exams.mnemonicwords.app/current
curl -fsS https://exams.mnemonicwords.app/api/health
bash /var/www/exams.mnemonicwords.app/current/deployment/check-web.sh https://exams.mnemonicwords.app "$(cat /var/www/exams.mnemonicwords.app/current/web/.next/BUILD_ID)"
```

**Ручной откат на прошлый релиз:**
1. Выбрать успешный релиз в `releases/`.
2. `ln -s <релиз> .current-next && mv -Tf .current-next current` (в `/var/www/exams.mnemonicwords.app`).
3. `sudo systemctl restart exams-web.service`.
4. Запустить `check-web.sh` с `BUILD_ID` этого релиза.

`current` не направлять за пределы `releases/`, чужую блокировку `.deploy.lock` не удалять. Копию nginx-конфига до
первой активации возвращает `sudo bash <релиз>/deployment/activate-web.sh --restore <buildId>`.

## Что проверено локально

- `check-web.sh` на production-сборке с production-значениями хостов (`web/test/deploy-check.test.mjs`, входит в
  `npm run check`). Тест проверяет три вещи:
  - нужный билд проходит, при этом ни одного запроса к бэкенду;
  - чужой билд отклоняется;
  - неверный `EXAMS_WEB_ORIGIN` ловится.
- Мутации ловятся: BFF отвечает на `ielts.`; выключена проверка Origin.
- Сборочная цепочка `deploy.sh` на чистом клоне: `npm ci` (браузеры не скачиваются), typecheck, тесты, lint, build.
- Валидатор env и запуск кандидата из `web/` с env только из `.env.production.local`: проверки проходят;
  `wait-web.sh` дважды подряд подтверждает нужный билд.

systemd, nginx, certbot, откаты и sudo на настоящем сервере до первого деплоя не проверены.

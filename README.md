# GoNative Exam Prep

AI-платформа подготовки к языковым экзаменам в экосистеме GoNative. Первый экзамен — IELTS,
первая функция — IELTS Writing Checker. Результат оценки превращается в план занятий:
грамматика из банка Edu/Worksheets, лексика из словарей и списков GoNative.

- Требования: [docs/SPEC.md](docs/SPEC.md)
- План и статус: [PLAN.md](PLAN.md)
- Правила для агентов: [AGENTS.md](AGENTS.md)

## Структура

```
web/                    Next.js 16 (App Router), next-intl en/ru, Tailwind 4
packages/exam-domain/   TS-контракты: конфигурация экзаменов, результат оценки, навыки, текст
benchmarks/             манифесты датасетов и отчёты бенчмарков оценки
docs/                   ТЗ, ADR, отчёты фаз, планы
scripts/                служебные скрипты (выбор Node 24)
```

Бэкенд — модуль `Exam` в MultiAdmin ([ADR-001](docs/decisions/ADR-001-backend-and-hosting.md)).

## Запуск

```bash
npm install
npm run dev     # http://127.0.0.1:3302
npm run check   # типы, тесты, lint, сборка
```

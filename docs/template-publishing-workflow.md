# Template Publishing Workflow

Пошаговая инструкция для добавления нового шаблона в общий пул `Templates` так, чтобы он появился у всех пользователей после деплоя.

## Что понадобится

- локальная копия репозитория `meme-elf`
- готовый `.melf` файл шаблона
- установленный `node_modules`
- доступ на push в `main`

## Результат

После выполнения этого сценария новый шаблон:

- попадет в `public/templates/`
- будет записан в shipped-каталог `public/templates/catalog.json`
- появится во вкладке `Templates` у всех пользователей после деплоя `main`

## Пошагово

### 1. Запустить приложение локально

В корне репозитория:

```bash
npm install
npm run dev
```

Открой локальный адрес Vite, обычно `http://127.0.0.1:5173/` или `http://localhost:5173/`.

Важно:

- шаблонный куратор доступен только на localhost
- на production-сборке или обычном внешнем хосте вкладка `Experimental` для этой задачи не подходит

### 2. Открыть куратор шаблонов

В приложении:

1. Открой вкладку `Experimental`
2. Найди блок `Template Curator`

Здесь редактируется draft-состояние шаблонов, а не сразу production-каталог.

### 3. Импортировать новый шаблон

В `Template Curator`:

1. Нажми `Import .melf templates`
2. Выбери нужный `.melf` файл
3. Дождись статуса `Imported template: ...`

После этого шаблон появится в списке draft-каталога.

### 4. Привести карточку шаблона в порядок

Для импортированного шаблона проверь и при необходимости исправь:

- `Title`
- `Tags`
- порядок через `Move up` / `Move down`

Если импортировали что-то лишнее, удали через `Delete`.

### 5. Проверить draft-состояние до публикации

Перед promote убедись, что:

- список шаблонов в `Template Curator` выглядит так, как должен выглядеть shipped-набор
- названия не откатываются после ввода
- порядок карточек правильный

### 6. Записать shipped-каталог в репозиторий

В `Template Curator` нажми:

`Promote shipped catalog`

Это действие:

- обновляет `public/templates/catalog.json`
- записывает файлы шаблона в `public/templates/<template-id>/`
- делает шаблон частью shipped-каталога приложения

### 7. Проверить, что шаблон реально появился в shipped-каталоге

После promote проверь:

- в репозитории появился или обновился каталог `public/templates/<template-id>/`
- в нем есть как минимум `template.melf`
- если шаблон использует вынесенные артефакты, рядом будут `preview.png` и `base.png`
- `public/templates/catalog.json` содержит запись нового шаблона

Удобно проверить так:

```bash
git diff -- public/templates
```

### 8. Проверить поведение в самом приложении

В локальном приложении:

1. Перейди во вкладку `Templates`
2. Убедись, что новый шаблон там отображается
3. Нажми на него
4. Проверь, что шаблон применяется без ошибок

Минимум нужно подтвердить:

- карточка шаблона видна в `Templates`
- шаблон применяется
- статус сообщает об успешном применении

### 9. Прогнать базовую проверку перед коммитом

В корне репозитория:

```bash
npm test -- --run src/app/App.test.tsx src/features/templates/template-curator.test.tsx src/features/templates/shipped-template-catalog.test.ts
npm run build
```

Оба шага должны пройти успешно.

### 10. Закоммитить и запушить изменения

Если всё корректно:

```bash
git add public/templates README.md docs/2026-06-04-roadmap.md
git commit -m "feat: update shipped template catalog"
git push origin main
```

Если в этом же изменении менялся код шаблонного пайплайна, добавь в commit и соответствующие `src/*` файлы.

### 11. Дождаться деплоя

Для этого репозитория production обновляется из `main`.

Значит после push:

- дождись завершения deploy-пайплайна
- открой опубликованную версию приложения
- проверь вкладку `Templates`

Именно на этом шаге шаблон становится доступен всем пользователям.

## Короткий чеклист

- `npm run dev`
- открыть localhost
- `Experimental` -> `Template Curator`
- импортировать `.melf`
- поправить `Title`, `Tags`, порядок
- нажать `Promote shipped catalog`
- проверить `public/templates/catalog.json`
- проверить `public/templates/<template-id>/`
- проверить шаблон во вкладке `Templates`
- прогнать тесты и build
- `git commit`
- `git push origin main`
- проверить production после деплоя

## Важное различие

- `Template Curator` на localhost: draft-редактирование
- `Templates` в обычной работе приложения: shipped-каталог

Пока не выполнен `Promote shipped catalog`, шаблон не считается опубликованным для всех пользователей.

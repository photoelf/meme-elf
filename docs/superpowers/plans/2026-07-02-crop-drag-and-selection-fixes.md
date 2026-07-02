# Фикс: залипающий кроп в Prepare image + старт Select Area вне канваса

## Контекст

После тач-адаптации кропа в модалке Prepare image (коммит `3023849`, миграция mouse→pointer events) на десктопе появился баг: клик по хендлу начинает ресайз, но отпускание кнопки не завершает драг — бокс продолжает следовать за курсором. Вторая проблема (UX-долг): инструмент Select Area позволяет начать выделение только внутри канваса, хотя scene crop уже умеет стартовать из всего вьюпорта. Попутная цель — зафиксировать замеченные нестройности кода для следующей задачи (пошаговый рефакторинг без простоя).

## Корневая причина бага 1 (подтверждена инструментированным репро в Chromium)

- Модалка завершает драг только через `window.addEventListener('pointerup', handlePointerEnd)` (`src/features/image/pre-insert-modal.tsx:173-256`), а deps этого эффекта содержат нестабильные значения (`onCropBoxChange` — inline-функция из `App.tsx:4324`, объект `sourceSize`) → слушатели переподписываются на каждом рендере App.
- `handlePointerUp` из preview-canvas (`src/features/preview/preview-canvas.tsx:1672`, слушатель на window) безусловно вызывает setState на КАЖДОМ pointerup. Браузер выполняет microtask checkpoint между вызовами слушателей одного события → React флашит рендер посреди диспатча pointerup → cleanup эффекта модалки снимает её `pointerup`-слушатель прямо во время диспатча. По спецификации DOM снятый слушатель пропускается, а заново добавленный не входит в клонированный список диспатча. Слушатель модалки всегда последний (модалка монтируется последней) → детерминированно пропускается → `cropInteractionRef` не обнуляется.
- Раньше работало, потому что конец драга слушал `mouseup`, который диспатчится ПОСЛЕ pointerup (и после флаша) — переподписанный слушатель успевал его поймать.

## Фикс 1 — `src/features/image/pre-insert-modal.tsx`

1. **Стабильные слушатели (собственно фикс)**: эффект драга (стр. 173-256) переводится на `[]`-deps — подписка один раз на маунт. Актуальные значения (`effectiveCropMode`, `onCropBoxChange`, `sourceSize`, `rotationQuarterTurns`, `flipHorizontal`, `flipVertical`) читаются через latest-ref `latestCropDragContextRef`, синхронизируемый эффектом без deps (паттерн как `latestSelectionDraftRef` в preview-canvas). React 19.1 — `useEffectEvent` недоступен, latest-ref безопасен.
2. **pointerId**: добавить `pointerId: number` во все три варианта `CropInteraction` (стр. 33-43); move/end реагируют только на совпадающий `pointerId`; в трёх стартовых `onPointerDown` (preview 'new' стр. 331, overlay 'move' стр. 385, хендлы 'resize' стр. 434) — ранний выход, если драг уже активен (второй палец не крадёт драг).
3. **Defense-in-depth**: локальный хелпер `capturePointer(event)` — `setPointerCapture(event.pointerId)` с guard'ом на jsdom (метода нет) и try/catch; вызывать на всех трёх стартах. Гарантирует доставку pointerup при отпускании за пределами окна браузера. Захваченные события всё равно всплывают до window — window-обработчики не страдают.

### Тесты — `src/features/image/pre-insert-modal.test.tsx`

- **A (пиннинг корневой причины)**: после маунта заспаить `window.add/removeEventListener`, сделать `rerender` с новой identity `onCropBoxChange` → ноль пере-подписок `pointerup/pointermove/pointercancel`.
- **B (непокрытый мышиный путь)**: pointerdown мышью на хендле `bottom-right` → pointermove (onCropBoxChange вызван) → pointerup на window → mockClear → pointermove → onCropBoxChange НЕ вызван.
- **C (мультитач)**: pointerup с чужим pointerId не завершает драг; хелпер `dispatchPointerEvent` скопировать из `preview-canvas.test.ts:12-33`.
- Существующие тач-тесты (стр. 231-366) должны пройти без изменений.

## Фикс 2 — Select Area из вьюпорта, `src/features/preview/preview-canvas.tsx`

Причина: старт выделения привязан к `.preview-surface` (shellRef, размер = канвас), ветка в `onPointerDown` стр. 1897-1918. Внешняя область — `.preview-viewport-content` (viewportRef, стр. 1722), где обработчик сейчас делает `if (!isSceneCropMode) return;` (стр. 1758). Образец — scene crop (`startSceneCrop`, стр. ~1085), который стартует из вьюпорта и клампит через существующие `getCanvasPoint` (стр. 2393, возвращает координаты и вне канваса) + `clamp` к `selectionTargetRect`.

1. Извлечь хелпер `startSelectionDraft(clientX, clientY, pointerType)` (рядом с `startSceneCrop`): getCanvasPoint → clamp к selectionTargetRect → `selectionInteractionRef.current = true`, `setEditingLayerId(null)`, `setIsInteracting(true)`, `updateMobileInteraction('select', ...)`, `onDocumentInteractionStart`, `onSelectionDraftChange` (start=end).
2. Ветка в shell (стр. 1897-1918) делегирует хелперу — поведение внутри канваса не меняется.
3. Новая ветка в viewport `onPointerDown` — ПЕРЕД `if (!isSceneCropMode) return;` и ПОСЛЕ тач-pan ветки:
   `!isSceneCropMode && retouchMode === 'select' && pointerType !== 'touch' && event.target === event.currentTarget && event.button !== 1 && event.button !== 2 && !selectionInteractionRef.current` → `preventDefault()` + `startSelectionDraft(...)`.
   - `target === currentTarget` = «попали в воркспейс, не в канвас» (защита от двойного старта при всплытии из shell); `!selectionInteractionRef.current` — дублирующая страховка.
   - **Тач не трогаем**: на телефоне драг по воркспейсу в select-режиме остаётся pan'ом (без изменения жестовой арбитрации). Осознанный дефолт, чтобы не регрессить мобильную акробатику; при желании расширим отдельно.
4. Window-обработчики move/commit (стр. 1244-1290) уже клампят — без изменений.

### Тесты — `src/features/preview/preview-canvas.test.ts` (файл .ts — createElement, без JSX)

- **E**: pointerdown мышью по viewport вне канваса → draft закламплен в (0,0); после rerender с draft — pointermove(window) до (1000,300) → endX/endY клампятся к 800/250; pointerup → commit.
- **F (мобильный пин)**: touch pointerdown по воркспейсу при `retouchMode: 'select'` → `onPreviewPanStart` вызван, draft НЕ создан.
- **G (нет двойного старта)**: pointerdown по shell → `onSelectionDraftChange`/`onDocumentInteractionStart` ровно по одному разу.

## Верификация

1. `npx vitest run src/features/image/pre-insert-modal.test.tsx src/features/preview/preview-canvas.test.ts`, затем полный `npx vitest run`.
2. `npm run build` (tsc ловит изменения типов).
3. Ручное репро через Playwright на `npm run dev` (dev-сервер уже запущен в фоне, task bjsk0l07u):
   - Модалка: Paste image URL → `http://localhost:5173/templates/two-buttons/base.png` → драг хендла мышью, отпустить, двигать мышь без кнопки → бокс НЕ следует (сейчас следует — репро подтверждено); то же для move-драга overlay; отпускание за пределами окна браузера → не залипает.
   - Select Area: mousedown в сером воркспейсе вне канваса → рамка рисуется с клампом к канвасу и коммитится; старт внутри канваса работает как раньше; в тач-эмуляции драг по воркспейсу в select-режиме по-прежнему pan.
4. Изменение затрагивает тач-стыки → прогнать чеклист скилла `verifying-platform-seams`.

## Замеченные нестройности кода (для следующей задачи — рефакторинг)

1. **Системная опасность**: почти все window-слушатели (pan, selection, scene crop, draw, touch gestures, layer transform в preview-canvas; сплиттер и pan в App) переподписываются на каждом рендере из-за inline-колбэков из App.tsx в deps. Именно этот класс и выстрелил багом 1 — любой end-слушатель, зарегистрированный позже setState-ящего, уязвим к пропуску mid-dispatch.
2. `handlePointerUp` в preview-canvas:1672 безусловно вызывает setState на каждом pointerup в приложении (даже без взаимодействия) — лишние рендеры на каждый клик.
3. App.tsx (~5400 строк) и preview-canvas.tsx (~2400 строк) — god-компоненты; десятки inline-замыканий в JSX.
4. Дублирование имён (`handlePointerMove`/`handlePointerEnd`/`handlePointerUp` в трёх файлах) — лог отладки показал три одноимённых обработчика на window одновременно.
5. Дублированные `clamp`-хелперы (pre-insert-modal, preview-canvas inline, selection-utils).
6. Два параллельных кроп-механизма: scene crop (crop-overlay.ts с TOUCH/MOUSE-геометрией) и pre-insert crop (свои хардкоды в CSS/компоненте).
7. Legacy `onMouseDown`-дубль для scene crop на viewport (стр. 1773-1780) рядом с `onPointerDown` — потенциальный двойной старт, фактически мёртвый код при preventDefault на pointerdown.
8. Объекты в deps-массивах (`draft.pendingSource.sourceSize`) — referential instability.
9. Взаимодействия без pointerId-трекинга (до фикса — и в модалке): любой pointerup завершает любой драг.
10. Пробел покрытия: хендлы модалки тестировались только тач-путём; мышиный путь не тестировался — так регрессия и проскочила.

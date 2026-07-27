# SCRUM-265 (остаток) — выбор папки при выгрузке в казначейство (File System Access)

**Тикет:** [SCRUM-265 «Замечания по кнопкам»](https://sulubaiguskarova.atlassian.net/browse/SCRUM-265) — последний невыполненный пункт чеклиста.
**Дата дизайна:** 2026-07-27

## Контекст и оценка бэк/фронт

Невыполненный пункт: «после нажатия Выгрузить в казначейство должна открываться страница с выбором папки для сохранения (как в 1С); а у нас сразу скачивается файл». Часть «проверки после Выгрузить» уже закрыта в SCRUM-265 (validate-before-download на странице `/treasury-export`).

**Это фронт (клиентская) задача, не бэк.** Сервер физически не может писать в файловую систему пользователя — байты файла и валидацию бэк уже отдаёт (GET/POST download + preview/422). «Куда лечь файлу» — чисто клиентская зона. SDUI ни при чём: `/treasury-export` — легаси-контур (`features/treasury-export`), SDUI лишь наводит `navigate` на роут.

**Почему в 1С папка работает во всех браузерах:** через установленное «расширение работы с файлами» (нативный браузерный add-in 1С), а не нативным вебом. У fin-web такого расширения нет. Кросс-браузерный «выбор папки без установки чего-либо» в вебе невозможен: либо Chromium-only `showDirectoryPicker`, либо своё расширение (диспропорционально). Решение владельца — **`showDirectoryPicker` (Chromium) как progressive enhancement + фолбэк** на текущее браузерное скачивание в FF/Safari.

## Область

- Страница `/treasury-export` (`features/treasury-export`), одиночный документ (пакет — фаза 2). Только фронт; бэк и SDUI не трогаем; новых эндпоинтов нет.

## Поведение

При «Выгрузить», после успешной валидации:
- **Chromium (`window.showDirectoryPicker` доступен):** системный диалог выбора папки → файл пишется в выбранную папку под именем от бэка (`row.fileName`).
- **FF/Safari (API нет):** без изменений — `window.location.assign(treasuryExportDownloadUrl(typeCode, id))` (браузерное скачивание).

## Ключевые решения

1. **Gesture-safety.** `showDirectoryPicker()` требует transient user activation → зовётся **синхронно в обработчике клика, до любого `await`**. Порядок: клик → синхронный pre-check `hasErrors` из уже выполненного авто-preview → `showDirectoryPicker()` → `await` fetch байтов → запись. Повторный preview НЕ гоняем перед picker'ом (потеряли бы активацию); серверный GET сам перепроверяет.
2. **Байты + имя.** Одиночный GET тянем как blob через существующий `apiService.getFileBlob` (относительный URL). Имя — из строки preview `row.fileName` (бэк гарантирует), Content-Disposition не парсим. Запись: `dirHandle.getFileHandle(fileName, { create: true })` → `createWritable()` → `write(blob)` → `close()`.
3. **Валидация.** Pre-check `hasErrors` из авто-preview (уже отрисован блок ошибок) перед диалогом; при ошибках — тост, picker не открываем. Серверный GET при записи может вернуть 422 → ловим тостом.
4. **Отмена.** Пользователь закрыл диалог (`AbortError`) → тихий no-op (без тоста).
5. **Разрешения.** `showDirectoryPicker({ mode: 'readwrite' })`; при необходимости `queryPermission`/`requestPermission('readwrite')` на handle перед записью.

## Структура (FSD, только `features/treasury-export`)

- `lib/save-to-directory.ts`
  - `supportsDirectoryPicker(): boolean` — feature-detect (`typeof window.showDirectoryPicker === 'function'`).
  - `pickDirectory(): Promise<FileSystemDirectoryHandle | null>` — вызывает `showDirectoryPicker({ mode: 'readwrite' })` (синхронный старт — зовётся в клике до fetch); `AbortError` (отмена) → `null`, прочие ошибки пробрасываются.
  - `writeBlobToDirectory(dir: FileSystemDirectoryHandle, fileName: string, blob: Blob): Promise<void>` — `getFileHandle(fileName,{create:true})` → `createWritable()` → `write(blob)` → `close()`.

  (Разделены намеренно: picker должен открыться в клике ДО сетевого fetch — иначе теряется user activation; запись идёт после fetch.)
- `api/treasury-export-api.ts` — `fetchTreasuryExportBlob(typeCode: string, id: number, signal?): Promise<AxiosResponse<Blob>>` через `apiService.getFileBlob({ url: '/api/document-entries/${typeCode}/${id}/treasury-export' })`.
- `ui/treasury-export-page.tsx` — `handleExport`: picker-path (Chromium) vs fallback (`location.assign`).
- `types/file-system-access.d.ts` — узкий ambient-тип используемого подмножества FS-Access API (`Window.showDirectoryPicker`, `FileSystemDirectoryHandle.getFileHandle`, `FileSystemFileHandle.createWritable`, `FileSystemWritableFileStream.write/close`) — в TS 5.9 стандартно не типизировано.
- i18n (`common.json`, ru+kz): `treasuryExport.savedToFolder` («Файл сохранён в выбранную папку»), `treasuryExport.saveFailed` («Не удалось сохранить файл»).

## Поток данных

```
click «Выгрузить»
  ├─ supportsDirectoryPicker() === false → window.location.assign(GET url)  [FF/Safari, как сейчас]
  └─ true [Chromium]:
       ├─ preview.data?.hasErrors → showToast('error', hasErrorsToast); stop
       ├─ dir = await pickDirectory()                           // showDirectoryPicker зовётся сразу в клике
       │     └─ null (AbortError) → stop (тихо)
       ├─ res = await fetchTreasuryExportBlob(typeCode, id)      // 422 → catch → saveFailed toast
       ├─ await writeBlobToDirectory(dir, row.fileName, res.data)
       └─ showToast('success', savedToFolder)
```

## Ошибки

- `AbortError` (отмена диалога) → тихо.
- Ошибка fetch/422 → `showToast('error', saveFailed)`, файл не пишется.
- Ошибка записи (нет прав/диск) → тот же error-тост.
- Фолбэк-ветка (FF/Safari) — поведение и обработка как сейчас (без изменений).

## Тесты (Vitest)

- Chromium happy-path: мок `showDirectoryPicker` (возвращает fake dirHandle) + `getFileBlob` (blob) → `getFileHandle(fileName,{create:true})`, `createWritable`, `write(blob)`, `close` вызваны; success-тост.
- Нет API: `supportsDirectoryPicker()` false → `window.location.assign` вызван (фолбэк), picker не тронут.
- Отмена: `showDirectoryPicker` бросает `AbortError` → нет `getFileBlob`, нет тоста.
- Ошибка fetch: `getFileBlob` reject → error-тост, записи нет.
- `hasErrors` (из авто-preview) → picker не открыт, error-тост.

## Границы

- Пакет (несколько документов) — фаза 2: с `dirHandle` можно писать N отдельных XML прямо в папку (ближе к 1С, чем ZIP). Сейчас одиночный вход, не реализуем; `saveBlobToDirectory` проектируем под переиспользование.
- Фолбэк-ветку (GET-навигация) не меняем — проверенное поведение из v7.
- Бэк/SDUI/легаси вне `features/treasury-export` — не трогаем.

## Верификация (e2e, ручная)

1. Chrome/Edge: `/treasury-export?typeCode=…&id=<валидный>` → «Выгрузить» → системный диалог папки → выбрать → файл `ЗаявкаГПС<Номер>.xml` появляется в папке; success-тост.
2. Chrome: отмена диалога → ничего не скачивается, ошибок нет.
3. Firefox/Safari: «Выгрузить» → обычное скачивание (как сейчас), диалога папки нет.
4. Документ с ошибками: «Выгрузить» → тост, диалог не открывается, файла нет.

## Открытый вопрос аналитику

Кросс-браузерный «выбор папки как в 1С» без установки расширения невозможен: в Chrome/Edge будет системный диалог папки, в Firefox/Safari — обычное скачивание. Если требуется буквальный паритет во всех браузерах — это отдельная крупная инициатива (своё браузер-расширение/нативный хелпер), вне SCRUM-265.

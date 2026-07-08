# Дизайн: язык интерфейса в SDUI-формах (SCRUM-268)

**Дата:** 2026-07-08
**Исходная спека бэка:** `docs/superpowers/plans/SCRUM-268-frontend-spec-language.md`
**Связано:** SCRUM-218, SCRUM-268; бэкенд — webbuh, ветка `talgat/SCRUM-268`.

## Проблема

Переключатель РУС/ҚАЗ локализует только «хром» приложения (i18next). SDUI-формы
(`POST /api/view`) остаются русскими: фронт не сообщает бэку язык. Бэкенд уже
принимает опциональное поле body `language: "Ru" | "Kz"`, читает его только на
`OPEN` и фиксирует в form-session на весь её жизненный цикл. Смена языка живой
сессии невозможна — только CLOSE + повторный OPEN.

## Принятые решения

| Вопрос | Решение |
|---|---|
| Dirty-форма при переключении языка | Confirm-диалог; отмена — язык не меняется |
| Закэшированные сессии других вкладок | Best-effort CLOSE каждой + полная очистка кэша |
| Оркестрация | Публичный API SDUI, top-bar импортирует напрямую (widget→feature) |
| `Accept-Language`-интерцептор | Не делаем (YAGNI: body-поле выигрывает у заголовка) |

## 1. Транспорт — `language` в каждом `/api/view`

Единственный HTTP-chokepoint SDUI — `src/features/sdui/api/view-transport.ts`
(`post()`): все билдеры запросов (`lib/dispatch.ts` ×2, `lib/relay-selection.ts` ×2)
проходят через него.

- `src/features/sdui/types/view.ts` — в `ViewRequest` добавить `language?: string`.
- `view-transport.ts`, в `post()` перед отправкой:

```ts
import i18n from 'i18next'

const LANG_MAP: Record<string, string> = { ru: 'Ru', kz: 'Kz' }
req.language = LANG_MAP[i18n.language] ?? 'Ru'
```

i18next в проекте использует коды `ru`/`kz` (`supportedLanguages` в
`src/app/config/i18n/index.ts`), канонические значения бэка — `Ru`/`Kz`, поэтому
маппинг обязателен. Сервер читает поле только на `OPEN`; на `EVENT`/`COMMAND`
оно игнорируется — слать безвредно. `closeBeacon` (`navigator.sendBeacon`) не
несёт body — это ок, на CLOSE язык не нужен.

## 2. Публичный API SDUI

Новый файл `src/features/sdui/lib/language-session-control.ts`, экспорт двух
функций через `src/features/sdui/index.ts`:

- **`hasSduiUnsavedWork(): boolean`** — `true`, если dirty активная форма
  (`useViewStateStore.getState().dirty`) ИЛИ хотя бы одна запись
  `sdui-cache-store` имеет `dirty: true`.
- **`closeAllSduiSessions(): Promise<void>`** — для каждой записи кэша с
  `formSessionId` — best-effort `POST /api/view {action: {type: 'CLOSE'}, formSessionId}`
  (ошибки глотаем), затем полная очистка кэша.

Сопутствующие правки:

- `SduiCacheEntry` (`lib/stores/sdui-cache-store.ts`) — добавить поле
  `dirty: boolean`; заполняется из `useViewStateStore.getState().dirty` в
  persist-ветке cleanup-а `sdui-screen.tsx`.
- `sdui-cache-store` — добавить действие `clear()` (очистка всего кэша).

Импорт `features/sdui` из виджета `top-bar` легален по FSD (widget → feature) и
не нарушает изоляцию SDUI↔легаси: top-bar не относится к легаси-зоне.

## 3. top-bar — confirm и оркестрация

`toggleLanguage` в `src/widgets/top-bar/ui/top-bar.tsx` становится сценарием:

1. Если `hasSduiUnsavedWork()` — показать confirm-диалог
   («Переключение языка перезагрузит формы, несохранённые изменения будут
   потеряны» / Переключить / Отмена). Отмена — выход, язык не меняется.
2. `await closeAllSduiSessions()` — обязательно **до** смены языка, иначе
   restore-ветка `sdui-screen` воскресит стейл-сессию из кэша.
3. `i18n.changeLanguage(nextLang)`.

Диалог — новый переиспользуемый `ConfirmDialog` в `src/shared/ui/confirm-dialog/`
(MUI Dialog, заголовок + текст + две кнопки). Существующий
`UnsavedChangesDialog` не подходит: у него семантика save/discard/cancel, а
«сохранить всё» по нескольким вкладкам в этот срез не входит. Все тексты — ключи
`common.json` (ru + kz).

## 4. Re-OPEN активной формы — `sdui-screen.tsx`

Язык **не добавляется** в deps главного OPEN-эффекта (`sdui-screen.tsx`,
deps `[location.pathname]`): его cleanup при `persist=true` сохранил бы
стейл-сессию в кэш, а перезапуск эффекта тут же восстановил бы её из кэша.

Вместо этого — отдельный эффект: подписка на `i18n.on('languageChanged', …)`
(initial-вызов не срабатывает — это событие, а не state). По событию:

1. `dispatch({type: 'CLOSE'})` текущей сессии — на сервере не остаётся сироты;
2. reset сторов (`tree-store`, `view-state-store`, `panel-store`) и
   `useSduiCacheStore.remove(route)` — страховка от гонок (к этому моменту
   top-bar уже очистил кэш целиком);
3. `dispatch({type: 'OPEN', layoutCode})` — запрос уйдёт уже с новым
   `language` из транспорта (п. 1).

## 5. Ошибки и краевые случаи

- Ошибки CLOSE — best-effort, как в существующем `closeSession`
  (`lib/dispatch.ts`): молча глотаем, переключение языка не блокируем.
- Легаси-формы не трогаем: i18next перерисовывает хром, RHF-состояние
  сохраняется, потери данных нет — confirm их не касается.
- Открыта не-SDUI страница: dirty активной формы `false`, но кэш фоновых
  SDUI-вкладок всё равно проверяется и закрывается.
- Fallback лейблов (нет KZ-перевода → русский) — целиком на сервере, фронт
  ничего не обрабатывает.

## 6. Критерии приёмки

Из исходной спеки бэка:

- [ ] Переключение на ҚАЗ → открытая SDUI-форма (Заявка ГП, ЭСФ)
      переоткрывается: командная панель («Өткізу және жабу | Жазу | Өткізу |
      Дт/Кт | Қазынашылыққа жүктеп шығару | Басып шығару | Есептер | Тағы»),
      лейблы полей казахские (где есть nameKz; иначе русский, пустых нет).
- [ ] Обратно на РУС → всё русское, без стейл-кэша.
- [ ] Каждый `/api/view` в network-трейсе несёт `language`.
- [ ] Навигация по списку/формам после переключения не воскрешает RU-сессии
      из кэша.
- [ ] `formSessionId` до и после переключения разные; старая сессия закрыта
      (CLOSE в трейсе).

Плюс confirm-сценарий:

- [ ] Dirty SDUI-форма (активная или в кэше вкладок) → переключение языка →
      confirm-диалог; отмена не меняет язык; подтверждение — CLOSE всех
      SDUI-сессий и re-OPEN активной формы на новом языке.
- [ ] Без несохранённых изменений диалог не показывается.

## Проверка локально

Бэкенд из ветки `talgat/SCRUM-268`:
`docker compose up -d db && ./mvnw spring-boot:run -pl webbuh-api`.

```bash
curl -s -X POST http://localhost:8080/api/view -H "Content-Type: application/json" -d '{
  "action": {"type": "OPEN"},
  "layoutCode": "ZayavkaNaRegistratsiyuGPSdelki.ФормаОбъекта",
  "route": "/documents/ZayavkaNaRegistratsiyuGPSdelki/new",
  "language": "Kz"
}' | grep -o 'Өткізу[^"]*'
```

# Дизайн: SCRUM-265 — иконка «Вывести иерархию», childState-панели, «Назад» на опенер, basisId

- **Дата:** 2026-07-13
- **Исходная спека:** [SCRUM-265-frontend-implementation-spec.md](../plans/SCRUM-265-frontend-implementation-spec.md)
- **Ветка:** `feat/sdui-scrum-265` от `feat/sdui-movements-from-list` (коммиты + пуш, без PR)

## Контекст: спека частично устарела

Спека писалась до ветки `feat/sdui-movements-from-list`, которая уже добавила chrome панельных
вкладок: `layout.tsx` рендерит `PageHeader` (title + стрелки + крестик) над `WorkspacePanelHost`,
закрытие — через `performTabClose` (`features/workspace-tabs`). Поэтому:

- **WI-D спеки (новый `WorkspacePanelHeader`) не реализуем.** Согласовано с владельцем: обогащаем
  существующий chrome — берём из спеки только `openerTabId` и семантику «Назад = вернуться на
  вкладку-опенер, не закрывая панель».
- **WI-A спеки отпадает.** `workspaceTab.back/close` не нужны (PageHeader переводится своими
  ключами), `sdui.button.relatedDocuments.tooltip` и `sdui.relatedDocuments.empty` кодом не
  потребляются (tooltip приходит локализованным с бэка) — мёртвые ключи не добавляем (YAGNI,
  согласовано).

Бэкенд-контракт (§2 спеки) уже в проде: BUTTON-ноды с `icon`/`tooltip`, OPEN_DIALOG с `childState`
без сессии, `?basisId=` на роуте нового документа.

## WI-B — SDUI BUTTON рендерит `props.icon` и `props.tooltip`

**Зона:** SDUI. Референс-код — §WI-B спеки, используется как есть.

| Файл | Изменение |
|---|---|
| `src/features/sdui/ui/nodes/action/button-icons.tsx` | новый: inline-SVG реестр (`related-hierarchy`), `resolveButtonIcon(name): ReactNode \| null` (неизвестное имя → `null`) |
| `src/features/sdui/ui/nodes/action/button-node.tsx` | читает `props.icon`/`props.tooltip`; icon-only (икона есть, label нет) — тот же MUI `Button`+`muiVariant`, `sx={{minWidth:0, px:1}}`, глиф в line-box `1.75em` (высота = текстовым кнопкам), `aria-label = tooltip ?? command`; `tooltip` → MUI `Tooltip` + `<span display:inline-flex>` (срабатывает и на disabled); неизвестная иконка → fallback `label`, затем `command`. Dropdown/selected-row логика без изменений |
| `src/features/sdui/ui/nodes/action/button-node.test.tsx` | новый: icon-only (svg + accessible name = tooltip), hover → `role="tooltip"`, регресс label-кнопки, неизвестная иконка → label без svg, без label и иконки → command. Моки: `useSduiDispatch`, ref-picker store (`needsSelectedRow → false`) |

## WI-C — панель без сессии читает `childState`

**Зона:** SDUI. **Баг:** `DialogHost` рендерит no-session панель голым `NodeRenderer` —
биндинги не находят значения, диалог пустой.

| Файл | Изменение |
|---|---|
| `src/features/sdui/ui/dialog-host.tsx` | ветка `!panel.session` → обернуть `NodeRenderer` в существующий `PanelStateProvider` (read-only сессия, seed из `panel.viewState`) — тот же паттерн, что уже в `WorkspacePanelHost`. Ветка `openInWorkspaceTab`-skip и presentation switch (page/drawer/modal) не меняются |
| `src/features/sdui/lib/panel-state-provider.test.tsx` | новый: Probe через `useSduiSession().getValue(binding)` видит seed-значение; `setValue` → `console.warn`, не бросает |

## WI-D′ — «Назад» с панельной вкладки на вкладку-опенер

**Зона:** `features/workspace-tabs` (общая) + `app/layout`. PageHeader/NavigationButtons
не меняются — пропы `onBack`/`onClose` уже есть.

| Файл | Изменение |
|---|---|
| `src/features/workspace-tabs/types/workspace-tab.ts` | `openerTabId?: string` — только для `pageType: 'sdui-panel'`: вкладка, из которой панель открыта |
| `src/features/workspace-tabs/lib/hooks/use-workspace-tabs-store.ts` | `activateOrCreatePanel`: при **создании** панельной вкладки фиксирует `openerTabId = activeTabId` (если тот не сама панель); при reuse существующей — `openerTabId` не перезаписывает |
| `src/features/workspace-tabs/lib/utils/perform-tab-back.ts` | новый: `performTabBack(tabId, navigate)` — опенер найден → `setActiveTab(opener.id)` + для роутовой вкладки `navigate(path + search)`; панель **остаётся** в баре. Опенер закрыт/не найден → fallback `performTabClose(tabId, navigate)` |
| `src/features/workspace-tabs/lib/utils/perform-tab-back.test.ts` | новый: возврат на роутовый опенер (navigate + обе вкладки живы), возврат на панельный опенер (setActiveTab без navigate), опенер отсутствует → закрытие |
| `src/features/workspace-tabs/index.ts` | экспорт `performTabBack` |
| `src/app/layout/layout.tsx` | `onBack={() => performTabBack(...)}`, `onClose` — прежний `performTabClose` |

Семантика: «Назад» переключает на опенер, панель остаётся в нижнем баре (повторный вход — кликом
по вкладке); «✕» — закрывает, как сейчас. Fallback на закрытие при пропавшем опенере даёт
предсказуемый выход вместо мёртвой кнопки.

## WI-E — легаси `/new?basisId=`

**Зона:** легаси. Зеркально существующему `VidOperatsii`, минимальные правки, без рефакторинга.

| Файл | Изменение |
|---|---|
| `src/pages/documents/documents-entry/lib/hooks/use-document-entry-form.ts` | `basisId = searchParams.get('basisId')`; в `newEntryParams` (`{...(vidOperatsii && …), ...(basisId && {basisId})}`); `queryKey: ['document-entry-new', moduleCode, vidOperatsii, basisId]`; `enabled: isNew && (!!vidOperatsii || !!basisId) && !copyFrom`; ветка «reset to empty» дополнительно требует `!basisId`; `basisId` в deps эффекта |
| `src/pages/documents/documents-entry/lib/hooks/use-document-entry-form.test.tsx` | новый: с `basisId=5` → `getNewDocumentEntry(type, {basisId:'5'})`, copyFrom-путь не зовётся; без параметров → `/new` не зовётся. Моки `@/entities/document-entry`, `react-router-dom` |

Отсутствующий/удалённый basis — забота сервера (warning + пустая форма), клиент ничего не валидирует.

## Тестирование

Vitest по каждому WI + полный `npx vitest run` в финале; `npx tsc --noEmit` → 0 и чистый ESLint
по изменённым файлам (§5 спеки — явное требование, перекрывает дефолт «не гонять проверки»).

Ручная приёмка на стенде (пилот: «Счёт к оплате» ← «Заявка на регистрацию ГП сделки»):

1. В командной панели документа — **иконка** related-hierarchy с tooltip, высота = соседним кнопкам.
2. Клик → панель «Связанные документы» **с данными** (childState) и chrome (title + стрелки + ✕).
3. «Назад» → возврат на вкладку документа, панель остаётся в нижнем баре; «✕» → панель закрывается.
4. «Создать на основании» (dropdown) → выбор цели → новый документ **предзаполнен** от basis.
5. Регресс: движения документа (из списка и из формы) работают как прежде.

## Порядок коммитов

```
feat: SDUI-кнопка с иконкой и tooltip (related-hierarchy)      # WI-B
fix: childState-панели без сессии читают снимок значений        # WI-C
feat: возврат с панельной вкладки на вкладку-опенер             # WI-D′
fix: basisId при открытии нового документа (легаси)             # WI-E
```

## Вне scope

- `WorkspacePanelHeader`, ключи `workspaceTab.*`/`sdui.relatedDocuments.*` из исходной спеки — не реализуются (см. «Контекст»).
- Серверная часть SCRUM-265 — уже в проде, не трогаем.

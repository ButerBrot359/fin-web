# SDUI: спека фронт-фич (fin-web) — Заявка ГП-сделки: ДтКт-диалог, звёздочка, закрытие вкладки

Документ для фронт-команды (`fin-web`). Две независимые фронт-задачи, которые невозможно сделать с бэка: рендер диалогов (для кнопки «Дт/Кт») и отслеживание модификации SDUI-формы (для звёздочки и диалога «Сохранить изменения?» при закрытии вкладки).

Бэк уже реализует свою часть (кнопка «Дт/Кт» + команда `showDtKt` + данные движений; каскадная очистка полей). Здесь — только фронт.

---

## Фича 3 (ДОБАВЛЕНО) — PageHeader для SDUI-страницы: крестик + звёздочка модификации

### Симптом
На SDUI-форме НЕТ крестика в правом верхнем углу и НЕТ пометки модификации (звёздочки) на самой странице. dirty-трекинг работает (вкладка внизу получает `*` и модалку), но пользователь ждёт крестик/звёздочку на форме, как в старой форме.

### Корень
`src/pages/documents/documents-entry/ui/document-entry-page.tsx:43-45`:
```tsx
if (newView) {
  return <SduiScreen layoutCode={`${moduleCode}.ФормаОбъекта`} />
}
```
SDUI-ветка рендерит ТОЛЬКО `<SduiScreen>`. СТАРАЯ форма (ниже в том же файле) рендерит `<PageHeader title={pageTitle} onClose={handleClose} />`, где:
- `pageTitle = isDirty ? `${baseTitle} *` : baseTitle` — звёздочка в заголовке страницы;
- `onClose={handleClose}` → при `isDirty` открывает `UnsavedChangesDialog`, иначе закрывает вкладку.

Для SDUI этого нет → крестик только на вкладке (`WorkspaceTabBar` внизу `app/layout/layout.tsx`), звёздочка только на вкладке.

### Что сделать (фронт)
Обернуть SDUI-ветку в тот же `PageHeader` + `UnsavedChangesDialog`, используя dirty из SDUI-стора. Эскиз:
```tsx
if (newView) {
  return <SduiDocumentPage moduleCode={moduleCode} />
}
```
где новый `SduiDocumentPage`:
```tsx
const dirty = useViewStateStore((s) => s.dirty)
const baseTitle = (useTreeStore((s) => s.root?.props?.title as string | undefined)) ?? ''
const pageTitle = dirty ? `${baseTitle} *` : baseTitle
// onClose: if (dirty) openUnsavedDialog() else { removeTab(pathname); closeTab(pathname); navigate(listPath) }
// «Сохранить» в модалке → dispatch COMMAND saveAndClose (или setPendingAction + закрытие, как уже сделано в workspace-tab-bar)
return (
  <div className="flex h-full flex-col gap-5 pt-5">
    <PageHeader title={pageTitle} onClose={handleClose} />
    <SduiScreen layoutCode={`${moduleCode}.ФормаОбъекта`} />
    <UnsavedChangesDialog .../>
  </div>
)
```
Так появятся крестик в правом верхнем углу и звёздочка на самой форме, консистентно со старой формой. dirty уже есть в `view-state-store` (Фича 2), переиспользуй его. (Заголовок можно брать из дерева `tree.props.title` или из инжектированного бэком LABEL-узла `label.docTitle`.)

> Бэк инжектирует видимый заголовок LABEL-узлом, но звёздочку модификации к нему добавить с бэка нельзя (dirty — клиентское состояние). Поэтому звёздочку рисует фронт в `PageHeader`/заголовке.

---

## Фича 1 — рендер диалогов (для кнопки «Дт/Кт»)

### Что уже есть
- Эффекты `openDialog`/`closeDialog` доходят и кладутся в стек: `src/features/sdui/lib/dispatch.ts:60-69`, обработчик `src/features/sdui/lib/effect-handler.ts`. Есть `getDialogStack()` и `subscribeDialogs()` в `dispatch.ts`.
- Узлы `TABLE` / `TABLE_COLUMN` рендерятся: `src/features/sdui/ui/nodes/composite/table-node.tsx` (строки читаются из `useViewState(node.binding)`, колонки — из детей `TABLE_COLUMN` по `props.binding`).
- `BUTTON` с `props.command` шлёт `COMMAND`: `src/features/sdui/ui/nodes/action/button-node.tsx`.

### Чего нет
**Диалоги из `dialogStack` нигде не рендерятся** — `openDialog` сейчас визуально ничего не показывает. Нужно добавить компонент-хост диалогов.

### Что сделать
Добавить `DialogHost`, который подписывается на стек диалогов и рендерит каждый `effect.node` как модалку (MUI `Dialog`), а внутри — обычный `NodeRenderer`.

Примерно:
```tsx
// src/features/sdui/ui/dialog-host.tsx (новый)
import { useSyncExternalStore } from 'react'
import { Dialog, DialogTitle, DialogContent } from '@mui/material'
import { getDialogStack, subscribeDialogs } from '../lib/dispatch'
import { NodeRenderer } from './node-renderer'

export const DialogHost = () => {
  const stack = useSyncExternalStore(subscribeDialogs, getDialogStack)
  return (
    <>
      {stack.map((eff, i) =>
        eff.node ? (
          <Dialog key={eff.node.id ?? i} open onClose={/* dispatch closeDialog or pop */ undefined} maxWidth="md" fullWidth>
            {eff.node.props?.title && <DialogTitle>{String(eff.node.props.title)}</DialogTitle>}
            <DialogContent>
              <NodeRenderer node={eff.node} />
            </DialogContent>
          </Dialog>
        ) : null,
      )}
    </>
  )
}
```
Смонтировать `DialogHost` один раз рядом с `SduiScreen` (или в общем layout SDUI), чтобы он жил независимо от перерисовки дерева.

Закрытие: по `onClose`/кнопке вызвать удаление верхнего диалога из стека (нужен экспорт `popDialog()` из `dispatch.ts` или диспатч эффекта `closeDialog`). Сейчас `closeDialog` фильтрует по `d.node?.id` — для ручного закрытия добавьте `popDialog()` или вызывайте `closeDialog` с id узла.

### Контракт данных «Дт/Кт» (бэк отдаёт именно так)
По нажатию `btn.dtkt` фронт шлёт `COMMAND {command:"showDtKt"}`. Бэк отвечает:
- `patches` с `setValue` `binding="dtkt.rows"` → массив строк (`Array<Record<string,unknown>>`). `dispatch` уже кладёт setValue-патчи в `view-state` (`applyValuePatches`).
- `effects` с `openDialog`, `node`:
  ```
  { id:"dialog.dtkt", type:"PAGE", props:{title:"Движения документа"},
    children:[
      { id:"table.dtkt", type:"TABLE", binding:"dtkt.rows", props:{label:"Проводки"},
        children:[
          {id:"col.period", type:"TABLE_COLUMN", props:{label:"Период",     binding:"period"}},
          {id:"col.schet",  type:"TABLE_COLUMN", props:{label:"Счёт",        binding:"schet"}},
          {id:"col.summa",  type:"TABLE_COLUMN", props:{label:"Сумма",       binding:"summa"}},
          {id:"col.soderzh",type:"TABLE_COLUMN", props:{label:"Содержание",  binding:"soderzhanie"}},
        ]}
    ]}
  ```
`TableNode` читает строки из `useViewState("dtkt.rows")` → данные окажутся там из setValue-патча. Каждая строка — объект с ключами `period/schet/summa/soderzhanie`. Значения бэк отдаёт уже строками (формат даты/суммы). Ничего дополнительно мапить не нужно — `TableNode` берёт `row[col.binding]`.

> Если `dialog.dtkt` с `type:"PAGE"` неудобно (PageNode завязан на вкладку) — бэк может отдать `type:"VSTACK"`; скажите, поправим контракт. Текущий `PageNode` просто рендерит детей + ставит document.title, в модалке это безвредно, но `VSTACK` чище. **Согласуйте — бэк подстроит тип корневого узла диалога.**

---

## Фича 2 — модификация SDUI-формы: звёздочка + диалог «Сохранить изменения?» при закрытии вкладки

### Что уже есть (для старых форм — переиспользуем)
- Звёздочка в заголовке вкладки: `isDirty ? `${tab.title} *` : tab.title` — `src/widgets/workspace-tab-bar/ui/workspace-tab-item.tsx:25`, флаг из `useFormCacheStore`.
- Крестик закрытия вкладки + проверка dirty: `src/widgets/workspace-tab-bar/ui/workspace-tab-bar.tsx:54-65` (`handleClose` → если dirty, показать диалог).
- Диалог `UnsavedChangesDialog` (Сохранить / Отбросить / Отмена): `src/shared/ui/unsaved-changes-dialog/unsaved-changes-dialog.tsx`, смонтирован в `workspace-tab-bar.tsx:113`.
- Хранилище dirty: `src/features/workspace-tabs/lib/hooks/use-form-cache-store.ts` (`setDirty(tabId, isDirty)`).

### Чего нет
SDUI **не сообщает dirty** в `useFormCacheStore`. `view-state-store` (`src/features/sdui/lib/stores/view-state-store.ts`) изменения не отслеживает, `SduiScreen` зовёт только `useTabMeta(title)` без dirty. Поэтому при закрытии SDUI-вкладки `isDirty` всегда `false` → ни звёздочки, ни диалога.

### Что сделать (одна связная правка в SDUI-слое)

**1. Отслеживать dirty в SDUI.** Завести в `view-state-store` (или отдельном сторе) флаг `dirty`:
- Ставить `dirty=true`, когда значение меняет ПОЛЬЗОВАТЕЛЬ (через `useViewStateSetter` из поля), а не сервер.
  - Важно: серверные обновления (`replaceAll` на OPEN, `merge`/`applyValuePatches` из patches) НЕ должны помечать форму грязной. Помечайте dirty только в публичном `set(binding, value)`, который вызывают узлы-поля по пользовательскому вводу. Патчи от сервера применяйте через отдельный путь (`applyValuePatches` уже использует `useViewStateStore.getState().set` — его нужно развести: либо отдельный `setFromServer`, либо флаг-параметр `set(binding, value, { fromServer })`). Иначе любая серверная реакция (пересчёт суммы, очистка поля) ложно пометит форму грязной.
- Для нового документа (создание) — по желанию ставить dirty сразу при первом вводе (как в 1С: «*» появляется при модификации). Если нужно «*» сразу на создании — ставьте dirty=true при OPEN нового документа (route .../new). Согласуйте поведение; рекомендуется как в старых формах — по первому изменению.
- Сбрасывать `dirty=false` после успешного `save`/`post` (в `dispatch`, ветка COMMAND, при успешном ответе — можно по `effects` notify success, либо ввести явный признак).

**2. Прокинуть dirty в существующую инфраструктуру.** В `SduiScreen` (или в сторе через эффект) синхронизировать с `useFormCacheStore`:
```ts
useEffect(() => {
  useFormCacheStore.getState().setDirty(route, dirty)
}, [route, dirty])
```
Тогда **звёздочка во вкладке заработает автоматически** (логика `workspace-tab-item` уже читает `useFormCacheStore`).

**3. Диалог «Сохранить изменения?» при закрытии SDUI-вкладки.** `handleClose` в `workspace-tab-bar.tsx` уже показывает `UnsavedChangesDialog` при dirty. Нужно, чтобы для SDUI-вкладок три кнопки делали правильное:
- **Сохранить** → выполнить SDUI `COMMAND saveAndClose` (через `dispatch`) вместо submit react-hook-form. Сейчас `handleDialogSave` заточен под старые формы — добавьте ветку для SDUI-вкладок (определять по типу вкладки/маршруту), которая дёргает SDUI-сохранение и затем закрывает.
- **Отбросить** → `performClose(tabId)` (как сейчас) → SDUI `CLOSE` уйдёт на unmount.
- **Отмена** → ничего.

> Минимально: правки в `view-state-store` (dirty + развод server/user set), `sdui-screen.tsx` (sync в `useFormCacheStore` + сброс после save), и ветка для SDUI в `handleDialogSave`. Крестик, диалог и звёздочка уже готовы — их трогать не нужно.

---

## Сводка

| Фича | Где | Объём | Бэк |
|---|---|---|---|
| ДтКт-диалог (рендер) | новый `DialogHost` + монтаж рядом с SduiScreen | ~30 строк | готово: кнопка `btn.dtkt`, `showDtKt`, `dtkt.rows`, `openDialog` node |
| Звёздочка + «Сохранить?» при закрытии | `view-state-store` (dirty), `sdui-screen.tsx`, ветка SDUI в `handleDialogSave` | ~40 строк | не требуется |

Связанные правки уже отданы фронту отдельно: [frontend-fixes-zayavka-gp.md](frontend-fixes-zayavka-gp.md) (копирование, «Показать все», проваливание).

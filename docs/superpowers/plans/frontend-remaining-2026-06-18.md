# SDUI: оставшиеся фронт-правки (fin-web) — печать + возврат выбора из формы создания

> **Дата:** 2026-06-18
> **Контекст:** Phase 1 (дропдаун, «Посмотреть всё», выбор) и Q6 (childState/childRevision) — готовы. Осталось **два** фронт-фикса. Бэк менять не нужно — оба чисто фронтовые. После них фича закрывается.

---

## Фикс 1 — Печать (эффект `download`): «Cannot GET …»

### Где
`src/features/sdui/lib/effect-handler.ts`, ветка `download` (стр.40-41).

### Сейчас
```ts
case 'download':
  window.open(effect.url!, '_blank')
  break
```
`effect.url` — относительный путь к бэку (`/api/document-entries/.../print?...`). API-запросы идут через axios с абсолютным `baseURL = VITE_API_BASE_URL` (на backend-origin), а `window.open('/api/...')` открывает против **frontend-origin** → dev-сервер отвечает «Cannot GET …». Бэк-эндпоинт корректен (`PrintController`, `GET /api/document-entries/{typeCode}/{id}/print`, параметры `form`/`language`, отдаёт PDF) — запрос просто уходит не на тот origin.

### Сделать
Качать PDF через существующий `apiService.getFileBlob` (`src/shared/api/api.ts:74-81`) — он бьёт через тот же axios-инстанс (правильный baseURL + интерсепторы/авторизация), затем открыть blob:
```ts
case 'download': {
  if (!effect.url) break
  void apiService
    .getFileBlob({ url: effect.url })
    .then((res) => {
      const objectUrl = URL.createObjectURL(res.data)
      window.open(objectUrl, '_blank')
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
    })
    .catch(() => showToast('error', 'Не удалось сформировать печатную форму'))
  break
}
```
`play` уже синхронный — обернули в `void …then()`, менять сигнатуру не нужно.

**Минимальная альтернатива** (если печать без header-авторизации): `window.open(import.meta.env.VITE_API_BASE_URL + effect.url, '_blank')`. Blob-вариант надёжнее (сохраняет авторизацию) — рекомендуется он.

> Если после фикса вместо «Cannot GET» придёт бэковый `404`/`501` — это уже другой вопрос (неверный `form`-код / тип без печати), сообщите на бэк. Текущий симптом снимается этим фиксом.

---

## Фикс 2 — «Записать и выбрать» не возвращает запись в поле (Q4-реле бьёт в дочернюю сессию)

### Симптом
В форме создания справочника из «Добавить» нажатие «Записать и выбрать» создаёт запись на бэке, но **поле в документе не заполняется** (и/или тост «Форма устарела, выбор не применён»).

### Корень
Имена полей и структура `closeDialog`-реле уже поправлены (хорошо). Но реле применяет ответ родителя к **дочерней** сессии и шлёт **её** revision, тогда как родитель ссылочного поля в пилоте — **корневая форма**, а не панель.

Архитектура: корневая сессия живёт в глобальных zustand-сторах (`useTreeStore`/`useViewStateStore`); дочерние панели — в локальном `PanelFormProvider`. `findPanelBySessionId` ищет только среди **панелей** стека — **корня там нет** → для родителя-корня вернёт `undefined`.

`src/features/sdui/lib/dispatch.ts`, реле в `closeDialog` (стр.122-148):
```ts
const parentPanel = findPanelBySessionId(effect.applyToParentSessionId)   // корень → undefined
const parentRevision = parentPanel?.session?.revision ?? session.revision  // ← revision ДОЧЕРНЕЙ сессии (S1)
// ...
}).then((res) => {
  session.bumpRevision(res.revision)        // ← session = ДОЧЕРНЯЯ (S1), уже снята popPanel'ом
  session.applyTreePatches(res.patches)     // ← setValue поля летит в дочернюю, корень его не получает
  applyValuePatches(res.patches, session.setFromServer)
  session.merge(res.statePatch)
})
```
Следствия для пилота:
- `ref.select` уходит в корневую сессию с **revision дочерней** → бэк может ответить `409 STALE_REVISION`;
- даже если пройдёт — ответный `setValue` поля применяется к дочерней (S1, размонтированной), а корневая форма (глобальный стор) его не видит → поле не обновляется.

### Сделать
Когда родитель — не панель (корень), реле должно работать с **глобальным** стором: брать его revision и применять к нему ответ. Эскиз:
```ts
import { useTreeStore } from './stores/tree-store'
import { useViewStateStore } from './stores/view-state-store'

// ... внутри closeDialog, ветка applyToParent*:
if (effect.applyToParentSessionId && effect.applyToParentTargetNodeId && effect.applyToParentValue) {
  const parentPanel = findPanelBySessionId(effect.applyToParentSessionId)

  // Цель применения ответа: панель-родитель ИЛИ корневой стор (для пилота — корень)
  const tree = useTreeStore.getState()
  const vs = useViewStateStore.getState()
  const parentRevision = parentPanel?.session?.revision ?? tree.revision   // ← revision КОРНЯ, не дочерней

  void viewTransport.post({
    formSessionId: effect.applyToParentSessionId,
    revision: parentRevision,
    action: {
      type: 'COMMAND',
      command: `ref.select:${effect.applyToParentTargetNodeId}`,
      value: effect.applyToParentValue,
    },
  }).then((res) => {
    if (parentPanel) {
      // родитель — панель: обновляем её сессию (updatePanelSession + патчи панели)
      updatePanelSession(parentPanel.panelId, res.revision)
      // применение патчей к дереву/состоянию панели — через её PanelFormProvider
      // (если прямого доступа нет — для пилота это не нужно: родитель всегда корень)
    } else {
      // родитель — КОРЕНЬ: применяем к глобальным сторам
      tree.bumpRevision(res.revision)
      tree.clearAllErrors()
      tree.applyPatches(res.patches ?? [])
      applyValuePatches(res.patches ?? [], vs.setFromServer)
      vs.merge(res.statePatch ?? {})
    }
    effectHandler.playAll(res.effects ?? [])   // на случай вложенных эффектов
  }).catch((error) => {
    if (error instanceof ViewConflictError && error.data.code === 'SESSION_NOT_FOUND') {
      showToast('warning', 'Форма устарела, выбор не применён')
    } else {
      showToast('error', error instanceof Error ? error.message : 'Ошибка')
    }
  })
}
```
Главное: **revision и применение ответа — к родителю (корню), а не к `session` (дочерней)**. Имена методов корневого стора подтверждены по `sdui-screen.tsx` (`useTreeStore.getState().{revision, bumpRevision, applyPatches, clearAllErrors}`, `useViewStateStore.getState().{merge, setFromServer}`).

> Родитель-**панель** глубиной ≥2 (создание из поля, которое само в дочерней форме) — edge-case: применение патчей к React-локальному состоянию панели из модуля затруднено. Для пилота не нужен (родитель = корень). Можно отложить, пометив TODO.

---

## Проверка (acceptance после двух фиксов)
1. **Печать:** кнопка «Печать» открывает/скачивает PDF (не «Cannot GET»).
2. **Добавить→Записать и выбрать:** «Добавить» → форма создания договора с предзаполненным контекстом (контрагент/организация из childState) → «Записать и выбрать» → запись создаётся, **поле «Договор контрагента» в документе заполняется** созданной записью, зависимые поля пересчитываются, дочерний drawer закрывается. Без тоста «Форма устарела».
3. Регресс не затрагивает уже рабочее: дропдаун, «Посмотреть всё», выбор из списка.

## Сводка
| # | Файл | Правка | Бэк |
|---|------|--------|-----|
| 1 | `effect-handler.ts` (download) | `getFileBlob`→blob→`window.open` | не нужен |
| 2 | `dispatch.ts` (closeDialog-реле) | revision+применение ответа к корню, не к дочерней сессии | не нужен |

После этих двух правок справочные поля (дропдаун, кнопки, «Посмотреть всё», «Добавить», «проваливание») и печать закрыты — можно гнать E2E-smoke и лить.

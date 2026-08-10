import { useCallback } from 'react'

import type { ViewNode } from '../../types/view'
import { useSduiDispatch } from '../dispatch'

// Интерактивные редакторы ячейки, внутри которых двойной клик — жест ВЫДЕЛЕНИЯ
// СЛОВА, а не «открыть строку». onDoubleClick висит на <tr> и всплывает из
// инпутов, поэтому без этого guard'а попытка выделить слово в текстовом
// редакторе ячейки открывала бы диалог формы строки.
//
// ВНИМАНИЕ: guard — ДОПОЛНЕНИЕ к спеке §2, а не её требование. У целевой свёртки
// «Итоги по работникам» все колонки readonly, и там он не проявляется; но контракт
// `open` общий для любой ТЧ, а редактируемые ТЧ (ИПН, ПОК) рисуют в ячейках
// настоящие <input>. Снять guard можно одной правкой — удалить проверку ниже.
const INTERACTIVE_EDITOR_SELECTOR = 'input, textarea, select, [contenteditable]'

function isInsideCellEditor(target: EventTarget | null | undefined): boolean {
  if (!(target instanceof Element)) return false
  return target.closest(INTERACTIVE_EDITOR_SELECTOR) !== null
}

/**
 * Серверная реакция на двойной клик по строке ТЧ (`table.rowOpen`,
 * frontend-spec-tch-dvoynoy-klik-forma-stroki §2).
 *
 * В эталоне 1С бухгалтер не видит сырых табличных частей: по двойному клику на
 * строке сводной таблицы открывается отдельное окно («Начисления работника» у
 * «Тарификации»). Что именно открыть и чем наполнить — доменное знание сервера;
 * фронт лишь сообщает, по какой строке был двойной клик, и играет пришедший
 * эффект `openDialog`. Правок рендера диалога не требуется (§2.5).
 *
 * Команда приходит от бэка ГОТОВОЙ строкой в `action.command` — не конструируем
 * её из имени таблицы и не разбираем (§3). Нет action с `trigger: 'open'` — нет
 * round-trip: двойной клик остаётся чисто клиентским, как у всех остальных ТЧ.
 * Признак включается сервером точечно, у большинства ТЧ его не будет (§2.2).
 *
 * ПОЧЕМУ `open`, а не `activate` (§3). У LIST двойной клик называется `activate`,
 * но у TABLE это имя уже занято АКТИВИЗАЦИЕЙ строки (`ПриАктивизацииСтроки` —
 * одиночный клик и стрелки, см. `use-row-activate.ts`). Переиспользовать его
 * значило бы дать одному имени два смысла в зависимости от типа узла.
 *
 * ПОЧЕМУ НЕТ ДЕДУПА (§2.6) — в отличие от парного `useRowActivate`. Там дедуп
 * обязателен: активизация срабатывает на каждый клик и каждую стрелку, ответ на
 * повторную активизацию той же строки идентичен, и без дедупа round-trip'ы шли бы
 * лавиной. Здесь наоборот: двойной клик — редкий осознанный жест, и повторный
 * двойной клик по той же строке ОБЯЗАН снова открыть окно (пользователь закрыл
 * диалог и хочет вернуться). Сервер отдаст тот же диалог — это нормально.
 * Не «оптимизировать» копипастой `lastActivatedRef` из `use-row-activate.ts`.
 *
 * Ключ строки в payload — `rowId`, а НЕ `id` (§2.3): у LIST там `id`, потому что
 * это ключ записи БД, а строка ТЧ может быть ещё не сохранена (`tmp-…`).
 * Без `rowId` не эмитим вовсе — сервер не может определить строку сам
 * (выбор строки ТЧ живёт на клиенте, ADR-0013 §4.2) и лишь залогирует
 * предупреждение (§3).
 */
export function useRowOpen(
  node: ViewNode
): (rowId: string | undefined, event?: { target: EventTarget | null }) => void {
  const dispatch = useSduiDispatch()

  const action = node.actions?.find((a) => a.trigger === 'open')
  const command = action?.command
  const behavior = action?.behavior

  return useCallback(
    (rowId: string | undefined, event?: { target: EventTarget | null }) => {
      if (!command) return
      if (!rowId) return
      if (isInsideCellEditor(event?.target)) return

      // behavior приходит с бэка (все три false): команда немутирующая, ревизию
      // не поднимает — открытие окна не должно стоить flush'а незакоммиченного
      // ввода и не снимает признак «есть изменения».
      void dispatch({ type: 'COMMAND', command, value: { rowId } }, behavior)
    },
    [command, behavior, dispatch]
  )
}
